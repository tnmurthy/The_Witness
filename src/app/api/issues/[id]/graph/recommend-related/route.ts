import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { runAIFunction } from "@/lib/ai/orchestrator";
import { AIProviderError } from "@/lib/ai/types";
import { isProviderConfigured, getDefaultProviderId } from "@/lib/ai/registry";
import {
  RELATED_ENTITY_CATEGORIES,
  type RelatedEntityCategory,
} from "@/lib/ai/functions/recommend-related-entities";
import type { RecommendRelatedEntitiesOutput } from "@/lib/ai/functions/recommend-related-entities";
import { z } from "zod";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({ perCategoryCount: z.number().int().min(1).max(5).default(3) });

const CATEGORY_TABLE: Record<RelatedEntityCategory, { table: string; titleColumn: string }> = {
  company: { table: "companies", titleColumn: "name" },
  technology: { table: "technologies", titleColumn: "name" },
  paper: { table: "papers", titleColumn: "title" },
  github_repository: { table: "github_repositories", titleColumn: "name" },
  wisdom_entry: { table: "wisdom_entries", titleColumn: "title" },
  article: { table: "articles", titleColumn: "title" },
};

const CANDIDATES_PER_CATEGORY = 15;

/**
 * POST /api/issues/[id]/graph/recommend-related — this milestone's
 * "Issue Builder should automatically suggest: related companies,
 * technologies, research, GitHub repositories, wisdom, and articles."
 *
 * Derives the issue's topic from its own hero_story/signal_card content
 * (same technique recommend_wisdom uses, falling back to the issue
 * title), then runs a real full-text search — not a blind sample —
 * against each of the 6 categories using that topic, via the
 * search_vector column every one of these tables already has (all from
 * Migration 008, except github_repositories' from Migration 019). The
 * AI function then picks from that pre-filtered, topic-relevant pool —
 * a meaningfully stronger starting point than suggest_graph_connections'
 * uniform sampling, which is why this route exists as its own thing
 * rather than just calling that one with different parameters.
 *
 * Returns suggestions grouped by category; nothing is persisted as an
 * edge automatically — the editor accepts each one explicitly via
 * POST /api/graph/edges, same review-before-create discipline as every
 * other AI suggestion feature in this app.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, issueId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getDefaultProviderId()) {
    return NextResponse.json(
      {
        error: "No AI provider is configured on this deployment.",
        detail: `Set OPENAI_API_KEY or ANTHROPIC_API_KEY. openai configured: ${isProviderConfigured("openai")}, anthropic configured: ${isProviderConfigured("anthropic")}`,
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: issue } = await supabase
    .from("issues")
    .select("publication_id, title")
    .eq("id", issueId)
    .single();
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { data: blocks } = await supabase
    .from("blocks")
    .select("type, payload")
    .eq("issue_id", issueId)
    .in("type", ["hero_story", "signal_card"])
    .order("position")
    .limit(3);

  const topicFromBlocks = (blocks ?? [])
    .map((b) => {
      const payload = b.payload as { headline?: string; body?: string };
      return [payload.headline, payload.body].filter(Boolean).join(": ");
    })
    .join("\n");
  const issueTopic = topicFromBlocks || issue.title;

  // Build a topic-relevant candidate pool per category via full-text
  // search — the core difference from suggest_graph_connections.
  const candidateGroups = await Promise.all(
    RELATED_ENTITY_CATEGORIES.map(async (category) => {
      const { table, titleColumn } = CATEGORY_TABLE[category];
      let query = supabase
        .from(table)
        .select(`id, ${titleColumn}` as "id")
        .textSearch("search_vector", issueTopic, { type: "websearch" })
        .limit(CANDIDATES_PER_CATEGORY);

      if (category === "wisdom_entry") {
        query = query.eq("review_status", "approved");
      }

      const { data, error } = await query;
      if (error) {
        logger.error("Related-entity candidate search failed for one category", { error, category, issueId });
        return [];
      }

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        entityType: category,
        entityId: row.id as string,
        label: row[titleColumn] as string,
      }));
    })
  );

  const candidates = candidateGroups.flat();

  if (candidates.length === 0) {
    return NextResponse.json({
      suggestions: [],
      note: "No candidates matched this issue's topic in any of the 6 categories — try adding more content to the issue first, or broaden the topic.",
    });
  }

  try {
    const result = await runAIFunction<RecommendRelatedEntitiesOutput>(supabase, {
      functionId: "recommend_related_entities",
      publicationId: issue.publication_id,
      issueId,
      actorId: user.id,
      input: { issueTopic, candidates, perCategoryCount: parsed.data.perCategoryCount },
    });

    // Anti-hallucination check: only ids actually offered survive, same
    // discipline as recommend_wisdom and suggest_graph_connections.
    const validKeys = new Set(candidates.map((c) => `${c.entityType}:${c.entityId}`));
    const validSuggestions = result.output.suggestions.filter((s) =>
      validKeys.has(`${s.entityType}:${s.entityId}`)
    );

    const labelByKey = new Map(candidates.map((c) => [`${c.entityType}:${c.entityId}`, c.label]));
    const hydrated = validSuggestions.map((s) => ({
      ...s,
      label: labelByKey.get(`${s.entityType}:${s.entityId}`) ?? "(untitled)",
    }));

    return NextResponse.json({ jobId: result.jobId, suggestions: hydrated, costUsd: result.costUsd });
  } catch (error) {
    logger.error("Recommend related entities failed", { error, issueId, userId: user.id });
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recommendation failed" },
      { status: 500 }
    );
  }
}

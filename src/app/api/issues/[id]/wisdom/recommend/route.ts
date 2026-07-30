import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { runAIFunction } from "@/lib/ai/orchestrator";
import { AIProviderError } from "@/lib/ai/types";
import { isProviderConfigured, getDefaultProviderId } from "@/lib/ai/registry";
import { recommendWisdomRequestSchema } from "@/lib/validation/wisdom";
import type { RecommendWisdomOutput } from "@/lib/ai/functions/recommend-wisdom";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_CANDIDATES = 60;

/**
 * POST /api/issues/[id]/wisdom/recommend — this milestone's "AI should
 * automatically recommend appropriate wisdom based on issue topics"
 * requirement. Builds the candidate pool from every approved
 * wisdom_entries row (capped at MAX_CANDIDATES — see
 * docs/WISDOM_ENGINE.md for why this is an honest interim approach
 * rather than the final design once the library grows past a few dozen
 * entries), derives a topic string from the issue's own hero_story/
 * signal_card block content if any exist (falling back to the issue
 * title), and persists the model's picks to wisdom_recommendations —
 * replacing any prior recommendations for this issue rather than
 * accumulating stale ones from an earlier draft of the topic.
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
  const parsed = recommendWisdomRequestSchema.safeParse(body);
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

  const { data: candidateRows } = await supabase
    .from("wisdom_entries")
    .select("id, title, translation, keywords, wisdom_categories(name)")
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (!candidateRows || candidateRows.length === 0) {
    return NextResponse.json(
      { error: "No approved wisdom entries exist yet to recommend from" },
      { status: 422 }
    );
  }

  const candidates = candidateRows.map((c) => {
    const category = Array.isArray(c.wisdom_categories) ? c.wisdom_categories[0] : c.wisdom_categories;
    return {
      id: c.id,
      title: c.title,
      translation: c.translation,
      category: category?.name,
      keywords: c.keywords ?? undefined,
    };
  });

  try {
    const result = await runAIFunction<RecommendWisdomOutput>(supabase, {
      functionId: "recommend_wisdom",
      publicationId: issue.publication_id,
      issueId,
      actorId: user.id,
      input: { issueTopic, candidates, count: parsed.data.count },
    });

    const validIds = new Set(candidates.map((c) => c.id));
    const validRecommendations = result.output.recommendations.filter((r) => validIds.has(r.wisdomEntryId));

    await supabase.from("wisdom_recommendations").delete().eq("issue_id", issueId);

    if (validRecommendations.length > 0) {
      await supabase.from("wisdom_recommendations").insert(
        validRecommendations.map((r) => ({
          issue_id: issueId,
          wisdom_entry_id: r.wisdomEntryId,
          score: r.score,
          rationale: r.rationale,
          ai_job_id: result.jobId,
        }))
      );
    }

    return NextResponse.json({
      jobId: result.jobId,
      recommendations: validRecommendations,
      costUsd: result.costUsd,
    });
  } catch (error) {
    logger.error("Wisdom recommendation failed", { error, issueId, userId: user.id });
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recommendation failed" },
      { status: 500 }
    );
  }
}

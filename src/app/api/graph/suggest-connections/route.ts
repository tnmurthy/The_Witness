import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAIFunction } from "@/lib/ai/orchestrator";
import { AIProviderError } from "@/lib/ai/types";
import { isProviderConfigured, getDefaultProviderId } from "@/lib/ai/registry";
import { suggestConnectionsRequestSchema } from "@/lib/validation/graph";
import { GRAPH_ENTITY_TABLE, GRAPH_ENTITY_TYPES, type GraphEntityType } from "@/lib/graph/types";
import type { SuggestGraphConnectionsOutput } from "@/lib/ai/functions/suggest-graph-connections";
import { logger } from "@/lib/logger";

const MAX_CANDIDATES = 60;

/**
 * POST /api/graph/suggest-connections — cold-start connection discovery.
 * Builds a candidate pool by sampling a handful of entities from every
 * OTHER type (never the source entity's own type), runs the
 * suggest_graph_connections AI function, and returns suggestions for an
 * editor to review — this route never creates an edge itself;
 * POST /api/graph/edges still requires an explicit follow-up action.
 *
 * ai_jobs.publication_id is NOT NULL (Migration 005) — every AI
 * Workspace action, including this platform-wide Knowledge Graph one,
 * has to attribute to some publication for cost/audit tracking, even
 * though Knowledge Graph content itself isn't publication-scoped. This
 * route uses the caller's own first publication membership purely for
 * that attribution, and returns a clear, honest error rather than a raw
 * constraint-violation 500 if the caller has no publication membership
 * at all to attribute to (a Super Admin who isn't a member of any
 * specific publication, for instance).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const editorialRoles = ["super_admin", "editor_in_chief", "editor", "writer", "researcher"];
  if (!profile?.role || !editorialRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Editorial staff only" }, { status: 403 });
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

  const body = await request.json().catch(() => null);
  const parsed = suggestConnectionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: membership } = await supabase.from("publication_members").select("publication_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) {
    return NextResponse.json(
      { error: "You must be a member of at least one publication to use AI Knowledge Graph suggestions (used for cost attribution)." },
      { status: 422 }
    );
  }

  const { table: sourceTable, titleColumn: sourceTitleColumn } = GRAPH_ENTITY_TABLE[parsed.data.entityType];
  const { data: sourceEntity } = await supabase
    .from(sourceTable)
    .select(`${sourceTitleColumn}, description` as "description")
    .eq("id", parsed.data.entityId)
    .maybeSingle();
  if (!sourceEntity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });

  const sourceRecord = sourceEntity as Record<string, unknown>;

  const otherTypes: GraphEntityType[] = GRAPH_ENTITY_TYPES.filter((t) => t !== parsed.data.entityType);
  const perTypeSample = Math.max(3, Math.floor(MAX_CANDIDATES / otherTypes.length));

  const candidateGroups = await Promise.all(
    otherTypes.map(async (type) => {
      const { table, titleColumn } = GRAPH_ENTITY_TABLE[type];
      const { data } = await supabase.from(table).select(`id, ${titleColumn}` as "id").limit(perTypeSample);
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        entityType: type,
        entityId: row.id as string,
        label: row[titleColumn] as string,
      }));
    })
  );
  const candidates = candidateGroups.flat().slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No candidate entities exist yet to suggest connections to" }, { status: 422 });
  }

  try {
    const result = await runAIFunction<SuggestGraphConnectionsOutput>(supabase, {
      functionId: "suggest_graph_connections",
      publicationId: membership.publication_id,
      actorId: user.id,
      input: {
        sourceEntityType: parsed.data.entityType,
        sourceLabel: sourceRecord[sourceTitleColumn] as string,
        sourceDescription: sourceRecord.description as string | undefined,
        candidates,
        count: parsed.data.count,
      },
    });

    return NextResponse.json({ jobId: result.jobId, suggestions: result.output.suggestions, costUsd: result.costUsd });
  } catch (error) {
    logger.error("Suggest graph connections failed", { error, userId: user.id });
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: 502 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suggestion failed" }, { status: 500 });
  }
}

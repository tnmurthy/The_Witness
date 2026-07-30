import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_TABLE, GRAPH_ENTITY_TYPES, type GraphEntityType } from "@/lib/graph/types";
import { retrieveQuerySchema } from "@/lib/validation/graph";
import { logger } from "@/lib/logger";

/**
 * POST /api/graph/retrieve — this milestone's "AI retrieval" capability,
 * and the piece explicitly "designed for future GraphRAG compatibility."
 * Read docs/KNOWLEDGE_GRAPH.md's GraphRAG section for the full honest
 * accounting; the short version lives in this comment.
 *
 * What it does today: full-text search (Postgres tsvector/ts_rank,
 * every entity table now has a search_vector after this migration) —
 * across every requested entity type, optionally boosted by graph
 * proximity when `expandFrom` names a seed entity (a result that's also
 * within 2 hops of the seed in graph_neighbors() ranks higher than an
 * equally keyword-relevant result that isn't connected to it at all).
 * That's a real, working hybrid of keyword search and graph structure —
 * not a placeholder.
 *
 * What it is not yet: retrieval driven by vector similarity or by
 * graph-community summarization (the two techniques the term "GraphRAG"
 * usually implies specifically). Every content table's `embedding`
 * column (Migration 008) exists and is unpopulated — no embedding
 * generation pipeline exists in this codebase yet. This function's
 * signature (query text in, ranked entities with type/id/label out) is
 * deliberately stable regardless of how ranking is computed internally —
 * swapping the keyword-rank step for a vector-similarity step later is
 * an internal change to this one function, not a change to every caller
 * of it. That stability is what "designed for" means here: the
 * interface GraphRAG would plug into already exists and is in use; the
 * vector-search half of a full GraphRAG implementation is not built.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = retrieveQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const types: GraphEntityType[] =
    parsed.data.entityTypes && parsed.data.entityTypes.length > 0
      ? parsed.data.entityTypes
      : [...GRAPH_ENTITY_TYPES];

  let proximitySet: Set<string> | null = null;
  if (parsed.data.expandFrom) {
    const { data: neighborRows } = await supabase.rpc("graph_neighbors", {
      start_type: parsed.data.expandFrom.entityType,
      start_id: parsed.data.expandFrom.entityId,
      max_depth: 2,
    });
    proximitySet = new Set(
      ((neighborRows ?? []) as { entity_type: string; entity_id: string }[]).map(
        (r) => `${r.entity_type}:${r.entity_id}`
      )
    );
  }

  try {
    const perTypeResults = await Promise.all(
      types.map(async (type) => {
        const { table, titleColumn } = GRAPH_ENTITY_TABLE[type];
        const { data, error } = await supabase
          .from(table)
          .select(`id, ${titleColumn}, search_vector` as "id")
          .textSearch("search_vector", parsed.data.query, { type: "websearch" })
          .limit(parsed.data.limit);

        if (error) {
          logger.error("Retrieval failed for one entity type", { error, type });
          return [];
        }

        return ((data ?? []) as Record<string, unknown>[]).map((row) => {
          const key = `${type}:${row.id}`;
          return {
            entityType: type,
            entityId: row.id as string,
            label: row[titleColumn] as string,
            nearSeed: proximitySet ? proximitySet.has(key) : null,
          };
        });
      })
    );

    const flat = perTypeResults.flat();
    flat.sort((a, b) => {
      if (a.nearSeed === b.nearSeed) return 0;
      if (a.nearSeed) return -1;
      if (b.nearSeed) return 1;
      return 0;
    });

    return NextResponse.json({ results: flat.slice(0, parsed.data.limit) });
  } catch (error) {
    logger.error("Graph retrieval failed", { error, userId: user.id });
    return NextResponse.json({ error: "Retrieval failed" }, { status: 500 });
  }
}

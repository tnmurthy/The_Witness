import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_TABLE, GRAPH_ENTITY_TYPES, type GraphEntityType } from "@/lib/graph/types";
import { logger } from "@/lib/logger";

/**
 * GET /api/graph/entities?type=&search=&limit=
 *
 * Every consumer that needs "find an entity to link to" (the graph
 * explorer, the edge-creation form, the retrieval endpoint's
 * `expandFrom` picker) goes through this one route rather than each
 * knowing about 13 different tables — the entity-search counterpart to
 * graph_neighbors() normalizing 4 different join patterns into one
 * traversal function.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const search = searchParams.get("search");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  const types: GraphEntityType[] =
    typeParam && (GRAPH_ENTITY_TYPES as readonly string[]).includes(typeParam)
      ? [typeParam as GraphEntityType]
      : [...GRAPH_ENTITY_TYPES];

  try {
    const results = await Promise.all(
      types.map(async (type) => {
        const { table, titleColumn } = GRAPH_ENTITY_TABLE[type];
        // Supabase's query builder statically parses the .select()
        // string to infer column types; a template-string column name
        // (genuinely dynamic here, since `type` varies per iteration)
        // can't be resolved that way and produces a ParserError type,
        // not a runtime error. Casting the select string is the correct
        // escape hatch for a column list that's only known at runtime.
        let query = supabase
          .from(table)
          .select(`id, ${titleColumn}` as "id")
          .limit(limit);
        if (search) query = query.ilike(titleColumn, `%${search}%`);

        const { data, error } = await query;
        if (error) {
          logger.error("Entity search failed for one type", { error, type });
          return [];
        }
        return (data ?? []).map((row: Record<string, unknown>) => ({
          entityType: type,
          entityId: row.id as string,
          label: row[titleColumn] as string,
        }));
      })
    );

    const flat = results.flat().slice(0, limit);
    return NextResponse.json({ entities: flat });
  } catch (error) {
    logger.error("Entity search failed", { error, userId: user.id });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

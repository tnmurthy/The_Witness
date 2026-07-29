import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_TABLE, GRAPH_ENTITY_TYPES, type GraphEntityType } from "@/lib/graph/types";
import { neighborsQuerySchema } from "@/lib/validation/graph";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ type: string; id: string }>;
}

interface NeighborRow {
  entity_type: string;
  entity_id: string;
  depth: number;
  relation_type: string | null;
  via_type: string | null;
  via_id: string | null;
}

/**
 * GET /api/graph/nodes/[type]/[id]/neighbors?depth=
 *
 * Calls graph_neighbors() (Migration 019) for the raw traversal, then
 * hydrates each returned (type, id) pair with its actual label by
 * querying that type's own table — the SQL function deliberately returns
 * only ids and types (see its own comment: doing otherwise would mean
 * re-deriving every entity table's shape inside one giant SQL function,
 * duplicating what src/lib/graph/types.ts already knows in TypeScript).
 * RLS on each underlying table still applies to these per-type lookups.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { type, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(GRAPH_ENTITY_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 422 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = neighborsQuerySchema.safeParse({ depth: searchParams.get("depth") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: rows, error } = await supabase.rpc("graph_neighbors", {
    start_type: type,
    start_id: id,
    max_depth: parsed.data.depth,
  });

  if (error) {
    logger.error("graph_neighbors RPC failed", { error, type, id });
    return NextResponse.json({ error: "Failed to load neighbors" }, { status: 500 });
  }

  const neighborRows = (rows ?? []) as NeighborRow[];

  const idsByType = new Map<GraphEntityType, Set<string>>();
  for (const row of neighborRows) {
    const t = row.entity_type as GraphEntityType;
    if (!idsByType.has(t)) idsByType.set(t, new Set());
    idsByType.get(t)!.add(row.entity_id);
  }

  const labelById = new Map<string, string>();
  await Promise.all(
    Array.from(idsByType.entries()).map(async ([t, ids]) => {
      const { table, titleColumn } = GRAPH_ENTITY_TABLE[t];
      const { data } = await supabase
        .from(table)
        .select(`id, ${titleColumn}` as "id")
        .in("id", Array.from(ids));
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        labelById.set(`${t}:${row.id}`, row[titleColumn] as string);
      }
    })
  );

  const neighbors = neighborRows.map((row) => ({
    entityType: row.entity_type,
    entityId: row.entity_id,
    label: labelById.get(`${row.entity_type}:${row.entity_id}`) ?? "(untitled)",
    depth: row.depth,
    relationType: row.relation_type,
    via: row.via_type && row.via_id ? { entityType: row.via_type, entityId: row.via_id } : null,
  }));

  return NextResponse.json({ neighbors });
}

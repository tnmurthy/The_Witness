import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_TABLE, GRAPH_ENTITY_TYPES, GRAPH_ENTITY_LABELS, type GraphEntityType } from "@/lib/graph/types";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ type: string; id: string }>;
}

const MAX_PER_GROUP = 5;

/**
 * GET /api/graph/nodes/[type]/[id]/related — "Related Content" for
 * direct display (an article's related-technologies widget, a company
 * profile's related-people section), not raw traversal data. Always
 * depth 1 (direct connections only) and grouped by entity type with a
 * cap per group, since that's how this data actually gets rendered: a
 * set of small labeled sections, not one flat list. /neighbors (this
 * same directory's sibling route) is the general-purpose navigation
 * primitive this route is built on top of.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { type, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(GRAPH_ENTITY_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Unknown entity type" }, { status: 422 });
  }

  const { data: rows, error } = await supabase.rpc("graph_neighbors", { start_type: type, start_id: id, max_depth: 1 });

  if (error) {
    logger.error("graph_neighbors RPC failed for related-content", { error, type, id });
    return NextResponse.json({ error: "Failed to load related content" }, { status: 500 });
  }

  type Row = { entity_type: string; entity_id: string; relation_type: string | null };
  const neighborRows = (rows ?? []) as Row[];

  const idsByType = new Map<GraphEntityType, string[]>();
  for (const row of neighborRows) {
    const t = row.entity_type as GraphEntityType;
    const list = idsByType.get(t) ?? [];
    if (list.length < MAX_PER_GROUP) list.push(row.entity_id);
    idsByType.set(t, list);
  }

  const groups = await Promise.all(
    Array.from(idsByType.entries()).map(async ([t, ids]) => {
      const { table, titleColumn } = GRAPH_ENTITY_TABLE[t];
      const { data } = await supabase.from(table).select(`id, ${titleColumn}` as "id").in("id", ids);
      const items = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        entityId: row.id as string,
        label: row[titleColumn] as string,
      }));
      return { entityType: t, label: GRAPH_ENTITY_LABELS[t], items };
    })
  );

  return NextResponse.json({ groups: groups.filter((g) => g.items.length > 0) });
}

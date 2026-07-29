import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEdgeSchema } from "@/lib/validation/graph";
import { logger } from "@/lib/logger";

/**
 * POST /api/graph/edges — manually create a Knowledge Graph edge.
 * relationType is validated against the same constrained vocabulary the
 * database CHECK constraint enforces (src/lib/graph/types.ts mirrors
 * Migration 019's list exactly) — this route's own validation exists to
 * return a clean 422 with the specific issue, rather than surfacing the
 * database's raw constraint-violation error to the caller.
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

  const body = await request.json().catch(() => null);
  const parsed = createEdgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: edge, error } = await supabase
    .from("knowledge_graph_edges")
    .insert({
      source_type: parsed.data.sourceType,
      source_id: parsed.data.sourceId,
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      relation_type: parsed.data.relationType,
      created_by: user.id,
    })
    .select("id, source_type, source_id, target_type, target_id, relation_type")
    .single();

  if (error || !edge) {
    const status = error?.code === "23505" ? 409 : 500;
    logger.error("Failed to create graph edge", { error, userId: user.id });
    return NextResponse.json(
      { error: error?.code === "23505" ? "That connection already exists" : "Failed to create connection" },
      { status }
    );
  }

  return NextResponse.json({ edge }, { status: 201 });
}

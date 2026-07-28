import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET — the issue plus its full section/block tree, ordered by position.
 * Fetched once on page load; every subsequent change flows through the
 * dedicated sections/blocks routes and the Zustand store's optimistic
 * updates (src/lib/stores/issue-builder-store.ts) — this route is not
 * re-polled during normal editing.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: issue, error } = await supabase
    .from("issues")
    .select("id, publication_id, title, slug, status, scheduled_at, published_at, created_by, publications(name, slug)")
    .eq("id", id)
    .single();

  if (error || !issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const { data: sections } = await supabase
    .from("sections")
    .select("id, issue_id, title, position")
    .eq("issue_id", id)
    .order("position");

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, section_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
    .eq("issue_id", id)
    .order("position");

  return NextResponse.json({ issue, sections: sections ?? [], blocks: blocks ?? [] });
}

/**
 * PATCH — title rename only. Status transitions (draft -> in_review ->
 * scheduled -> published) belong to the Milestone 10 publish flow, not
 * this route.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 422 });
  }

  const { data: issue, error } = await supabase
    .from("issues")
    .update({ title: body.title.trim() })
    .eq("id", id)
    .select("id, title")
    .single();

  if (error || !issue) {
    logger.error("Failed to update issue title", { error, issueId: id });
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }

  return NextResponse.json({ issue });
}

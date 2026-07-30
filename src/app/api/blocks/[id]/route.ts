import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { updateBlockSchema } from "@/lib/validation/issue-builder";
import { validateBlockPayload } from "@/lib/blocks/schemas";
import { isImplementedBlockType } from "@/lib/blocks/types";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH — the autosave target (src/components/issue-builder/block-card.tsx
 * debounces calls here). Accepts a partial update: payload-only for a
 * content edit, position/sectionId for a drag-and-drop move, or both.
 * last_edited_by is stamped explicitly with the caller's id (not resolved
 * from auth.uid() by a trigger) so the same column works whether the
 * write comes from an authenticated user's session or, in a later
 * milestone, the AI Workspace acting through the service role.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("blocks")
    .select("issue_id, type")
    .eq("id", blockId)
    .single();
  if (!existing?.issue_id) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (!(await canEditIssue(supabase, existing.issue_id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  if (parsed.data.payload !== undefined && isImplementedBlockType(existing.type)) {
    const validation = validateBlockPayload(existing.type, parsed.data.payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }
  }

  const update: Record<string, unknown> = { last_edited_by: user.id };
  if (parsed.data.payload !== undefined) update.payload = parsed.data.payload;
  if (parsed.data.position !== undefined) update.position = parsed.data.position;
  if (parsed.data.sectionId !== undefined) update.section_id = parsed.data.sectionId;

  const { data: block, error } = await supabase
    .from("blocks")
    .update(update)
    .eq("id", blockId)
    .select("id, section_id, issue_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
    .single();

  if (error || !block) {
    logger.error("Failed to update block", { error, blockId });
    return NextResponse.json({ error: "Failed to save block" }, { status: 500 });
  }

  return NextResponse.json({ block });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase.from("blocks").select("issue_id").eq("id", blockId).single();
  if (!existing?.issue_id) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (!(await canEditIssue(supabase, existing.issue_id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("blocks").delete().eq("id", blockId);

  if (error) {
    logger.error("Failed to delete block", { error, blockId });
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

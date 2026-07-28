import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { createBlockSchema } from "@/lib/validation/issue-builder";
import { validateBlockPayload } from "@/lib/blocks/schemas";
import { isImplementedBlockType } from "@/lib/blocks/types";
import { BLOCK_REGISTRY } from "@/lib/blocks/registry";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/sections/[id]/blocks — create a block within a section. The
 * payload is validated against its type's schema (src/lib/blocks/
 * schemas.ts) before insert; an empty payload (the common case — a
 * freshly inserted block the user hasn't filled in yet) is allowed
 * through as the block type's registered defaultPayload rather than
 * being rejected, since blocks_payload_is_object (Migration 004) only
 * requires *an object*, and a block mid-edit is a normal, expected state
 * for a Notion-style canvas, not an error condition.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: sectionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: section } = await supabase.from("sections").select("issue_id").eq("id", sectionId).single();
  if (!section?.issue_id) {
    return NextResponse.json({ error: "Section not found (or belongs to an article, not an issue)" }, { status: 404 });
  }

  if (!(await canEditIssue(supabase, section.issue_id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  let payload = parsed.data.payload;
  if (isImplementedBlockType(parsed.data.type)) {
    const isEmpty = Object.keys(payload).length === 0;
    payload = isEmpty ? (BLOCK_REGISTRY[parsed.data.type].defaultPayload as Record<string, unknown>) : payload;

    if (!isEmpty) {
      const validation = validateBlockPayload(parsed.data.type, payload);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: 422 });
      }
    }
  }

  let position = parsed.data.position;
  if (position === undefined) {
    const { count } = await supabase.from("blocks").select("id", { count: "exact", head: true }).eq("section_id", sectionId);
    position = count ?? 0;
  }

  const { data: block, error } = await supabase
    .from("blocks")
    .insert({ section_id: sectionId, type: parsed.data.type, payload, position, created_by: user.id, last_edited_by: user.id })
    .select("id, section_id, issue_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
    .single();

  if (error || !block) {
    logger.error("Failed to create block", { error, sectionId });
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
  }

  return NextResponse.json({ block }, { status: 201 });
}

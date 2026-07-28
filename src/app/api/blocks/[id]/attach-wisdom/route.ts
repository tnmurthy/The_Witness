import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { todaysWisdomPayloadSchema } from "@/lib/blocks/schemas";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({ wisdomEntryId: z.string().uuid() });

/**
 * POST /api/blocks/[id]/attach-wisdom — the editorial integration this
 * milestone's brief asks for: populates a todays_wisdom block's payload
 * from a curated Wisdom Engine entry, instead of an editor re-typing
 * Sanskrit/IAST/translation/context by hand into the block editor
 * (which the Milestone 5 Today's Wisdom block still supports directly,
 * for a one-off quote that isn't in the library). Only an approved
 * wisdom entry can be attached — this is the application-layer
 * enforcement 006_wisdom_engine.sql's own table comment on
 * wisdom_entries refers to ("enforced at the application layer... see
 * also can_attach_wisdom_entry()"); no such database function exists
 * (confirmed — it's documented as an app-layer rule, not a DB one), so
 * this route is where that rule actually lives.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: blockId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: block } = await supabase.from("blocks").select("issue_id, type").eq("id", blockId).single();
  if (!block?.issue_id) return NextResponse.json({ error: "Block not found" }, { status: 404 });
  if (block.type !== "todays_wisdom") {
    return NextResponse.json({ error: "This block is not a Today's Wisdom block" }, { status: 422 });
  }

  if (!(await canEditIssue(supabase, block.issue_id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: entry } = await supabase
    .from("wisdom_entries")
    .select("id, source_text, iast, translation, context, review_status, references_json")
    .eq("id", parsed.data.wisdomEntryId)
    .single();

  if (!entry) return NextResponse.json({ error: "Wisdom entry not found" }, { status: 404 });
  if (entry.review_status !== "approved") {
    return NextResponse.json({ error: "Only approved wisdom entries can be attached to a block" }, { status: 422 });
  }

  const referencesList = entry.references_json as unknown as { label?: string }[] | null;
  const sourceLabel = referencesList?.[0]?.label;

  const payload = todaysWisdomPayloadSchema.parse({
    sourceText: entry.source_text ?? undefined,
    iast: entry.iast ?? undefined,
    translation: entry.translation,
    context: entry.context ?? undefined,
    source: sourceLabel,
    wisdomEntryId: entry.id,
  });

  const { data: updatedBlock, error } = await supabase
    .from("blocks")
    .update({ payload, last_edited_by: user.id })
    .eq("id", blockId)
    .select("id, section_id, issue_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
    .single();

  if (error || !updatedBlock) {
    logger.error("Failed to attach wisdom entry to block", { error, blockId });
    return NextResponse.json({ error: "Failed to attach wisdom entry" }, { status: 500 });
  }

  return NextResponse.json({ block: updatedBlock });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string; revisionId: string }>;
}

interface SnapshotSection {
  id: string;
  title: string | null;
  position: number;
}
interface SnapshotBlock {
  id: string;
  section_id: string;
  type: string;
  position: number;
  payload: Record<string, unknown>;
}

/**
 * POST — restores an issue to a prior snapshot. Deliberately NOT a
 * destructive in-place overwrite of history: restoring first creates a
 * fresh revision capturing the *current* (pre-restore) state, so
 * "restore to an old version" is itself an undoable action rather than a
 * one-way door — the current state is never lost, only superseded.
 *
 * Reconciles rather than delete-and-recreate: sections/blocks whose ids
 * still exist in the current tree are updated in place; ones that existed
 * in the snapshot but were since deleted are recreated with a new id
 * (the old id may have been reused for something else in Postgres's id
 * space in principle, though practically never); ones that exist now but
 * didn't exist in the snapshot are deleted. This keeps Realtime
 * broadcasts meaningful (other clients see UPDATE/INSERT/DELETE events
 * matching what actually changed) rather than one wholesale
 * delete-everything-then-recreate-everything event storm.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: issueId, revisionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, issueId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: revision } = await supabase
    .from("issue_revisions")
    .select("snapshot")
    .eq("id", revisionId)
    .eq("issue_id", issueId)
    .single();

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const snapshot = revision.snapshot as { sections: SnapshotSection[]; blocks: SnapshotBlock[] };

  // Checkpoint the pre-restore state first — see the function comment above.
  const { data: currentSections } = await supabase.from("sections").select("id, title, position").eq("issue_id", issueId).order("position");
  const { data: currentBlocks } = await supabase
    .from("blocks")
    .select("id, section_id, type, position, payload")
    .eq("issue_id", issueId)
    .order("position");
  await supabase.from("issue_revisions").insert({
    issue_id: issueId,
    snapshot: { sections: currentSections ?? [], blocks: currentBlocks ?? [], label: "Before restore" },
    created_by: user.id,
  });

  const currentSectionIds = new Set((currentSections ?? []).map((s) => s.id));
  const snapshotSectionIds = new Set(snapshot.sections.map((s) => s.id));

  for (const section of snapshot.sections) {
    if (currentSectionIds.has(section.id)) {
      await supabase.from("sections").update({ title: section.title, position: section.position }).eq("id", section.id);
    } else {
      await supabase.from("sections").insert({ id: section.id, issue_id: issueId, title: section.title, position: section.position });
    }
  }
  for (const section of currentSections ?? []) {
    if (!snapshotSectionIds.has(section.id)) {
      await supabase.from("sections").delete().eq("id", section.id);
    }
  }

  const currentBlockIds = new Set((currentBlocks ?? []).map((b) => b.id));
  const snapshotBlockIds = new Set(snapshot.blocks.map((b) => b.id));

  for (const block of snapshot.blocks) {
    if (currentBlockIds.has(block.id)) {
      await supabase
        .from("blocks")
        .update({ section_id: block.section_id, type: block.type, position: block.position, payload: block.payload, last_edited_by: user.id })
        .eq("id", block.id);
    } else {
      await supabase.from("blocks").insert({
        id: block.id,
        section_id: block.section_id,
        type: block.type,
        position: block.position,
        payload: block.payload,
        created_by: user.id,
        last_edited_by: user.id,
      });
    }
  }
  for (const block of currentBlocks ?? []) {
    if (!snapshotBlockIds.has(block.id)) {
      await supabase.from("blocks").delete().eq("id", block.id);
    }
  }

  logger.info("Issue restored from revision", { issueId, revisionId, actorId: user.id });

  return NextResponse.json({ ok: true });
}

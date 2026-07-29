import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { createRevisionSchema } from "@/lib/validation/issue-builder";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET — revision history, newest first.
 * POST — create a snapshot capturing the full current section/block tree
 *        as one immutable jsonb blob (issue_revisions.snapshot,
 *        Migration 004). Two ways a revision gets created:
 *          1. Explicitly, via this route, when the user clicks "Save
 *             version" (a deliberate checkpoint, optionally labeled).
 *          2. Automatically, from the autosave path
 *             (src/components/issue-builder/block-card.tsx), but at most
 *             once every 5 minutes per issue — see the throttle check
 *             below. Snapshotting on every autosave (which fires on
 *             every debounced keystroke pause) would flood
 *             issue_revisions with a near-continuous history that isn't
 *             actually useful as "versions" a person would want to
 *             browse or restore; see docs/ISSUE_BUILDER.md, "Why
 *             snapshots are throttled."
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("issue_revisions")
    .select("id, issue_id, created_by, created_at, snapshot, profiles(full_name)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to list revisions", { error, issueId });
    return NextResponse.json({ error: "Failed to load revisions" }, { status: 500 });
  }

  // snapshot omitted from the list response (list-view only needs
  // metadata; the full tree is fetched on demand when previewing/
  // restoring a specific revision, via GET .../revisions/[revisionId]
  // in a future iteration of this route if the payload size warrants it
  // — currently returned in-line below since issue snapshots are small
  // enough not to matter yet).
  return NextResponse.json({ revisions: data });
}

const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000;

async function buildSnapshot(supabase: Awaited<ReturnType<typeof createClient>>, issueId: string) {
  const { data: sections } = await supabase
    .from("sections")
    .select("id, title, position")
    .eq("issue_id", issueId)
    .order("position");
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, section_id, type, position, payload")
    .eq("issue_id", issueId)
    .order("position");
  return { sections: sections ?? [], blocks: blocks ?? [] };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, issueId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createRevisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const isAutomatic = request.headers.get("x-revision-source") === "autosave";
  if (isAutomatic) {
    const { data: latest } = await supabase
      .from("issue_revisions")
      .select("created_at")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && Date.now() - new Date(latest.created_at).getTime() < SNAPSHOT_THROTTLE_MS) {
      return NextResponse.json({ skipped: true, reason: "throttled" });
    }
  }

  const snapshot = { ...(await buildSnapshot(supabase, issueId)), label: parsed.data.label ?? null };

  const { data: revision, error } = await supabase
    .from("issue_revisions")
    .insert({ issue_id: issueId, snapshot, created_by: user.id })
    .select("id, created_at")
    .single();

  if (error || !revision) {
    logger.error("Failed to create revision", { error, issueId });
    return NextResponse.json({ error: "Failed to create revision" }, { status: 500 });
  }

  return NextResponse.json({ revision }, { status: 201 });
}

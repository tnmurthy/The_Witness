import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { reorderBlocksSchema } from "@/lib/validation/issue-builder";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/[id]/reorder — one call per drag-and-drop drop event,
 * updating every affected block's position (and section_id, for a
 * cross-section move) in a single request instead of one PATCH per
 * displaced block.
 *
 * Not wrapped in an explicit database transaction — Supabase's REST/JS
 * client doesn't expose multi-statement transactions directly, and a
 * partial failure here is self-healing on the next successful reorder or
 * page reload, since position is only ever read relative to other
 * blocks in the same section, not compared globally.
 */
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

  const body = await request.json().catch(() => null);
  const parsed = reorderBlocksSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const results = await Promise.all(
    parsed.data.blocks.map(({ id, sectionId, position }) =>
      supabase
        .from("blocks")
        .update({ section_id: sectionId, position, last_edited_by: user.id })
        .eq("id", id)
    )
  );

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    logger.error("Some blocks failed to reorder", {
      issueId,
      failedCount: failed.length,
      errors: failed.map((f) => f.error),
    });
    return NextResponse.json(
      { error: "Some blocks failed to reorder", failedCount: failed.length },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

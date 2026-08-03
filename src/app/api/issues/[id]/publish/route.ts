/**
 * POST /api/issues/[id]/publish
 *
 * The publish endpoint — the most important missing route in the platform.
 * Transitions an issue from draft/in_review/scheduled to published and
 * triggers email delivery to all active subscribers.
 *
 * Authorization: editor_in_chief or editor membership on the publication,
 * or super_admin. Writers cannot publish their own issues.
 *
 * Body: optional { scheduled_at: ISO string } — if present, schedules
 * the issue rather than publishing immediately.
 *
 * Returns: { issue, delivery } where delivery contains sent/failed counts.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { deliverIssueToSubscribers } from "@/lib/email/delivery-service";
import { isEmailConfigured } from "@/lib/email/resend-client";
import { z } from "zod";

const bodySchema = z.object({
  scheduled_at: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse body (optional)
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 422 });
  }

  // Fetch issue + check it exists
  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, slug, status, publication_id, publications(name, slug)")
    .eq("id", id)
    .single();

  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  // Only editor-or-above can publish
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const isSuperAdmin = profile?.role === "super_admin";

  if (!isSuperAdmin) {
    const { data: membership } = await supabase
      .from("publication_members")
      .select("role")
      .eq("publication_id", issue.publication_id)
      .eq("user_id", user.id)
      .single();

    const role = membership?.role;
    if (role !== "editor_in_chief" && role !== "editor") {
      return NextResponse.json(
        { error: "Only editors and editors-in-chief can publish issues" },
        { status: 403 }
      );
    }
  }

  // Guard: can't re-publish an already published issue
  if (issue.status === "published") {
    return NextResponse.json({ error: "Issue is already published" }, { status: 409 });
  }

  const admin = createAdminClient();
  const scheduledAt = parsed.data.scheduled_at;

  // Scheduled publish path
  if (scheduledAt) {
    await admin.from("issues").update({ status: "scheduled", scheduled_at: scheduledAt }).eq("id", id);

    await admin.from("scheduled_jobs").insert({
      issue_id: id,
      run_at: scheduledAt,
    });

    logger.info("Issue scheduled for publish", { issueId: id, scheduledAt, userId: user.id });
    return NextResponse.json({ issue: { ...issue, status: "scheduled", scheduled_at: scheduledAt } });
  }

  // Immediate publish path
  const { data: updatedIssue, error: updateErr } = await admin
    .from("issues")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title, slug, status, published_at, publication_id")
    .single();

  if (updateErr || !updatedIssue) {
    logger.error("Failed to update issue status to published", { error: updateErr, issueId: id });
    return NextResponse.json({ error: "Failed to publish issue" }, { status: 500 });
  }

  // Deliver emails
  let delivery = { total: 0, sent: 0, failed: 0, skipped: 0 };
  if (isEmailConfigured()) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thewitness.app";
      delivery = await deliverIssueToSubscribers(admin, id, siteUrl);
    } catch (err) {
      // Email failure should not un-publish the issue — log and continue
      logger.error("Email delivery failed after publish", {
        error: err instanceof Error ? err.message : String(err),
        issueId: id,
      });
    }
  } else {
    logger.warn("RESEND_API_KEY not configured — issue published without email delivery", { issueId: id });
  }

  logger.info("Issue published", { issueId: id, userId: user.id, delivery });
  return NextResponse.json({ issue: updatedIssue, delivery });
}

/**
 * POST /api/issues/[id]/publish with status=in_review
 * Actually this is handled separately as submit-for-review.
 * DELETE here reverts to draft (editor action: "request changes")
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: issue } = await supabase
    .from("issues")
    .select("id, publication_id, status")
    .eq("id", id)
    .single();

  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", issue.publication_id)
    .eq("user_id", user.id)
    .single();

  if (!["editor_in_chief", "editor"].includes(membership?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin.from("issues").update({ status: "in_review" }).eq("id", id);

  return NextResponse.json({ issue: { ...issue, status: "in_review" } });
}

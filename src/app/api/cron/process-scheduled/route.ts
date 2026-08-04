/**
 * POST /api/cron/process-scheduled
 *
 * Vercel Cron — runs every 5 minutes to process scheduled_jobs.
 * Finds issues due for publishing, calls the publish logic, marks jobs done.
 *
 * This closes the PM v1.1 item: scheduled publish was UI-complete but
 * the pg_cron execution was not wired.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverIssueToSubscribers } from "@/lib/email/delivery-service";
import { isEmailConfigured } from "@/lib/email/resend-client";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Find jobs due to run (run_at <= now, not yet processed)
  const { data: jobs } = await admin
    .from("scheduled_jobs")
    .select("id, issue_id")
    .lte("run_at", now)
    .is("processed_at", null)
    .limit(20);

  if (!jobs?.length) {
    return NextResponse.json({ processed: 0, message: "No scheduled jobs due" });
  }

  let published = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      // Mark as processing first (prevent double-execution)
      await admin.from("scheduled_jobs").update({ completed_at: now }).eq("id", job.id);

      // Update issue status to published
      const { data: issue, error: issueErr } = await admin
        .from("issues")
        .update({ status: "published", published_at: now })
        .eq("id", job.issue_id)
        .eq("status", "scheduled") // only publish if still scheduled
        .select("id, title, publication_id")
        .single();

      if (issueErr || !issue) {
        logger.warn("Scheduled publish skipped — issue not in scheduled state", {
          jobId: job.id,
          issueId: job.issue_id,
        });
        continue;
      }

      // Deliver to subscribers
      if (isEmailConfigured()) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thewitness.app";
        const delivery = await deliverIssueToSubscribers(admin, issue.id, siteUrl);
        logger.info("Scheduled issue published and delivered", {
          issueId: issue.id,
          title: issue.title,
          delivery,
        });
      } else {
        logger.warn("Scheduled issue published without email — RESEND_API_KEY not set", {
          issueId: issue.id,
        });
      }

      published++;
    } catch (err) {
      logger.error("Scheduled publish failed", {
        jobId: job.id,
        issueId: job.issue_id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  return NextResponse.json({ processed: jobs.length, published, failed });
}

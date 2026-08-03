/**
 * src/lib/email/delivery-service.ts
 *
 * Orchestrates the full publish-to-subscribers flow:
 *   1. Resolve active subscribers for the publication
 *   2. Render the issue as HTML email
 *   3. Create delivery_logs rows (queued)
 *   4. Send via Resend, batched at 50/call (Resend batch limit)
 *   5. Update delivery_logs with sent/failed status
 *
 * Called from POST /api/issues/[id]/publish.
 * Designed to be idempotent: if a delivery_log already exists for a
 * (issue_id, subscriber_id) pair, that subscriber is skipped — safe to
 * retry a partial send without double-sending.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getResendClient } from "./resend-client";
import { renderIssueEmail } from "./render-issue";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 50;

export interface DeliveryResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function deliverIssueToSubscribers(
  adminClient: SupabaseClient,
  issueId: string,
  siteUrl: string
): Promise<DeliveryResult> {
  // ── 1. Fetch issue + publication ───────────────────────────────────────
  const { data: issue, error: issueErr } = await adminClient
    .from("issues")
    .select("id, title, slug, publication_id, publications(id, name, slug, description)")
    .eq("id", issueId)
    .single();

  if (issueErr || !issue) {
    throw new Error(`Issue ${issueId} not found: ${issueErr?.message}`);
  }

  const pub = Array.isArray(issue.publications) ? issue.publications[0] : issue.publications;
  if (!pub) throw new Error("Publication not found for issue");

  // ── 2. Fetch blocks ────────────────────────────────────────────────────
  const { data: blocks } = await adminClient
    .from("blocks")
    .select("type, payload, ai_generated")
    .eq("issue_id", issueId)
    .order("position");

  // ── 3. Fetch active subscribers (skip already-attempted) ───────────────
  const { data: existing } = await adminClient
    .from("delivery_logs")
    .select("subscriber_id")
    .eq("issue_id", issueId)
    .eq("channel", "email");

  const alreadyAttempted = new Set((existing ?? []).map((r) => r.subscriber_id));

  const { data: subscriptions } = await adminClient
    .from("subscriptions")
    .select("subscriber_id, subscribers(id, email)")
    .eq("publication_id", pub.id)
    .eq("status", "active");

  const targets = (subscriptions ?? [])
    .map((s) => {
      const sub = Array.isArray(s.subscribers) ? s.subscribers[0] : s.subscribers;
      return sub ? { id: sub.id, email: sub.email } : null;
    })
    .filter((s): s is { id: string; email: string } => s !== null && !alreadyAttempted.has(s.id));

  if (targets.length === 0) {
    return { total: 0, sent: 0, failed: 0, skipped: alreadyAttempted.size };
  }

  // ── 4. Render email ────────────────────────────────────────────────────
  const webUrl = `${siteUrl}/p/${pub.slug}/${issue.slug}`;
  const resend = getResendClient();
  const senderEmail =
    process.env.EMAIL_FROM ?? `noreply@${process.env.EMAIL_DOMAIN ?? "updates.thewitness.app"}`;
  const senderName = process.env.EMAIL_FROM_NAME ?? pub.name;

  // ── 5. Insert delivery_logs (queued) ────────────────────────────────────
  const logRows = targets.map((t) => ({
    issue_id: issueId,
    subscriber_id: t.id,
    channel: "email" as const,
    status: "queued" as const,
  }));

  await adminClient.from("delivery_logs").insert(logRows);

  // ── 6. Send in batches ─────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (subscriber) => {
        const unsubUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(
          Buffer.from(`${subscriber.id}:${pub.id}`).toString("base64")
        )}`;

        const { html, text } = renderIssueEmail({
          issue,
          publication: pub,
          blocks: (blocks ?? []) as Parameters<typeof renderIssueEmail>[0]["blocks"],
          unsubscribeUrl: unsubUrl,
          webUrl,
        });

        const { error } = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: subscriber.email,
          subject: issue.title,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (error) throw new Error(error.message);
        return subscriber.id;
      })
    );

    const successIds: string[] = [];
    const failedIds: string[] = [];

    batchResults.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        successIds.push(batch[idx]!.id);
        sent++;
      } else {
        failedIds.push(batch[idx]!.id);
        failed++;
        logger.error("Email delivery failed", {
          subscriberId: batch[idx]!.id,
          issueId,
          error: result.reason?.message,
        });
      }
    });

    // Update delivery_log statuses
    if (successIds.length) {
      await adminClient
        .from("delivery_logs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("issue_id", issueId)
        .eq("channel", "email")
        .in("subscriber_id", successIds);
    }
    if (failedIds.length) {
      await adminClient
        .from("delivery_logs")
        .update({ status: "failed", error: "Resend API error" })
        .eq("issue_id", issueId)
        .eq("channel", "email")
        .in("subscriber_id", failedIds);
    }
  }

  logger.info("Issue delivery complete", {
    issueId,
    publicationId: pub.id,
    total: targets.length,
    sent,
    failed,
    skipped: alreadyAttempted.size,
  });

  return { total: targets.length, sent, failed, skipped: alreadyAttempted.size };
}

/**
 * POST /api/publications/[id]/subscribe
 * Public endpoint — no auth required. Creates a subscriber and subscription.
 * Sends a confirmation email via Resend.
 * Idempotent: re-subscribing a known email reactivates the subscription.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, getResendClient } from "@/lib/email/resend-client";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 422 });
  }

  const { email } = parsed.data;
  const admin = createAdminClient();

  // Verify publication exists and is active
  const { data: pub } = await admin
    .from("publications")
    .select("id, name, slug")
    .eq("id", id)
    .eq("status", "active")
    .single();

  if (!pub) return NextResponse.json({ error: "Publication not found" }, { status: 404 });

  // Upsert subscriber
  const { data: subscriber } = await admin
    .from("subscribers")
    .upsert({ email }, { onConflict: "email" })
    .select("id")
    .single();

  if (!subscriber) {
    return NextResponse.json({ error: "Could not create subscriber" }, { status: 500 });
  }

  // Upsert subscription (reactivate if previously unsubscribed)
  await admin.from("subscriptions").upsert(
    {
      subscriber_id: subscriber.id,
      publication_id: id,
      status: "active",
      subscribed_at: new Date().toISOString(),
    },
    { onConflict: "subscriber_id,publication_id" }
  );

  // Send welcome email
  if (isEmailConfigured()) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thewitness.app";
      const unsubUrl = `${siteUrl}/api/unsubscribe?token=${Buffer.from(`${subscriber.id}:${id}`).toString("base64")}`;
      const resend = getResendClient();
      const from = `${pub.name} <${process.env.EMAIL_FROM ?? `noreply@${process.env.EMAIL_DOMAIN ?? "updates.thewitness.app"}`}>`;

      await resend.emails.send({
        from,
        to: email,
        subject: `You're subscribed to ${pub.name}`,
        html: `<p>Thanks for subscribing to <strong>${pub.name}</strong>. You'll receive new issues by email.</p><p><a href="${unsubUrl}">Unsubscribe</a></p>`,
        text: `Thanks for subscribing to ${pub.name}. You'll receive new issues by email.\n\nUnsubscribe: ${unsubUrl}`,
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      });
    } catch (err) {
      logger.error("Welcome email failed", {
        email,
        publicationId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("New subscriber", { email, publicationId: id, subscriberId: subscriber.id });
  return NextResponse.json({ subscribed: true }, { status: 201 });
}

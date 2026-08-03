/**
 * GET /api/unsubscribe?token=BASE64
 * One-click unsubscribe. Works without authentication (CAN-SPAM / GDPR).
 * Token format: base64(subscriberId:publicationId)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [subscriberId, publicationId] = decoded.split(":");
    if (!subscriberId || !publicationId) throw new Error("Malformed token");

    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("subscriber_id", subscriberId)
      .eq("publication_id", publicationId);

    logger.info("Unsubscribed", { subscriberId, publicationId });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return NextResponse.redirect(`${siteUrl}/unsubscribed`, { status: 302 });
  } catch (err) {
    logger.error("Unsubscribe failed", { token, error: err instanceof Error ? err.message : String(err) });
    return new Response("Invalid unsubscribe token", { status: 400 });
  }
}

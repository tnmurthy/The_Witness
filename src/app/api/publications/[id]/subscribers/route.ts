/**
 * GET /api/publications/[id]/subscribers
 *
 * Returns subscriber list with delivery stats for editors.
 * EiC top complaint: no visibility into subscriber count or delivery health.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only editors+ can see subscriber data
  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", id)
    .eq("user_id", user.id)
    .single();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const canView =
    profile?.role === "super_admin" || ["editor_in_chief", "editor"].includes(membership?.role ?? "");

  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Subscriber count + recent subscribers
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("subscriber_id, subscribed_at, status, subscribers(email)")
    .eq("publication_id", id)
    .order("subscribed_at", { ascending: false })
    .limit(100);

  if (error) {
    logger.error("Failed to fetch subscribers", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }

  const active = subscriptions?.filter((s) => s.status === "active") ?? [];
  const unsubscribed = subscriptions?.filter((s) => s.status === "unsubscribed") ?? [];

  // Delivery stats from last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deliveryStats } = await supabase
    .from("delivery_logs")
    .select("status")
    .eq("channel", "email")
    .gte("created_at", since)
    .in(
      "issue_id",
      (
        await supabase.from("issues").select("id").eq("publication_id", id).eq("status", "published")
      ).data?.map((i) => i.id) ?? []
    );

  const sent = deliveryStats?.filter((d) => d.status === "sent").length ?? 0;
  const failed = deliveryStats?.filter((d) => d.status === "failed").length ?? 0;

  return NextResponse.json({
    total: active.length,
    unsubscribed: unsubscribed.length,
    subscribers: active.slice(0, 50).map((s) => ({
      id: s.subscriber_id,
      email: (Array.isArray(s.subscribers) ? s.subscribers[0] : s.subscribers)?.email,
      subscribedAt: s.subscribed_at,
    })),
    delivery30d: {
      sent,
      failed,
      rate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : null,
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Approval is Editor-in-Chief/Editor/Super Admin only — a Writer or
 * Researcher can author and submit a wisdom entry (submit-review/
 * route.ts) but cannot approve their own or anyone else's, matching the
 * same separation-of-duties pattern editorial content review follows
 * elsewhere.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role || !["super_admin", "editor_in_chief", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Only an editor can approve wisdom entries" }, { status: 403 });
  }

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .update({ review_status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, review_status")
    .single();

  if (error || !entry) {
    logger.error("Failed to approve wisdom entry", { error, entryId: id });
    return NextResponse.json({ error: "Failed to approve wisdom entry" }, { status: 500 });
  }

  return NextResponse.json({ entry });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role || !["super_admin", "editor_in_chief", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Only an editor can reject wisdom entries" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : null;

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .update({
      review_status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reason,
    })
    .eq("id", id)
    .select("id, review_status")
    .single();

  if (error || !entry) {
    logger.error("Failed to reject wisdom entry", { error, entryId: id });
    return NextResponse.json({ error: "Failed to reject wisdom entry" }, { status: 500 });
  }

  return NextResponse.json({ entry });
}

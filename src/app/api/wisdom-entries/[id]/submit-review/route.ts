import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: entry, error } = await supabase
    .from("wisdom_entries")
    .update({ review_status: "in_review" })
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id, review_status")
    .single();

  if (error || !entry) {
    logger.error("Failed to submit wisdom entry for review", { error, entryId: id, userId: user.id });
    return NextResponse.json(
      { error: "Failed to submit for review — you may not be its author" },
      { status: 403 }
    );
  }

  return NextResponse.json({ entry });
}

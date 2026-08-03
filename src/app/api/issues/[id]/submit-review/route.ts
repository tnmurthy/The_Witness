import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: updated, error } = await supabase
    .from("issues")
    .update({ status: "in_review" })
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id, status")
    .single();

  if (error || !updated) {
    logger.error("Failed to submit issue for review", { error, issueId: id, userId: user.id });
    return NextResponse.json({ error: "Not found or you are not the author" }, { status: 403 });
  }

  return NextResponse.json({ issue: updated });
}

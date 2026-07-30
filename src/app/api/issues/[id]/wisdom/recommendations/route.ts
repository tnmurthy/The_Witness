import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wisdom_recommendations")
    .select("id, score, rationale, created_at, wisdom_entries(id, title, translation, source_type)")
    .eq("issue_id", issueId)
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load recommendations" }, { status: 500 });
  }

  return NextResponse.json({ recommendations: data });
}

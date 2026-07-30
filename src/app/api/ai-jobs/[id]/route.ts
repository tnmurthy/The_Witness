import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ai-jobs/[id] — poll a single job's status. RLS
 * (ai_jobs_select_member, Migration 002/013) already restricts this to
 * publication members; a caller outside the publication gets a 404 the
 * same way an out-of-scope organization lookup does elsewhere in this
 * app (RLS returns zero rows rather than an error, which .single() then
 * surfaces as not-found — membership itself isn't leaked).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: job, error } = await supabase
    .from("ai_jobs")
    .select(
      "id, function_id, status, provider, model, result, token_usage, cost_usd, error, created_at, completed_at"
    )
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

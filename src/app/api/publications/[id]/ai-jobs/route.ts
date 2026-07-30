import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/publications/[id]/ai-jobs — job history for a publication,
 * newest first. Powers the "Recent AI Jobs" concept from the Solution
 * Architecture design doc's Dashboard module — this milestone provides
 * the data endpoint and wires the dashboard widget to it, replacing the
 * Milestone 1 placeholder card.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: publicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ai_jobs")
    .select("id, function_id, status, provider, model, cost_usd, created_at, completed_at, issue_id")
    .eq("publication_id", publicationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    logger.error("Failed to load AI job history", { error, publicationId });
    return NextResponse.json({ error: "Failed to load AI job history" }, { status: 500 });
  }

  return NextResponse.json({ jobs: data });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { createSectionSchema } from "@/lib/validation/issue-builder";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, issueId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  let position = parsed.data.position;
  if (position === undefined) {
    const { count } = await supabase.from("sections").select("id", { count: "exact", head: true }).eq("issue_id", issueId);
    position = count ?? 0;
  }

  const { data: section, error } = await supabase
    .from("sections")
    .insert({ issue_id: issueId, title: parsed.data.title ?? null, position })
    .select("id, issue_id, title, position")
    .single();

  if (error || !section) {
    logger.error("Failed to create section", { error, issueId });
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }

  return NextResponse.json({ section }, { status: 201 });
}

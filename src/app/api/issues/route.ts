import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createIssueSchema } from "@/lib/validation/issue-builder";
import { logger } from "@/lib/logger";

/**
 * GET  /api/issues?publicationId=X — issues for a publication the caller
 *      is a member of (defaults to every issue across every publication
 *      the caller belongs to if publicationId is omitted).
 * POST /api/issues — create an issue with one starting empty section, so
 *      the builder canvas never opens to a completely blank tree with no
 *      drop target.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const publicationId = searchParams.get("publicationId");

  let query = supabase
    .from("issues")
    .select(
      "id, publication_id, title, slug, status, scheduled_at, published_at, created_by, updated_at, publications(name, slug)"
    )
    .order("updated_at", { ascending: false });

  if (publicationId) query = query.eq("publication_id", publicationId);

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to list issues", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to load issues" }, { status: 500 });
  }

  return NextResponse.json({ issues: data });
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "issue"
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createIssueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", parsed.data.publicationId)
    .eq("user_id", user.id)
    .single();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isMember = !!membership || profile?.role === "super_admin";
  if (!isMember) {
    return NextResponse.json(
      { error: "You must be a member of this publication to create an issue" },
      { status: 403 }
    );
  }

  const baseSlug = slugify(parsed.data.title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`; // Milestone 4's slug-collision handling (unique index + 409) applies per-publication for publications; issues.slug is unique per (publication_id, slug) — the timestamp suffix avoids asking the user to pick a slug at all for what's initially a draft title.

  const { data: issue, error } = await supabase
    .from("issues")
    .insert({
      publication_id: parsed.data.publicationId,
      title: parsed.data.title,
      slug,
      created_by: user.id,
    })
    .select("id, title, slug")
    .single();

  if (error || !issue) {
    logger.error("Failed to create issue", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }

  const { error: sectionError } = await supabase.from("sections").insert({ issue_id: issue.id, position: 0 });
  if (sectionError) {
    logger.error("Issue created but starting section failed", { error: sectionError, issueId: issue.id });
  }

  return NextResponse.json({ issue }, { status: 201 });
}

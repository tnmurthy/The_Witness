/**
 * GET  /api/articles   — list articles for publications the caller belongs to
 * POST /api/articles   — create a new article with one starter section
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { logger } from "@/lib/logger";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  publicationId: z.string().uuid(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const publicationId = searchParams.get("publicationId");

  let query = supabase
    .from("articles")
    .select("id, publication_id, title, slug, status, published_at, updated_at, publications(name, slug)")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (publicationId) query = query.eq("publication_id", publicationId);

  const { data, error } = await query;
  if (error) {
    logger.error("Failed to fetch articles", { error });
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
  return NextResponse.json({ articles: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { title, publicationId } = parsed.data;

  // Verify membership
  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", publicationId)
    .eq("user_id", user.id)
    .single();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!membership && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "You are not a member of this publication" }, { status: 403 });
  }

  // Slug: title → lowercase, spaces → hyphens, strip non-alnum
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);

  const { data: article, error: ae } = await supabase
    .from("articles")
    .insert({ title, slug, publication_id: publicationId, created_by: user.id })
    .select("id, title, slug, status")
    .single();

  if (ae || !article) {
    logger.error("Failed to create article", { error: ae });
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }

  // Create a starter section (same pattern as issues)
  await supabase.from("sections").insert({
    article_id: article.id,
    title: null,
    position: 0,
  });

  logger.info("Article created", { articleId: article.id, userId: user.id });
  return NextResponse.json({ article }, { status: 201 });
}

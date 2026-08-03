import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPersonSchema } from "@/lib/validation/graph";
import { logger } from "@/lib/logger";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "person"
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { limit } = parsePaginationParams(request.url);
  const search = searchParams.get("search");

  let query = supabase
    .from("people")
    .select("id, full_name, slug, bio, avatar_url")
    .order("full_name")
    .limit(limit + 1);
  if (search) query = query.textSearch("search_vector", search, { type: "websearch" });

  const { data, error } = await query;
  if (error) {
    logger.error("Failed to list people", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to load people" }, { status: 500 });
  }

  const paginated = buildPaginatedResponse(
    (data ?? []) as unknown as Array<{ id: string; created_at: string } & Record<string, unknown>>,
    limit
  );
  return NextResponse.json({ people: paginated.data, pagination: paginated.pagination });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const editorialRoles = ["super_admin", "editor_in_chief", "editor", "writer", "researcher"];
  if (!profile?.role || !editorialRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Editorial staff only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const baseSlug = slugify(parsed.data.fullName);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: person, error } = await supabase
    .from("people")
    .insert({
      full_name: parsed.data.fullName,
      slug,
      bio: parsed.data.bio ?? null,
      avatar_url: parsed.data.avatarUrl || null,
      external_links: parsed.data.externalLinks,
      created_by: user.id,
    })
    .select("id, full_name, slug")
    .single();

  if (error || !person) {
    logger.error("Failed to create person", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
  }

  return NextResponse.json({ person }, { status: 201 });
}

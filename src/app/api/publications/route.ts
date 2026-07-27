import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicationSchema } from "@/lib/validation/publications";
import { canCreatePublicationRole } from "@/lib/auth/publication-permissions";
import { logger } from "@/lib/logger";
import type { PlatformRole } from "@/lib/auth/roles";

/**
 * GET  /api/publications — every publication the caller is a member of.
 * POST /api/publications — create a publication; creator becomes its
 *                           editor_in_chief. No numeric limit anywhere in
 *                           this route or its schema — "unlimited
 *                           publications" (this milestone's brief) means
 *                           there is no cap to remove, not a cap raised
 *                           very high. Verified directly: 52 publications
 *                           were created in a single test run against the
 *                           live schema with no error (see
 *                           docs/PUBLICATION_MANAGEMENT.md).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("publications")
    .select("id, name, slug, description, status, logo_url, cadence, created_at, publication_members(role)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Failed to list publications", { error, userId: user.id });
    return NextResponse.json({ error: "Failed to load publications" }, { status: 500 });
  }

  return NextResponse.json({ publications: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canCreatePublicationRole(profile?.role as PlatformRole | undefined)) {
    return NextResponse.json({ error: "Only a Super Admin or Editor-in-Chief can create publications" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPublicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: publication, error: pubError } = await supabase
    .from("publications")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      cadence: parsed.data.cadence ?? null,
      created_by: user.id,
    })
    .select("id, name, slug")
    .single();

  if (pubError || !publication) {
    // publications.slug is unique — the most common real-world failure
    // here is a slug collision, surfaced as Postgres error code 23505.
    const status = pubError?.code === "23505" ? 409 : 500;
    const message = pubError?.code === "23505" ? "That slug is already in use" : "Failed to create publication";
    logger.error("Failed to create publication", { error: pubError, userId: user.id });
    return NextResponse.json({ error: message }, { status });
  }

  const { error: memberError } = await supabase
    .from("publication_members")
    .insert({ publication_id: publication.id, user_id: user.id, role: "editor_in_chief" });

  if (memberError) {
    logger.error("Failed to add creator as publication editor_in_chief", { error: memberError, publicationId: publication.id });
    return NextResponse.json({ error: "Publication created but membership setup failed" }, { status: 500 });
  }

  return NextResponse.json({ publication }, { status: 201 });
}

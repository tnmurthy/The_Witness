import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { updatePublicationGeneralSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: publication, error } = await supabase.from("publications").select("*").eq("id", id).single();

  if (error || !publication) {
    return NextResponse.json({ error: "Publication not found" }, { status: 404 });
  }

  return NextResponse.json({ publication });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePublicationGeneralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: publication, error } = await supabase
    .from("publications")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      cadence: parsed.data.cadence ?? null,
    })
    .eq("id", id)
    .select("id, name, slug, description, cadence")
    .single();

  if (error || !publication) {
    logger.error("Failed to update publication", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to update publication" }, { status: 500 });
  }

  return NextResponse.json({ publication });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Archive, not hard-delete — publications carry issues, subscribers,
  // and analytics history that shouldn't disappear. Matches
  // publication_status's 'active'/'archived' pair (Migration 001).
  const { error } = await supabase.from("publications").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id);

  if (error) {
    logger.error("Failed to archive publication", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to archive publication" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

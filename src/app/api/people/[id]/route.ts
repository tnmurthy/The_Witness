import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updatePersonSchema } from "@/lib/validation/graph";
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

  const { data: person, error } = await supabase.from("people").select("*").eq("id", id).single();
  if (error || !person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  return NextResponse.json({ person });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
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
  const parsed = updatePersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) update.full_name = parsed.data.fullName;
  if (parsed.data.bio !== undefined) update.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) update.avatar_url = parsed.data.avatarUrl || null;
  if (parsed.data.externalLinks !== undefined) update.external_links = parsed.data.externalLinks;

  const { data: person, error } = await supabase
    .from("people")
    .update(update)
    .eq("id", id)
    .select("id, full_name")
    .single();
  if (error || !person) {
    logger.error("Failed to update person", { error, personId: id });
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
  }

  return NextResponse.json({ person });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile?.role || !["super_admin", "editor_in_chief", "editor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) {
    logger.error("Failed to delete person", { error, personId: id });
    return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

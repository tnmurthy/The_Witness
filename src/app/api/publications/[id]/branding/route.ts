import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { updateBrandingSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * branding is stored as jsonb (Migration 003) rather than fixed columns —
 * this route is the one place its shape is actually enforced
 * (updateBrandingSchema), consistent with how theme/publishing_schedule
 * are treated: loose at the database layer, validated at the application
 * boundary. A partial update merges into the existing object rather than
 * replacing it, so updating just accentColor doesn't clobber a
 * previously-set primaryColor.
 */
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
  const parsed = updateBrandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: current } = await supabase.from("publications").select("branding").eq("id", id).single();
  const merged = { ...(current?.branding ?? {}), ...parsed.data };

  const { data: publication, error } = await supabase
    .from("publications")
    .update({ branding: merged })
    .eq("id", id)
    .select("id, branding")
    .single();

  if (error || !publication) {
    logger.error("Failed to update branding", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }

  return NextResponse.json({ publication });
}

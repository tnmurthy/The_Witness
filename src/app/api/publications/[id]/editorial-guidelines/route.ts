import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { updateEditorialGuidelinesSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
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
  const parsed = updateEditorialGuidelinesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: publication, error } = await supabase
    .from("publications")
    .update({ editorial_guidelines: parsed.data.editorialGuidelines ?? null })
    .eq("id", id)
    .select("id, editorial_guidelines")
    .single();

  if (error || !publication) {
    logger.error("Failed to update editorial guidelines", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to update editorial guidelines" }, { status: 500 });
  }

  return NextResponse.json({ publication });
}

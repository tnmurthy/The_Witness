import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { updateAiPromptTemplateSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string; templateId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, templateId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAiPromptTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.templateText !== undefined) update.template_text = parsed.data.templateText;
  if (parsed.data.variables !== undefined) update.variables = parsed.data.variables;
  if (parsed.data.isActive !== undefined) update.is_active = parsed.data.isActive;

  const { data: template, error } = await supabase
    .from("prompt_templates")
    // publication_id filter here (not just id) means this can never
    // accidentally edit another publication's template even if a caller
    // guessed a valid templateId — belt-and-suspenders alongside RLS.
    .update(update)
    .eq("id", templateId)
    .eq("publication_id", id)
    .select("id, block_type, name, template_text, variables, is_active")
    .single();

  if (error || !template) {
    const status = error?.code === "23505" ? 409 : 500;
    const message =
      error?.code === "23505"
        ? "An active template for this block type already exists."
        : "Failed to update template";
    logger.error("Failed to update AI prompt template", { error, publicationId: id, templateId });
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, templateId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("prompt_templates")
    .delete()
    .eq("id", templateId)
    .eq("publication_id", id);

  if (error) {
    logger.error("Failed to delete AI prompt template", { error, publicationId: id, templateId });
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

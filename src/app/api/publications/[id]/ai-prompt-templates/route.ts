import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { createAiPromptTemplateSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET  — this publication's AI prompt templates (does not include
 *        platform-wide defaults; those are managed separately by Super
 *        Admin and apply automatically wherever no publication-specific
 *        override exists — see Migration 014's column comment on
 *        prompt_templates.publication_id).
 * POST — create a publication-scoped override. The unique partial index
 *        from Migration 014 (idx_prompt_templates_publication_block_type_
 *        active) means a second *active* template for the same
 *        block_type on this publication is rejected at the database
 *        layer — this route surfaces that as a clean 409, not a raw
 *        Postgres error.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("prompt_templates")
    .select("id, block_type, name, template_text, variables, is_active, created_at")
    .eq("publication_id", id)
    .order("block_type");

  if (error) {
    logger.error("Failed to list AI prompt templates", { error, publicationId: id });
    return NextResponse.json({ error: "Failed to load AI prompt templates" }, { status: 500 });
  }

  return NextResponse.json({ templates: data });
}

export async function POST(request: Request, { params }: RouteParams) {
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
  const parsed = createAiPromptTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const { data: template, error } = await supabase
    .from("prompt_templates")
    .insert({
      publication_id: id,
      block_type: parsed.data.blockType,
      name: parsed.data.name,
      template_text: parsed.data.templateText,
      variables: parsed.data.variables,
      created_by: user.id,
    })
    .select("id, block_type, name, template_text, variables, is_active")
    .single();

  if (error || !template) {
    const status = error?.code === "23505" ? 409 : 500;
    const message =
      error?.code === "23505"
        ? "An active template for this block type already exists for this publication — deactivate it first."
        : "Failed to create AI prompt template";
    logger.error("Failed to create AI prompt template", { error, publicationId: id });
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ template }, { status: 201 });
}

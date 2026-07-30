import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditPublication } from "@/lib/auth/publication-permissions";
import { templateChannelSchema } from "@/lib/validation/publications";
import { logger } from "@/lib/logger";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string; channel: string }>;
}

const configBodySchema = z.object({ config: z.record(z.string(), z.unknown()) });

/**
 * GET/PUT /api/publications/[id]/templates/[channel] — the Email, PDF,
 * and Website Templates from this milestone's brief. All three are the
 * same publication_templates table (Migration 003) keyed by
 * template_channel ('email' | 'pdf' | 'web'), not three separate tables —
 * they share identical structure (one config jsonb blob per channel) and
 * only differ in which channel's rendering pipeline (Milestone 10) reads
 * them. AI Prompt Templates are deliberately NOT a fourth channel here —
 * see ai-prompt-templates/route.ts; they're a different table
 * (prompt_templates) because they're keyed by block_type, not channel,
 * and have an entirely different consumer (the AI Workspace Orchestrator,
 * not the publishing pipeline).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, channel } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedChannel = templateChannelSchema.safeParse(channel);
  if (!parsedChannel.success) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const { data: template } = await supabase
    .from("publication_templates")
    .select("id, channel, config")
    .eq("publication_id", id)
    .eq("channel", parsedChannel.data)
    .maybeSingle();

  return NextResponse.json({ template: template ?? { channel: parsedChannel.data, config: {} } });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id, channel } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditPublication(supabase, id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedChannel = templateChannelSchema.safeParse(channel);
  if (!parsedChannel.success) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = configBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsedBody.error.issues }, { status: 422 });
  }

  const { data: template, error } = await supabase
    .from("publication_templates")
    .upsert(
      { publication_id: id, channel: parsedChannel.data, config: parsedBody.data.config },
      { onConflict: "publication_id,channel" }
    )
    .select("id, channel, config")
    .single();

  if (error || !template) {
    logger.error("Failed to update template config", {
      error,
      publicationId: id,
      channel: parsedChannel.data,
    });
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }

  return NextResponse.json({ template });
}

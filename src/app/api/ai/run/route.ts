import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runAIFunction } from "@/lib/ai/orchestrator";
import { isAIFunctionId, AI_FUNCTIONS_REGISTRY } from "@/lib/ai/functions/registry";
import { AIProviderError } from "@/lib/ai/types";
import { isProviderConfigured, getDefaultProviderId } from "@/lib/ai/registry";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
  functionId: z.string(),
  publicationId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  blockId: z.string().uuid().optional(),
  input: z.unknown(),
});

/**
 * POST /api/ai/run — dispatches to any of the 9 non-issue-generation AI
 * functions (Rewrite, Summarize, Improve Writing, Suggest Headlines,
 * Suggest Images, Generate LinkedIn Post, Generate Email, Generate PDF
 * Content, Generate SEO Metadata) by functionId. Generate Issue has its
 * own dedicated route (/api/issues/[id]/ai/generate) because it does
 * more than call the orchestrator — it also creates real blocks in the
 * Issue Builder canvas, which is issue-specific work this generic
 * dispatcher deliberately doesn't do for every function (Rewrite has no
 * "block" to create; it returns text the caller applies itself).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  if (!isAIFunctionId(parsed.data.functionId) || parsed.data.functionId === "generate_issue") {
    return NextResponse.json(
      {
        error:
          parsed.data.functionId === "generate_issue"
            ? "Use /api/issues/:id/ai/generate for Generate Issue"
            : "Unknown AI function",
      },
      { status: 422 }
    );
  }

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", parsed.data.publicationId)
    .eq("user_id", user.id)
    .single();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isMember = !!membership || profile?.role === "super_admin";
  if (!isMember) {
    return NextResponse.json(
      { error: "You must be a member of this publication to use the AI Workspace" },
      { status: 403 }
    );
  }

  if (!getDefaultProviderId()) {
    return NextResponse.json(
      {
        error: "No AI provider is configured on this deployment.",
        detail: `Set OPENAI_API_KEY or ANTHROPIC_API_KEY. openai configured: ${isProviderConfigured("openai")}, anthropic configured: ${isProviderConfigured("anthropic")}`,
      },
      { status: 503 }
    );
  }

  try {
    const result = await runAIFunction(supabase, {
      functionId: parsed.data.functionId,
      input: parsed.data.input,
      publicationId: parsed.data.publicationId,
      issueId: parsed.data.issueId,
      blockId: parsed.data.blockId,
      actorId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("AI function run failed", { error, functionId: parsed.data.functionId, userId: user.id });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input for this function", issues: error.issues },
        { status: 422 }
      );
    }
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI function failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const functions = Object.entries(AI_FUNCTIONS_REGISTRY).map(([id, def]) => ({
    id,
    label: def.label,
    description: def.description,
  }));
  return NextResponse.json({ functions });
}

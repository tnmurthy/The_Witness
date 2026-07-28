import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditIssue } from "@/lib/auth/issue-permissions";
import { runAIFunction } from "@/lib/ai/orchestrator";
import { AIProviderError } from "@/lib/ai/types";
import { isProviderConfigured, getDefaultProviderId } from "@/lib/ai/registry";
import type { GenerateIssueOutput } from "@/lib/ai/functions/generate-issue";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const requestSchema = z.object({
  topic: z.string().min(1).max(500),
  audience: z.string().max(300).optional(),
  tone: z.string().max(300).optional(),
  blockTypes: z.array(z.string()).min(1).optional(),
  sectionId: z.string().uuid(),
});

/**
 * POST /api/issues/[id]/ai/generate — runs the generate_issue AI function
 * via the orchestrator, then persists every successfully-validated block
 * it returned into the given section as real blocks
 * (ai_generated: true), the same way a human-authored block is created
 * (src/app/api/sections/[id]/blocks/route.ts's insert shape). Nothing is
 * published automatically — these land in the Issue Builder as ordinary
 * draft blocks an editor reviews, edits, or deletes exactly like any
 * other block. Blocks the AI drafted that failed payload validation
 * (generate-issue.ts's `rejected` list) are reported in the response,
 * not silently dropped, so the UI can show "4 of 5 blocks drafted" with
 * a reason for the one that didn't make it.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: issueId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canEditIssue(supabase, issueId, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
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

  const { data: section } = await supabase.from("sections").select("id, issue_id").eq("id", parsed.data.sectionId).single();
  if (section?.issue_id !== issueId) {
    return NextResponse.json({ error: "That section does not belong to this issue" }, { status: 422 });
  }

  const { data: issue } = await supabase.from("issues").select("publication_id, publications(name, editorial_guidelines)").eq("id", issueId).single();
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  const publication = Array.isArray(issue.publications) ? issue.publications[0] : issue.publications;

  try {
    const { count: existingCount } = await supabase.from("blocks").select("id", { count: "exact", head: true }).eq("section_id", parsed.data.sectionId);
    let nextPosition = existingCount ?? 0;

    const result = await runAIFunction<GenerateIssueOutput>(supabase, {
      functionId: "generate_issue",
      publicationId: issue.publication_id,
      issueId,
      actorId: user.id,
      input: {
        publicationName: publication?.name ?? "The Witness",
        editorialGuidelines: publication?.editorial_guidelines ?? undefined,
        topic: parsed.data.topic,
        audience: parsed.data.audience,
        tone: parsed.data.tone,
        blockTypes: parsed.data.blockTypes,
      },
    });

    const createdBlocks = [];
    for (const draft of result.output.blocks) {
      const { data: block, error } = await supabase
        .from("blocks")
        .insert({
          section_id: parsed.data.sectionId,
          type: draft.type,
          payload: draft.payload,
          position: nextPosition++,
          ai_generated: true,
          created_by: user.id,
          last_edited_by: user.id,
        })
        .select("id, section_id, issue_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
        .single();

      if (error) {
        logger.error("Failed to persist AI-drafted block", { error, issueId, type: draft.type });
        continue;
      }
      createdBlocks.push(block);
    }

    return NextResponse.json({
      jobId: result.jobId,
      blocks: createdBlocks,
      rejected: result.output.rejected,
      costUsd: result.costUsd,
    });
  } catch (error) {
    logger.error("Generate Issue failed", { error, issueId, userId: user.id });
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message, retryable: error.retryable }, { status: 502 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_FUNCTIONS_REGISTRY, type AIFunctionId } from "./functions/registry";
import { getProvider, getDefaultProviderId, DEFAULT_MODEL_BY_PROVIDER } from "./registry";
import type { AIProviderId } from "./types";
import { AIProviderError } from "./types";
import { logger } from "@/lib/logger";

export interface RunAIFunctionParams {
  functionId: AIFunctionId;
  input: unknown;
  publicationId: string;
  issueId?: string;
  blockId?: string;
  actorId: string;
  providerId?: AIProviderId;
}

export interface RunAIFunctionResult<T = unknown> {
  jobId: string;
  output: T;
  tokenUsage: { input: number; output: number };
  costUsd: number;
}

/**
 * The single place in this codebase that both calls an AI provider and
 * writes to ai_jobs — every API route that offers an AI Workspace
 * capability calls this, never the provider registry or a function
 * definition directly. That's what makes the "ai_jobs is a durable,
 * auditable record of every AI Workspace generation request... never
 * fire-and-forget" guarantee (Migration 005's own table comment) actually
 * true rather than aspirational: there's exactly one code path that can
 * produce AI output, and it always persists a row first.
 *
 * Uses the caller's own Supabase client (RLS-scoped to their session),
 * not the service-role admin client — an AI generation request is an
 * action the acting user takes within their own permissions (they must
 * already be a publication member to reach this point, checked by the
 * calling API route), not a platform-administrative operation like a
 * role change.
 */
export async function runAIFunction<T = unknown>(supabase: SupabaseClient, params: RunAIFunctionParams): Promise<RunAIFunctionResult<T>> {
  const definition = AI_FUNCTIONS_REGISTRY[params.functionId];
  if (!definition) {
    throw new Error(`Unknown AI function: ${params.functionId}`);
  }

  const parsedInput = definition.inputSchema.parse(params.input);

  const providerId = params.providerId ?? getDefaultProviderId();
  if (!providerId) {
    throw new Error("No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }
  const model = DEFAULT_MODEL_BY_PROVIDER[providerId];

  const { system, prompt } = definition.buildPrompt(parsedInput);

  const { data: job, error: insertError } = await supabase
    .from("ai_jobs")
    .insert({
      publication_id: params.publicationId,
      issue_id: params.issueId ?? null,
      block_id: params.blockId ?? null,
      function_id: params.functionId,
      status: "running",
      provider: providerId,
      model,
      params: parsedInput as Record<string, unknown>,
      prompt: `${system ? `[system]\n${system}\n\n` : ""}[user]\n${prompt}`,
      created_by: params.actorId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !job) {
    logger.error("Failed to create ai_jobs row", { error: insertError, functionId: params.functionId });
    throw new Error("Failed to start AI job");
  }

  try {
    const provider = getProvider(providerId);
    const result = await provider.generateText({
      system,
      prompt,
      model,
      maxTokens: definition.defaultMaxTokens,
    });

    const output = definition.parseResult(result.text) as T;

    await supabase
      .from("ai_jobs")
      .update({
        status: "completed",
        result: output as Record<string, unknown>,
        token_usage: result.tokenUsage,
        cost_usd: result.costUsd,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    logger.info("AI function completed", { functionId: params.functionId, jobId: job.id, costUsd: result.costUsd });

    return { jobId: job.id, output, tokenUsage: result.tokenUsage, costUsd: result.costUsd };
  } catch (error) {
    const message = error instanceof AIProviderError ? error.message : error instanceof Error ? error.message : "Unknown error";

    await supabase
      .from("ai_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id);

    logger.error("AI function failed", { functionId: params.functionId, jobId: job.id, error });
    throw error;
  }
}

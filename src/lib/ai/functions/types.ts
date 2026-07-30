import type { z } from "zod";

/**
 * One AI Workspace capability. Each function defines its own input
 * schema (validated before any provider call is made), a prompt builder
 * (pure — takes validated input, returns the system/user prompt pair),
 * and a result parser (pure — takes the provider's raw text, returns the
 * function's typed output). The orchestrator (src/lib/ai/orchestrator.ts)
 * is the only place that actually calls a provider or touches ai_jobs —
 * these definitions never do I/O themselves, which is what makes them
 * unit-testable without mocking a provider or a database at all (see
 * src/__tests__/ai-functions.test.ts).
 */
export interface AIFunctionDefinition<TInput, TOutput> {
  id: string;
  label: string;
  description: string;
  /**
   * Typed as ZodType<TInput, ZodTypeDef, unknown> rather than
   * ZodType<TInput> — a schema with .default() fields has a pre-parse
   * input shape (fields optional) that's narrower than its post-parse
   * output shape (TInput, fields required after defaults apply), and
   * Zod's own type for such a schema reflects that split. Constraining
   * the third generic param to TInput as well (rather than `unknown`)
   * makes TypeScript reject every schema using .default() as "not
   * assignable" even though `.parse()` behaves correctly at runtime —
   * this loosened form matches what Zod's own inferred types actually
   * produce.
   */
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  buildPrompt: (input: TInput) => { system?: string; prompt: string };
  parseResult: (rawText: string) => TOutput;
  /** Reasonable default max_tokens for this function's expected output length — a headline suggestion needs far less headroom than a full issue draft. */
  defaultMaxTokens: number;
}

/**
 * Most functions return plain text and don't need real parsing — this
 * no-op parser is the common case; functions whose output has real
 * structure (suggest_headlines returns an array, generate_seo_metadata
 * returns several distinct fields) provide their own.
 */
export const passthroughParser = (rawText: string): string => rawText.trim();

/**
 * Several functions ask the model to return JSON and need to parse it
 * back out — models occasionally wrap JSON in a markdown code fence
 * despite instructions not to, so this strips that before parsing rather
 * than failing on well-formed-but-fenced output.
 */
export function parseJsonResponse<T>(rawText: string): T {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(stripped) as T;
}

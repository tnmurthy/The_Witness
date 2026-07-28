import { generateIssueFunction } from "./generate-issue";
import { rewriteFunction } from "./rewrite";
import { summarizeFunction } from "./summarize";
import { improveWritingFunction } from "./improve-writing";
import { suggestHeadlinesFunction } from "./suggest-headlines";
import { suggestImagesFunction } from "./suggest-images";
import { generateLinkedInPostFunction } from "./generate-linkedin-post";
import { generateEmailFunction } from "./generate-email";
import { generatePdfContentFunction } from "./generate-pdf-content";
import { generateSeoMetadataFunction } from "./generate-seo-metadata";
import { recommendWisdomFunction } from "./recommend-wisdom";
import type { AIFunctionDefinition } from "./types";

/**
 * Every AI Workspace function, matching the 10 named in the Milestone 6
 * brief and the `ai_function` Postgres enum (Migration 017) exactly —
 * src/__tests__/ai-functions.test.ts pins that correspondence the same
 * way roles.test.ts pins the platform_role enum against
 * src/lib/auth/roles.ts.
 *
 * Typed as AIFunctionDefinition<unknown, unknown> rather than a union of
 * each function's specific generic instantiation — the registry is
 * inherently heterogeneous (10 genuinely unrelated input/output shapes),
 * and callers look up by id and immediately validate with that
 * function's own inputSchema before touching the value, so the loosened
 * type here costs nothing at the actual call sites.
 */
export const AI_FUNCTIONS_REGISTRY: Record<string, AIFunctionDefinition<unknown, unknown>> = {
  generate_issue: generateIssueFunction,
  rewrite: rewriteFunction,
  summarize: summarizeFunction,
  improve_writing: improveWritingFunction,
  suggest_headlines: suggestHeadlinesFunction,
  suggest_images: suggestImagesFunction,
  generate_linkedin_post: generateLinkedInPostFunction,
  generate_email: generateEmailFunction,
  generate_pdf_content: generatePdfContentFunction,
  generate_seo_metadata: generateSeoMetadataFunction,
  recommend_wisdom: recommendWisdomFunction,
} as unknown as Record<string, AIFunctionDefinition<unknown, unknown>>;

export type AIFunctionId = keyof typeof AI_FUNCTIONS_REGISTRY;

export const AI_FUNCTION_IDS = Object.keys(AI_FUNCTIONS_REGISTRY) as AIFunctionId[];

export function isAIFunctionId(id: string): id is AIFunctionId {
  return id in AI_FUNCTIONS_REGISTRY;
}

import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(10000),
  count: z.number().int().min(1).max(6).default(3),
});
export type SuggestImagesInput = z.infer<typeof inputSchema>;

export interface ImageSuggestion {
  searchQuery: string;
  altText: string;
  rationale: string;
}
export interface SuggestImagesOutput {
  suggestions: ImageSuggestion[];
}

/**
 * "Suggest Images," not "Generate Images" — this function asks the
 * model for stock/editorial image search queries and ready-to-use alt
 * text, not an actual generated image. Text-generation models (what the
 * provider abstraction in this milestone supports) don't produce images;
 * wiring an image-generation API (DALL-E, Midjourney, etc.) is a
 * meaningfully different integration — a different provider interface
 * entirely, different cost model, different content-moderation surface —
 * and is scoped out of this milestone rather than half-built. See
 * docs/AI_WORKSPACE.md, "Suggest Images vs. Generate Images."
 */
export const suggestImagesFunction: AIFunctionDefinition<SuggestImagesInput, SuggestImagesOutput> = {
  id: "suggest_images",
  label: "Suggest Images",
  description: "Search queries and alt text for finding editorial images — not AI-generated images",
  inputSchema,
  defaultMaxTokens: 800,
  buildPrompt: (input) => ({
    system:
      "You are a photo editor for The Witness. Suggest stock/editorial photography search queries that would suit this content, plus ready-to-use accessible alt text for each. Never suggest a specific copyrighted photo, illustration, or a named public figure's likeness — suggest concepts and query terms only. Respond with ONLY a JSON object: " +
      '{"suggestions": [{"searchQuery": string, "altText": string, "rationale": string}]}.',
    prompt: `Suggest ${input.count} image ideas for this content:\n\n${input.content}`,
  }),
  parseResult: (rawText) => parseJsonResponse<SuggestImagesOutput>(rawText),
};

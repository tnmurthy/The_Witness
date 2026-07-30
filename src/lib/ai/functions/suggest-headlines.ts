import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(10000),
  count: z.number().int().min(1).max(10).default(5),
});
export type SuggestHeadlinesInput = z.infer<typeof inputSchema>;

export interface SuggestHeadlinesOutput {
  headlines: string[];
}

export const suggestHeadlinesFunction: AIFunctionDefinition<SuggestHeadlinesInput, SuggestHeadlinesOutput> = {
  id: "suggest_headlines",
  label: "Suggest Headlines",
  description: "Generate headline options for a piece of content",
  inputSchema,
  defaultMaxTokens: 800,
  buildPrompt: (input) => ({
    system:
      'You are a headline writer for The Witness, in the editorial voice of the Financial Times and MIT Technology Review — precise, not clickbait, no exclamation points, no vague hype words like "revolutionary" or "game-changing." Respond with ONLY a JSON object: ' +
      '{"headlines": string[]}.',
    prompt: `Write ${input.count} distinct headline options for this content:\n\n${input.content}`,
  }),
  parseResult: (rawText) => parseJsonResponse<SuggestHeadlinesOutput>(rawText),
};

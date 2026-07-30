import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  text: z.string().min(1).max(10000),
});
export type ImproveWritingInput = z.infer<typeof inputSchema>;

export interface ImproveWritingOutput {
  improvedText: string;
  changes: string[];
}

export const improveWritingFunction: AIFunctionDefinition<ImproveWritingInput, ImproveWritingOutput> = {
  id: "improve_writing",
  label: "Improve Writing",
  description: "Grammar, clarity, and concision pass — with a list of what changed",
  inputSchema,
  defaultMaxTokens: 2500,
  buildPrompt: (input) => ({
    system:
      "You are a copy editor for The Witness. Improve grammar, clarity, and concision without changing the meaning, facts, or tone. Respond with ONLY a JSON object, no markdown fence, no other text, matching exactly this shape: " +
      '{"improvedText": string, "changes": string[]}. "changes" is a short list (2-5 items) of what you changed and why, e.g. "Shortened the second sentence for clarity."',
    prompt: `Text to improve:\n${input.text}`,
  }),
  parseResult: (rawText) => parseJsonResponse<ImproveWritingOutput>(rawText),
};

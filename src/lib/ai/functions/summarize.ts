import { z } from "zod";
import type { AIFunctionDefinition } from "./types";
import { passthroughParser } from "./types";

const inputSchema = z.object({
  text: z.string().min(1).max(20000),
  targetLength: z.enum(["one_sentence", "short_paragraph", "bullet_points"]).default("short_paragraph"),
});
export type SummarizeInput = z.infer<typeof inputSchema>;

const LENGTH_INSTRUCTIONS: Record<SummarizeInput["targetLength"], string> = {
  one_sentence: "Summarize in exactly one sentence.",
  short_paragraph: "Summarize in a short paragraph (3-4 sentences).",
  bullet_points: "Summarize as 3-5 bullet points, each one sentence.",
};

export const summarizeFunction: AIFunctionDefinition<SummarizeInput, string> = {
  id: "summarize",
  label: "Summarize",
  description: "Condense text to a shorter form",
  inputSchema,
  defaultMaxTokens: 500,
  buildPrompt: (input) => ({
    system:
      "You are an editorial assistant for The Witness. Summarize accurately — never introduce a claim that isn't in the source text. Return only the summary, no preamble.",
    prompt: `${LENGTH_INSTRUCTIONS[input.targetLength]}\n\nText:\n${input.text}`,
  }),
  parseResult: passthroughParser,
};

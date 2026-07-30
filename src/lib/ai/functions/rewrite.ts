import { z } from "zod";
import type { AIFunctionDefinition } from "./types";
import { passthroughParser } from "./types";

const inputSchema = z.object({
  text: z.string().min(1).max(10000),
  instruction: z
    .string()
    .min(1)
    .max(500)
    .default("Rewrite this to be clearer and more engaging, keeping the same meaning."),
});
export type RewriteInput = z.infer<typeof inputSchema>;

export const rewriteFunction: AIFunctionDefinition<RewriteInput, string> = {
  id: "rewrite",
  label: "Rewrite",
  description: "Rewrite selected text to a different tone or style",
  inputSchema,
  defaultMaxTokens: 2000,
  buildPrompt: (input) => ({
    system:
      "You are an editorial assistant for The Witness, a technology and career intelligence publication. Rewrite text exactly as instructed. Return only the rewritten text — no preamble, no explanation, no quotation marks around it.",
    prompt: `Instruction: ${input.instruction}\n\nText to rewrite:\n${input.text}`,
  }),
  parseResult: passthroughParser,
};

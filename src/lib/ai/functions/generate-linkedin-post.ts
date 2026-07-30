import { z } from "zod";
import type { AIFunctionDefinition } from "./types";
import { passthroughParser } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(10000),
  issueUrl: z.string().url().optional(),
});
export type GenerateLinkedInPostInput = z.infer<typeof inputSchema>;

export const generateLinkedInPostFunction: AIFunctionDefinition<GenerateLinkedInPostInput, string> = {
  id: "generate_linkedin_post",
  label: "Generate LinkedIn Post",
  description: "Repurpose issue content into a LinkedIn post",
  inputSchema,
  defaultMaxTokens: 600,
  buildPrompt: (input) => ({
    system:
      "You write LinkedIn posts for The Witness's company page. Professional but conversational tone, 3-5 short paragraphs (LinkedIn favors line breaks over dense paragraphs), no hashtag spam (at most 3, only if genuinely relevant), no emoji abuse (0-2 total). End with a question or a clear reason to click through, not a generic call to action. Return only the post text.",
    prompt: `Write a LinkedIn post based on this content:\n\n${input.content}${input.issueUrl ? `\n\nLink to include: ${input.issueUrl}` : ""}`,
  }),
  parseResult: passthroughParser,
};

import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(15000),
  publicationName: z.string().min(1).max(200),
  tone: z.string().max(200).default("analytical, direct, no hype"),
});
export type GenerateEmailInput = z.infer<typeof inputSchema>;

export interface GenerateEmailOutput {
  subject: string;
  previewText: string;
  body: string;
}

/**
 * Produces the AI-drafted subject/preview/body an editor reviews and
 * places into the publication's email template config
 * (publication_templates where channel = 'email', Milestone 4) — this
 * function drafts the words; actually rendering and sending the email is
 * the Milestone 10 (Publishing Pipeline) rendering/delivery pipeline,
 * unchanged by this milestone.
 */
export const generateEmailFunction: AIFunctionDefinition<GenerateEmailInput, GenerateEmailOutput> = {
  id: "generate_email",
  label: "Generate Email",
  description: "Draft a subject line, preview text, and body for the issue's email send",
  inputSchema,
  defaultMaxTokens: 2000,
  buildPrompt: (input) => ({
    system:
      `You write the email edition of ${input.publicationName}. Tone: ${input.tone}. Subject line under 60 characters, no clickbait. Preview text under 100 characters, complements (doesn't repeat) the subject. Body is email-formatted plain text (short paragraphs, no dense blocks). Respond with ONLY a JSON object: ` +
      '{"subject": string, "previewText": string, "body": string}.',
    prompt: `Draft the email edition from this issue content:\n\n${input.content}`,
  }),
  parseResult: (rawText) => parseJsonResponse<GenerateEmailOutput>(rawText),
};

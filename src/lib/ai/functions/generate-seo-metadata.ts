import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(15000),
});
export type GenerateSeoMetadataInput = z.infer<typeof inputSchema>;

export interface GenerateSeoMetadataOutput {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
}

export const generateSeoMetadataFunction: AIFunctionDefinition<GenerateSeoMetadataInput, GenerateSeoMetadataOutput> = {
  id: "generate_seo_metadata",
  label: "Generate SEO Metadata",
  description: "Meta title, meta description, keywords, and Open Graph tags",
  inputSchema,
  defaultMaxTokens: 600,
  buildPrompt: (input) => ({
    system:
      "You write SEO metadata for The Witness. metaTitle: under 60 characters, includes the core topic near the start. metaDescription: under 160 characters, a genuine summary that earns the click, not keyword-stuffed. keywords: 5-8 realistic search terms a reader would actually type, not generic single words. ogTitle/ogDescription: can be slightly more editorial/attention-grabbing than the meta tags, since Open Graph renders as a social card, not a search result. Respond with ONLY a JSON object: " +
      '{"metaTitle": string, "metaDescription": string, "keywords": string[], "ogTitle": string, "ogDescription": string}.',
    prompt: `Generate SEO metadata for this content:\n\n${input.content}`,
  }),
  parseResult: (rawText) => parseJsonResponse<GenerateSeoMetadataOutput>(rawText),
};

import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().min(1).max(15000),
  publicationName: z.string().min(1).max(200),
});
export type GeneratePdfContentInput = z.infer<typeof inputSchema>;

export interface PdfSection {
  heading: string;
  body: string;
}
export interface GeneratePdfContentOutput {
  coverTitle: string;
  coverSubtitle: string;
  pullQuote: string;
  sections: PdfSection[];
}

/**
 * "Generate PDF" is what this milestone's brief calls it, and it's worth
 * being precise about what that means here: an LLM cannot render a
 * binary PDF — page layout, typography, and pagination are a rendering
 * pipeline's job (Milestone 10, Publishing Pipeline), not a text
 * generation call's. What this function actually produces is the
 * content package a PDF layout would be built from: a cover
 * title/subtitle, one pull quote, and the issue reorganized into
 * PDF-appropriate sections (denser prose than a scrolling web page
 * favors, since a PDF reader can't infinite-scroll past a wall of text
 * the way a web page's design can accommodate with generous white
 * space). This is stored the same way Generate Email's output is
 * (Milestone 4's publication_templates where channel = 'pdf') — an
 * editor reviews and places it, a later milestone's rendering pipeline
 * turns it into an actual PDF file. See docs/AI_WORKSPACE.md.
 */
export const generatePdfContentFunction: AIFunctionDefinition<
  GeneratePdfContentInput,
  GeneratePdfContentOutput
> = {
  id: "generate_pdf_content",
  label: "Generate PDF Content",
  description: "Draft a cover title, pull quote, and print-formatted sections for the issue's PDF edition",
  inputSchema,
  defaultMaxTokens: 2500,
  buildPrompt: (input) => ({
    system:
      `You are formatting the print/PDF edition of ${input.publicationName} from its web content. A PDF reader can't scroll past a wall of text the way a web page can — reorganize into clearly headed sections rather than one long scroll. Pick the single strongest sentence from the content as a pull quote (verbatim, don't invent one). Respond with ONLY a JSON object: ` +
      '{"coverTitle": string, "coverSubtitle": string, "pullQuote": string, "sections": [{"heading": string, "body": string}]}.',
    prompt: `Format this issue content for print:\n\n${input.content}`,
  }),
  parseResult: (rawText) => parseJsonResponse<GeneratePdfContentOutput>(rawText),
};

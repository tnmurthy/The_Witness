import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const candidateSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  translation: z.string(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const inputSchema = z.object({
  issueTopic: z.string().min(1).max(2000),
  candidates: z.array(candidateSchema).min(1).max(60),
  count: z.number().int().min(1).max(5).default(3),
});
export type RecommendWisdomInput = z.infer<typeof inputSchema>;

export interface WisdomRecommendation {
  wisdomEntryId: string;
  score: number;
  rationale: string;
}
export interface RecommendWisdomOutput {
  recommendations: WisdomRecommendation[];
}

/**
 * Matches wisdom entries to an issue's topic via LLM judgment over an
 * explicit candidate list, not vector similarity search — Milestone 8
 * (Search) is what builds the embedding-generation pipeline that would
 * make a real nearest-neighbor search possible; wisdom_entries.embedding
 * (Migration 008) exists as a column but nothing populates it yet. This
 * is a deliberate, documented interim approach (see
 * docs/WISDOM_ENGINE.md), not a placeholder pretending to be the final
 * design — an LLM reading titles/translations/categories and picking
 * the most relevant ones is a reasonable, working recommendation
 * mechanism on its own, independent of whether vector search is added
 * later.
 *
 * The candidate pool is passed in by the caller (the API route queries
 * approved wisdom_entries), not fetched by this function itself —
 * keeping I/O out of the function definition means the model can only
 * ever recommend entries that actually exist and are approved; it
 * cannot hallucinate an id, because every id it's allowed to return was
 * explicitly offered to it in the prompt.
 */
export const recommendWisdomFunction: AIFunctionDefinition<RecommendWisdomInput, RecommendWisdomOutput> = {
  id: "recommend_wisdom",
  label: "Recommend Wisdom",
  description: "Suggest relevant Wisdom Engine entries for an issue's topic",
  inputSchema,
  defaultMaxTokens: 1000,
  buildPrompt: (input) => {
    const candidateList = input.candidates
      .map(
        (c) =>
          `- id: ${c.id}\n  title: ${c.title}\n  translation: "${c.translation}"${c.category ? `\n  category: ${c.category}` : ""}${c.keywords?.length ? `\n  keywords: ${c.keywords.join(", ")}` : ""}`
      )
      .join("\n");

    return {
      system:
        "You recommend wisdom entries (classical Indian philosophical/ethical texts, reframed for professional decision-making) that genuinely illuminate a technology/career publication's editorial topic — not a loose thematic word-association. Only recommend entries that would make a thoughtful editor say \"yes, that's exactly the right lens for this story,\" not merely ones that share a keyword. You may recommend fewer than requested if fewer are genuinely relevant. Respond with ONLY a JSON object: " +
        '{"recommendations": [{"wisdomEntryId": string, "score": number, "rationale": string}]}. score is 0-1, your own honest relevance estimate. rationale is one sentence explaining the specific connection to the topic. Only use ids from the candidate list below — never invent one.',
      prompt: `Issue topic: ${input.issueTopic}\n\nCandidate wisdom entries:\n${candidateList}\n\nRecommend up to ${input.count}.`,
    };
  },
  parseResult: (rawText) => {
    const parsed = parseJsonResponse<{ recommendations: WisdomRecommendation[] }>(rawText);
    return { recommendations: parsed.recommendations ?? [] };
  },
};

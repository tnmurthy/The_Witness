import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

/** The exact 6 categories this milestone's brief names for Issue Builder auto-suggestion — not the full 13-type Knowledge Graph, and deliberately narrower than suggest_graph_connections' any-entity scope. */
export const RELATED_ENTITY_CATEGORIES = ["company", "technology", "paper", "github_repository", "wisdom_entry", "article"] as const;
export type RelatedEntityCategory = (typeof RELATED_ENTITY_CATEGORIES)[number];

const candidateSchema = z.object({
  entityType: z.enum(RELATED_ENTITY_CATEGORIES),
  entityId: z.string().uuid(),
  label: z.string(),
  snippet: z.string().optional(),
});

const inputSchema = z.object({
  issueTopic: z.string().min(1).max(3000),
  candidates: z.array(candidateSchema).min(1).max(90),
  perCategoryCount: z.number().int().min(1).max(5).default(3),
});
export type RecommendRelatedEntitiesInput = z.infer<typeof inputSchema>;

export interface RelatedEntitySuggestion {
  entityType: RelatedEntityCategory;
  entityId: string;
  relationType: string;
  rationale: string;
}
export interface RecommendRelatedEntitiesOutput {
  suggestions: RelatedEntitySuggestion[];
}

/**
 * The Issue Builder's "automatically suggest related companies,
 * technologies, research, GitHub repositories, wisdom, and articles"
 * requirement. Two things distinguish this from suggest_graph_
 * connections (Knowledge Graph milestone, Migration 019):
 *
 * 1. Candidate building. suggest_graph_connections samples a handful of
 *    rows uniformly from every other entity type — a reasonable
 *    cold-start default when nothing else is known, but a weak signal
 *    when the caller already has real content to search against. This
 *    function's candidates are built by the caller (the API route)
 *    using full-text search against the issue's own topic — the same
 *    search_vector infrastructure /api/graph/retrieve uses — scoped to
 *    exactly these 6 categories. A candidate pool built from actual
 *    keyword relevance is a materially better starting point for the
 *    model's judgment than a random sample.
 *
 * 2. Output shape. Suggestions are grouped by category at the type
 *    level (entityType on each suggestion), matching how an editor
 *    reviews this in the UI: a "Companies" section, a "Technologies"
 *    section, and so on — not one undifferentiated list.
 *
 * Same anti-hallucination discipline as every other AI Workspace
 * function that recommends existing content (recommend_wisdom,
 * suggest_graph_connections): the model can only return an id it was
 * explicitly shown in the candidate list, and the calling route
 * verifies that before persisting anything.
 */
export const recommendRelatedEntitiesFunction: AIFunctionDefinition<RecommendRelatedEntitiesInput, RecommendRelatedEntitiesOutput> = {
  id: "recommend_related_entities",
  label: "Recommend Related Entities",
  description: "Suggest related companies, technologies, research, GitHub repositories, wisdom, and articles for an issue",
  inputSchema,
  defaultMaxTokens: 1500,
  buildPrompt: (input) => {
    const byCategory = new Map<RelatedEntityCategory, typeof input.candidates>();
    for (const c of input.candidates) {
      const list = byCategory.get(c.entityType) ?? [];
      list.push(c);
      byCategory.set(c.entityType, list);
    }

    const candidateBlock = Array.from(byCategory.entries())
      .map(([category, items]) => {
        const lines = items.map((c) => `  - id: ${c.entityId}, label: "${c.label}"${c.snippet ? `, note: "${c.snippet}"` : ""}`).join("\n");
        return `${category}:\n${lines}`;
      })
      .join("\n\n");

    return {
      system:
        "You recommend content connections for The Witness, a technology and career intelligence publication, while an editor is actively writing an issue. Across the six categories below (company, technology, paper, github_repository, wisdom_entry, article), pick the candidates that a thoughtful editor would genuinely want linked from this issue — not every candidate that shares a keyword, only ones with a real, specific connection to the topic. You do not have to suggest anything from a category with no strong match; an empty category is a correct, honest answer, not a failure. For each suggestion, pick the most specific relation type from: related, mentions, cites, discusses, implements, inspired_by. Respond with ONLY a JSON object: " +
        '{"suggestions": [{"entityType": string, "entityId": string, "relationType": string, "rationale": string}]}. Only use ids from the candidate list below — never invent one. Up to ' +
        `${input.perCategoryCount} suggestions per category.`,
      prompt: `Issue topic:\n${input.issueTopic}\n\nCandidates by category:\n\n${candidateBlock}`,
    };
  },
  parseResult: (rawText) => {
    const parsed = parseJsonResponse<{ suggestions: RelatedEntitySuggestion[] }>(rawText);
    return { suggestions: parsed.suggestions ?? [] };
  },
};

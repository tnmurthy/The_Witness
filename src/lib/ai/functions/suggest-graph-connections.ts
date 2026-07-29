import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";

const candidateSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  label: z.string(),
  description: z.string().optional(),
});

const inputSchema = z.object({
  sourceEntityType: z.string(),
  sourceLabel: z.string(),
  sourceDescription: z.string().optional(),
  candidates: z.array(candidateSchema).min(1).max(60),
  count: z.number().int().min(1).max(5).default(3),
});
export type SuggestGraphConnectionsInput = z.infer<typeof inputSchema>;

export interface SuggestedConnection {
  entityType: string;
  entityId: string;
  relationType: string;
  rationale: string;
}
export interface SuggestGraphConnectionsOutput {
  suggestions: SuggestedConnection[];
}

/**
 * Cold-start connection discovery: given one entity and a candidate pool
 * of other entities (the caller queries these — same pattern as
 * recommend_wisdom, Milestone 7), asks the model to suggest genuinely
 * meaningful edges an editor might want to confirm and create, each with
 * a specific relation type from the same constrained vocabulary the
 * database enforces (Migration 019's CHECK constraint) — not a free-text
 * relation the database would then reject.
 *
 * This exists because graph_neighbors() (Migration 019) can only ever
 * navigate edges that already exist — it has no way to discover a
 * connection nobody has recorded yet. That's exactly the gap between
 * "graph navigation" and "AI retrieval" this milestone's brief lists as
 * two separate capabilities: navigation traverses what's there;
 * suggestion proposes what's missing, for a human to accept or reject
 * (POST /api/graph/edges still requires an explicit editor action to
 * actually create the edge — this function only suggests).
 */
export const suggestGraphConnectionsFunction: AIFunctionDefinition<
  SuggestGraphConnectionsInput,
  SuggestGraphConnectionsOutput
> = {
  id: "suggest_graph_connections",
  label: "Suggest Graph Connections",
  description: "Propose meaningful new Knowledge Graph edges for an entity, from a candidate pool",
  inputSchema,
  defaultMaxTokens: 1000,
  buildPrompt: (input) => {
    const candidateList = input.candidates
      .map(
        (c) =>
          `- entityType: ${c.entityType}, id: ${c.entityId}, label: "${c.label}"${c.description ? `, description: "${c.description}"` : ""}`
      )
      .join("\n");

    return {
      system:
        "You suggest Knowledge Graph connections for The Witness, a technology and career intelligence publication. Given one entity and a list of candidate entities, propose which candidates have a genuine, specific relationship to it — not a loose thematic association. Every suggestion must use one of these exact relation types: related, mentions, cites, authored_by, works_at, founded, built, invested_in, teaches, implements, inspired_by, discusses, part_of, attributed_to — choose the most specific one that actually fits, falling back to 'related' only when none of the more specific types apply. Respond with ONLY a JSON object: " +
        '{"suggestions": [{"entityType": string, "entityId": string, "relationType": string, "rationale": string}]}. Only use ids and types from the candidate list — never invent one. It is correct to suggest fewer than requested if fewer are genuinely meaningful.',
      prompt: `Entity: ${input.sourceEntityType} — "${input.sourceLabel}"${input.sourceDescription ? `\nDescription: ${input.sourceDescription}` : ""}\n\nCandidates:\n${candidateList}\n\nSuggest up to ${input.count} connections.`,
    };
  },
  parseResult: (rawText) => {
    const parsed = parseJsonResponse<{ suggestions: SuggestedConnection[] }>(rawText);
    return { suggestions: parsed.suggestions ?? [] };
  },
};

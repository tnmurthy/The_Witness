import { describe, it, expect } from "vitest";
import { recommendRelatedEntitiesFunction, RELATED_ENTITY_CATEGORIES } from "@/lib/ai/functions/recommend-related-entities";
import { AI_FUNCTION_IDS } from "@/lib/ai/functions/registry";

describe("RELATED_ENTITY_CATEGORIES", () => {
  it("is exactly the 6 categories this milestone's brief names for Issue Builder auto-suggestion", () => {
    expect(RELATED_ENTITY_CATEGORIES.slice().sort()).toEqual(
      ["company", "technology", "paper", "github_repository", "wisdom_entry", "article"].sort()
    );
  });
});

describe("recommendRelatedEntitiesFunction", () => {
  it("is registered in the AI functions registry", () => {
    expect(AI_FUNCTION_IDS).toContain("recommend_related_entities");
  });

  it("rejects a candidate with an entity type outside the 6 categories", () => {
    const result = recommendRelatedEntitiesFunction.inputSchema.safeParse({
      issueTopic: "X",
      candidates: [{ entityType: "person", entityId: "11111111-1111-1111-1111-111111111111", label: "Y" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty candidate list", () => {
    const result = recommendRelatedEntitiesFunction.inputSchema.safeParse({ issueTopic: "X", candidates: [] });
    expect(result.success).toBe(false);
  });

  it("buildPrompt groups candidates by category in the prompt text, not one flat list", () => {
    const input = recommendRelatedEntitiesFunction.inputSchema.parse({
      issueTopic: "The return of on-premise AI infrastructure",
      candidates: [
        { entityType: "company", entityId: "11111111-1111-1111-1111-111111111111", label: "Vectorwise AI" },
        { entityType: "technology", entityId: "22222222-2222-2222-2222-222222222222", label: "Vector Databases" },
      ],
    });
    const { prompt } = recommendRelatedEntitiesFunction.buildPrompt(input);
    expect(prompt).toContain("company:");
    expect(prompt).toContain("technology:");
    expect(prompt.indexOf("company:")).toBeLessThan(prompt.indexOf("11111111-1111-1111-1111-111111111111"));
  });

  it("buildPrompt includes every candidate's exact id so the model cannot invent one", () => {
    const input = recommendRelatedEntitiesFunction.inputSchema.parse({
      issueTopic: "X",
      candidates: [{ entityType: "paper", entityId: "33333333-3333-3333-3333-333333333333", label: "Attention Is All You Need" }],
    });
    const { prompt } = recommendRelatedEntitiesFunction.buildPrompt(input);
    expect(prompt).toContain("33333333-3333-3333-3333-333333333333");
  });

  it("buildPrompt's system message explicitly permits an empty category as a correct answer, not a failure", () => {
    const input = recommendRelatedEntitiesFunction.inputSchema.parse({
      issueTopic: "X",
      candidates: [{ entityType: "article", entityId: "44444444-4444-4444-4444-444444444444", label: "Y" }],
    });
    const { system } = recommendRelatedEntitiesFunction.buildPrompt(input);
    expect(system).toBeDefined();
    expect(system!.toLowerCase()).toContain("empty category");
  });

  it("parseResult returns an empty array rather than throwing when nothing is suggested", () => {
    const result = recommendRelatedEntitiesFunction.parseResult(JSON.stringify({ suggestions: [] }));
    expect(result.suggestions).toEqual([]);
  });

  it("parseResult preserves entityType so suggestions can be grouped back by category", () => {
    const raw = JSON.stringify({
      suggestions: [{ entityType: "company", entityId: "11111111-1111-1111-1111-111111111111", relationType: "mentions", rationale: "X" }],
    });
    const result = recommendRelatedEntitiesFunction.parseResult(raw);
    expect(result.suggestions[0]?.entityType).toBe("company");
  });
});

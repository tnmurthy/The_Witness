import { describe, it, expect } from "vitest";
import { GRAPH_ENTITY_TYPES, GRAPH_ENTITY_LABELS, GRAPH_ENTITY_TABLE, GRAPH_RELATION_TYPES } from "@/lib/graph/types";
import { createEdgeSchema, createPersonSchema, retrieveQuerySchema } from "@/lib/validation/graph";
import { suggestGraphConnectionsFunction } from "@/lib/ai/functions/suggest-graph-connections";
import { AI_FUNCTION_IDS } from "@/lib/ai/functions/registry";

describe("GRAPH_ENTITY_TYPES", () => {
  it("has all 11 node types from the milestone's chain, plus source", () => {
    const expected = [
      "technology",
      "company",
      "article",
      "book",
      "paper",
      "course",
      "github_repository",
      "wisdom_entry",
      "person",
      "issue",
      "video",
      "podcast",
      "source",
    ];
    expect(GRAPH_ENTITY_TYPES.slice().sort()).toEqual(expected.slice().sort());
  });

  it("every entity type has a display label and a table mapping", () => {
    for (const type of GRAPH_ENTITY_TYPES) {
      expect(GRAPH_ENTITY_LABELS[type]).toBeTruthy();
      expect(GRAPH_ENTITY_TABLE[type]).toBeDefined();
      expect(GRAPH_ENTITY_TABLE[type].table).toBeTruthy();
      expect(GRAPH_ENTITY_TABLE[type].titleColumn).toBeTruthy();
    }
  });

  it("technology, company, and github_repository use the name column; person uses full_name; everything else uses title", () => {
    expect(GRAPH_ENTITY_TABLE.technology.titleColumn).toBe("name");
    expect(GRAPH_ENTITY_TABLE.company.titleColumn).toBe("name");
    expect(GRAPH_ENTITY_TABLE.github_repository.titleColumn).toBe("name");
    expect(GRAPH_ENTITY_TABLE.person.titleColumn).toBe("full_name");
    expect(GRAPH_ENTITY_TABLE.article.titleColumn).toBe("title");
    expect(GRAPH_ENTITY_TABLE.wisdom_entry.titleColumn).toBe("title");
  });
});

describe("GRAPH_RELATION_TYPES", () => {
  it("includes 'related' as the honest fallback plus specific semantic relations", () => {
    expect(GRAPH_RELATION_TYPES).toContain("related");
    expect(GRAPH_RELATION_TYPES).toContain("authored_by");
    expect(GRAPH_RELATION_TYPES).toContain("founded");
    expect(GRAPH_RELATION_TYPES.length).toBeGreaterThan(5);
  });
});

describe("createEdgeSchema", () => {
  it("accepts a valid edge and defaults relationType to related", () => {
    const parsed = createEdgeSchema.parse({
      sourceType: "person",
      sourceId: "11111111-1111-1111-1111-111111111111",
      targetType: "company",
      targetId: "22222222-2222-2222-2222-222222222222",
    });
    expect(parsed.relationType).toBe("related");
  });

  it("rejects an invalid relation type", () => {
    const result = createEdgeSchema.safeParse({
      sourceType: "person",
      sourceId: "11111111-1111-1111-1111-111111111111",
      targetType: "company",
      targetId: "22222222-2222-2222-2222-222222222222",
      relationType: "made_up_relation",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid entity type", () => {
    const result = createEdgeSchema.safeParse({
      sourceType: "not_a_real_type",
      sourceId: "11111111-1111-1111-1111-111111111111",
      targetType: "company",
      targetId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPersonSchema", () => {
  it("requires a full name and defaults externalLinks to an empty object", () => {
    const parsed = createPersonSchema.parse({ fullName: "Ada Lovelace" });
    expect(parsed.externalLinks).toEqual({});
  });

  it("rejects an empty name", () => {
    expect(createPersonSchema.safeParse({ fullName: "" }).success).toBe(false);
  });
});

describe("retrieveQuerySchema", () => {
  it("defaults limit to 10", () => {
    expect(retrieveQuerySchema.parse({ query: "vector databases" }).limit).toBe(10);
  });

  it("rejects an empty query", () => {
    expect(retrieveQuerySchema.safeParse({ query: "" }).success).toBe(false);
  });

  it("accepts an optional expandFrom seed", () => {
    const parsed = retrieveQuerySchema.parse({
      query: "AI infrastructure",
      expandFrom: { entityType: "technology", entityId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(parsed.expandFrom?.entityType).toBe("technology");
  });
});

describe("suggestGraphConnectionsFunction", () => {
  it("is registered in the AI functions registry", () => {
    expect(AI_FUNCTION_IDS).toContain("suggest_graph_connections");
  });

  it("buildPrompt lists every candidate's exact id so the model cannot invent one", () => {
    const input = suggestGraphConnectionsFunction.inputSchema.parse({
      sourceEntityType: "issue",
      sourceLabel: "The return of on-premise AI",
      candidates: [{ entityType: "technology", entityId: "11111111-1111-1111-1111-111111111111", label: "Vector Databases" }],
    });
    const { prompt } = suggestGraphConnectionsFunction.buildPrompt(input);
    expect(prompt).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("buildPrompt's system message enumerates the exact constrained relation vocabulary", () => {
    const input = suggestGraphConnectionsFunction.inputSchema.parse({
      sourceEntityType: "issue",
      sourceLabel: "X",
      candidates: [{ entityType: "technology", entityId: "11111111-1111-1111-1111-111111111111", label: "Y" }],
    });
    const { system } = suggestGraphConnectionsFunction.buildPrompt(input);
    for (const relation of GRAPH_RELATION_TYPES) {
      expect(system).toContain(relation);
    }
  });

  it("parseResult returns an empty array rather than throwing when nothing is suggested", () => {
    const result = suggestGraphConnectionsFunction.parseResult(JSON.stringify({ suggestions: [] }));
    expect(result.suggestions).toEqual([]);
  });
});

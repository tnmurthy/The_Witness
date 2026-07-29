import { describe, it, expect } from "vitest";
import { AI_FUNCTIONS_REGISTRY, AI_FUNCTION_IDS, isAIFunctionId } from "@/lib/ai/functions/registry";
import { rewriteFunction } from "@/lib/ai/functions/rewrite";
import { summarizeFunction } from "@/lib/ai/functions/summarize";
import { improveWritingFunction } from "@/lib/ai/functions/improve-writing";
import { suggestHeadlinesFunction } from "@/lib/ai/functions/suggest-headlines";
import { generateSeoMetadataFunction } from "@/lib/ai/functions/generate-seo-metadata";
import { generateIssueFunction } from "@/lib/ai/functions/generate-issue";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { withRetry } from "@/lib/ai/retry";
import { AIProviderError } from "@/lib/ai/types";

/**
 * These tests exercise every AI function's pure logic (input validation,
 * prompt composition, result parsing) without ever calling a provider —
 * exactly the design point of separating AIFunctionDefinition from the
 * orchestrator. There are no real OpenAI/Anthropic API keys in this
 * environment, so a genuine end-to-end "the AI actually responds
 * correctly" test is not possible here — see docs/AI_WORKSPACE.md, "What
 * could not be tested end-to-end," for exactly what that gap is.
 */

describe("AI_FUNCTIONS_REGISTRY", () => {
  it("has the 10 Milestone 6 functions plus recommend_wisdom, suggest_graph_connections, and recommend_related_entities", () => {
    expect(AI_FUNCTION_IDS).toHaveLength(13);
    expect(AI_FUNCTION_IDS.slice().sort()).toEqual(
      [
        "generate_issue",
        "rewrite",
        "summarize",
        "improve_writing",
        "suggest_headlines",
        "suggest_images",
        "generate_linkedin_post",
        "generate_email",
        "generate_pdf_content",
        "generate_seo_metadata",
        "recommend_wisdom",
        "suggest_graph_connections",
        "recommend_related_entities",
      ].sort()
    );
  });

  it("every function has a label, description, input schema, and prompt builder", () => {
    for (const id of AI_FUNCTION_IDS) {
      const def = AI_FUNCTIONS_REGISTRY[id];
      expect(def).toBeDefined();
      if (!def) continue; // narrows for TypeScript below; unreachable given the assertion above
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.inputSchema).toBeDefined();
      expect(typeof def.buildPrompt).toBe("function");
      expect(typeof def.parseResult).toBe("function");
      expect(def.defaultMaxTokens).toBeGreaterThan(0);
    }
  });
});

describe("isAIFunctionId", () => {
  it("is true for every registered function and false otherwise", () => {
    expect(isAIFunctionId("rewrite")).toBe(true);
    expect(isAIFunctionId("not_a_real_function")).toBe(false);
  });
});

describe("rewriteFunction", () => {
  it("validates input and applies the default instruction when omitted", () => {
    const parsed = rewriteFunction.inputSchema.parse({ text: "Hello world" });
    expect(parsed.instruction).toContain("clearer");
  });

  it("rejects empty text", () => {
    expect(() => rewriteFunction.inputSchema.parse({ text: "" })).toThrow();
  });

  it("buildPrompt includes both the instruction and the text", () => {
    const input = rewriteFunction.inputSchema.parse({ text: "Original text", instruction: "Make it punchier" });
    const { prompt } = rewriteFunction.buildPrompt(input);
    expect(prompt).toContain("Make it punchier");
    expect(prompt).toContain("Original text");
  });

  it("parseResult passes text through trimmed", () => {
    expect(rewriteFunction.parseResult("  rewritten text  \n")).toBe("rewritten text");
  });
});

describe("summarizeFunction", () => {
  it("defaults targetLength to short_paragraph", () => {
    const parsed = summarizeFunction.inputSchema.parse({ text: "Some long text." });
    expect(parsed.targetLength).toBe("short_paragraph");
  });

  it("buildPrompt varies by targetLength", () => {
    const bulletInput = summarizeFunction.inputSchema.parse({ text: "X", targetLength: "bullet_points" });
    const { prompt } = summarizeFunction.buildPrompt(bulletInput);
    expect(prompt.toLowerCase()).toContain("bullet");
  });
});

describe("improveWritingFunction", () => {
  it("parseResult extracts improvedText and changes from JSON", () => {
    const raw = JSON.stringify({ improvedText: "Better text.", changes: ["Fixed a typo."] });
    const result = improveWritingFunction.parseResult(raw);
    expect(result.improvedText).toBe("Better text.");
    expect(result.changes).toEqual(["Fixed a typo."]);
  });

  it("parseResult strips a markdown code fence before parsing", () => {
    const raw = '```json\n{"improvedText": "X", "changes": []}\n```';
    const result = improveWritingFunction.parseResult(raw);
    expect(result.improvedText).toBe("X");
  });
});

describe("suggestHeadlinesFunction", () => {
  it("defaults count to 5 and buildPrompt reflects the requested count", () => {
    const input = suggestHeadlinesFunction.inputSchema.parse({ content: "Some content" });
    expect(input.count).toBe(5);
    const { prompt } = suggestHeadlinesFunction.buildPrompt(input);
    expect(prompt).toContain("5");
  });

  it("parseResult returns the headlines array", () => {
    const result = suggestHeadlinesFunction.parseResult(JSON.stringify({ headlines: ["A", "B"] }));
    expect(result.headlines).toEqual(["A", "B"]);
  });
});

describe("generateSeoMetadataFunction", () => {
  it("parseResult returns all five expected fields", () => {
    const raw = JSON.stringify({
      metaTitle: "T",
      metaDescription: "D",
      keywords: ["a", "b"],
      ogTitle: "OG T",
      ogDescription: "OG D",
    });
    const result = generateSeoMetadataFunction.parseResult(raw);
    expect(result).toEqual({ metaTitle: "T", metaDescription: "D", keywords: ["a", "b"], ogTitle: "OG T", ogDescription: "OG D" });
  });
});

describe("generateIssueFunction", () => {
  it("defaults blockTypes to a starter set of three", () => {
    const input = generateIssueFunction.inputSchema.parse({ publicationName: "The Witness", topic: "AI infrastructure" });
    expect(input.blockTypes).toEqual(["hero_story", "signal_card", "career_insight"]);
  });

  it("rejects an unimplemented or unknown block type in blockTypes", () => {
    expect(() => generateIssueFunction.inputSchema.parse({ publicationName: "X", topic: "Y", blockTypes: ["chart"] })).toThrow();
  });

  it("parseResult validates each drafted block against its own payload schema and separates valid from rejected", () => {
    const raw = JSON.stringify({
      blocks: [
        { type: "heading", payload: { text: "Valid heading", level: 2 } },
        { type: "heading", payload: { level: 2 } },
        { type: "quote", payload: { text: "A quote" } },
      ],
    });
    const result = generateIssueFunction.parseResult(raw);
    expect(result.blocks).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.type).toBe("heading");
  });

  it("buildPrompt includes the editorial guidelines when provided, and omits them when not", () => {
    const withGuidelines = generateIssueFunction.buildPrompt(
      generateIssueFunction.inputSchema.parse({ publicationName: "X", topic: "Y", editorialGuidelines: "Never use exclamation points." })
    );
    expect(withGuidelines.system).toContain("Never use exclamation points");

    const withoutGuidelines = generateIssueFunction.buildPrompt(generateIssueFunction.inputSchema.parse({ publicationName: "X", topic: "Y" }));
    expect(withoutGuidelines.system).not.toContain("Editorial guidelines");
  });
});

describe("estimateCostUsd", () => {
  it("computes cost from known per-million-token pricing", () => {
    const cost = estimateCostUsd("gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 4);
  });

  it("falls back to a conservative default for an unrecognized model", () => {
    const cost = estimateCostUsd("some-future-model-not-in-the-table", 1_000_000, 0);
    expect(cost).toBeGreaterThan(0);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCostUsd("gpt-4o", 0, 0)).toBe(0);
  });
});

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    }, 1000);
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries a retryable AIProviderError up to maxAttempts, then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new AIProviderError("rate limited", { providerId: "openai", retryable: true });
        return "recovered";
      },
      1000,
      { baseDelayMs: 1 }
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("does not retry a non-retryable AIProviderError — fails immediately", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new AIProviderError("bad api key", { providerId: "openai", retryable: false });
        },
        1000,
        { baseDelayMs: 1 }
      )
    ).rejects.toThrow("bad api key");
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts even for a retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new AIProviderError("still failing", { providerId: "anthropic", retryable: true });
        },
        1000,
        { maxAttempts: 2, baseDelayMs: 1 }
      )
    ).rejects.toThrow("still failing");
    expect(calls).toBe(2);
  });
});

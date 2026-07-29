import { describe, it, expect } from "vitest";
import {
  wisdomSourceTypeSchema,
  WISDOM_SOURCE_LABELS,
  sourceFieldsSchemaFor,
  createWisdomEntrySchema,
} from "@/lib/validation/wisdom";
import { recommendWisdomFunction } from "@/lib/ai/functions/recommend-wisdom";

describe("wisdomSourceTypeSchema", () => {
  it("accepts all 7 named sources from the Milestone 7 brief plus 'other'", () => {
    const sources = [
      "gita_verse",
      "advaita_principle",
      "upanishad_verse",
      "subhashitam",
      "chanakya_niti_verse",
      "panchatantra_tale",
      "hitopadesha_story",
      "other",
    ];
    for (const source of sources) {
      expect(wisdomSourceTypeSchema.safeParse(source).success).toBe(true);
    }
  });

  it("rejects an unknown source", () => {
    expect(wisdomSourceTypeSchema.safeParse("mahabharata_verse").success).toBe(false);
  });

  it("every source type has a display label", () => {
    for (const source of wisdomSourceTypeSchema.options) {
      expect(WISDOM_SOURCE_LABELS[source]).toBeTruthy();
    }
  });
});

describe("sourceFieldsSchemaFor", () => {
  it("returns a schema requiring chapter+verse for gita_verse and chanakya_niti_verse", () => {
    for (const source of ["gita_verse", "chanakya_niti_verse"] as const) {
      const schema = sourceFieldsSchemaFor(source);
      expect(schema?.safeParse({ chapter: 2, verse: 47 }).success).toBe(true);
      expect(schema?.safeParse({ chapter: 2 }).success).toBe(false);
    }
  });

  it("returns a schema requiring tantraNumber between 1 and 5 for panchatantra_tale", () => {
    const schema = sourceFieldsSchemaFor("panchatantra_tale");
    expect(
      schema?.safeParse({
        tantraNumber: 4,
        tantraName: "Labdhapranasha",
        taleTitle: "The Monkey and the Crocodile",
      }).success
    ).toBe(true);
    expect(schema?.safeParse({ tantraNumber: 6, tantraName: "X", taleTitle: "Y" }).success).toBe(false);
  });

  it("returns a schema where upanishad_verse's chapter/verse are optional but the name is required", () => {
    const schema = sourceFieldsSchemaFor("upanishad_verse");
    expect(schema?.safeParse({ upanishadName: "Isha Upanishad" }).success).toBe(true);
    expect(schema?.safeParse({}).success).toBe(false);
  });

  it("returns null for 'other' — no specialization table exists for it", () => {
    expect(sourceFieldsSchemaFor("other")).toBeNull();
  });
});

describe("createWisdomEntrySchema", () => {
  it("accepts a minimal valid entry", () => {
    const result = createWisdomEntrySchema.safeParse({
      title: "On detachment",
      sourceType: "gita_verse",
      translation: "You have a right to action alone.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an entry with no translation", () => {
    const result = createWisdomEntrySchema.safeParse({ title: "X", sourceType: "gita_verse" });
    expect(result.success).toBe(false);
  });

  it("defaults array fields to empty arrays", () => {
    const parsed = createWisdomEntrySchema.parse({ title: "X", sourceType: "other", translation: "Y" });
    expect(parsed.keywords).toEqual([]);
    expect(parsed.reflectionQuestions).toEqual([]);
    expect(parsed.exercises).toEqual([]);
    expect(parsed.relatedWisdomIds).toEqual([]);
  });
});

describe("recommendWisdomFunction", () => {
  it("buildPrompt includes every candidate's id so the model can only recommend an id it was actually given", () => {
    const input = recommendWisdomFunction.inputSchema.parse({
      issueTopic: "The return of on-premise AI infrastructure",
      candidates: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          title: "On detachment",
          translation: "Act without attachment.",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          title: "On patience",
          translation: "Patience is strength.",
        },
      ],
    });
    const { prompt } = recommendWisdomFunction.buildPrompt(input);
    expect(prompt).toContain("11111111-1111-1111-1111-111111111111");
    expect(prompt).toContain("22222222-2222-2222-2222-222222222222");
  });

  it("rejects an empty candidate list", () => {
    expect(() => recommendWisdomFunction.inputSchema.parse({ issueTopic: "X", candidates: [] })).toThrow();
  });

  it("parseResult returns an empty recommendations array rather than throwing when the model recommends nothing", () => {
    const result = recommendWisdomFunction.parseResult(JSON.stringify({ recommendations: [] }));
    expect(result.recommendations).toEqual([]);
  });

  it("parseResult extracts score and rationale alongside the id", () => {
    const raw = JSON.stringify({
      recommendations: [
        {
          wisdomEntryId: "11111111-1111-1111-1111-111111111111",
          score: 0.92,
          rationale: "Directly addresses attachment to a specific vendor outcome.",
        },
      ],
    });
    const result = recommendWisdomFunction.parseResult(raw);
    expect(result.recommendations[0]).toEqual({
      wisdomEntryId: "11111111-1111-1111-1111-111111111111",
      score: 0.92,
      rationale: "Directly addresses attachment to a specific vendor outcome.",
    });
  });
});

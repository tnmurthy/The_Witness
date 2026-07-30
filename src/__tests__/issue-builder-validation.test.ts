import { describe, it, expect } from "vitest";
import {
  createIssueSchema,
  createSectionSchema,
  createBlockSchema,
  updateBlockSchema,
  reorderBlocksSchema,
  createRevisionSchema,
} from "@/lib/validation/issue-builder";

describe("createIssueSchema", () => {
  it("accepts a valid issue creation payload", () => {
    const result = createIssueSchema.safeParse({
      publicationId: "11111111-1111-1111-1111-111111111111",
      title: "New Issue",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      createIssueSchema.safeParse({ publicationId: "11111111-1111-1111-1111-111111111111", title: "" })
        .success
    ).toBe(false);
  });

  it("rejects a non-UUID publicationId", () => {
    expect(createIssueSchema.safeParse({ publicationId: "not-a-uuid", title: "X" }).success).toBe(false);
  });
});

describe("createSectionSchema", () => {
  it("accepts an empty object — every field is optional", () => {
    expect(createSectionSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a negative position", () => {
    expect(createSectionSchema.safeParse({ position: -1 }).success).toBe(false);
  });
});

describe("createBlockSchema", () => {
  it("accepts a valid block type with a default empty payload", () => {
    const parsed = createBlockSchema.parse({ type: "paragraph" });
    expect(parsed.payload).toEqual({});
  });

  it("rejects an invalid block type", () => {
    expect(createBlockSchema.safeParse({ type: "not_a_real_block_type" }).success).toBe(false);
  });

  it("accepts every block type in ALL_BLOCK_TYPES, including the 4 unimplemented-in-UI ones", () => {
    for (const type of ["chart", "book_recommendation", "technology_radar", "decision_framework"]) {
      expect(createBlockSchema.safeParse({ type }).success).toBe(true);
    }
  });
});

describe("updateBlockSchema", () => {
  it("accepts a payload-only update", () => {
    expect(updateBlockSchema.safeParse({ payload: { text: "x" } }).success).toBe(true);
  });

  it("accepts a position/sectionId-only update (drag-and-drop move)", () => {
    expect(
      updateBlockSchema.safeParse({ position: 2, sectionId: "11111111-1111-1111-1111-111111111111" }).success
    ).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(updateBlockSchema.safeParse({}).success).toBe(true);
  });
});

describe("reorderBlocksSchema", () => {
  it("requires at least one block", () => {
    expect(reorderBlocksSchema.safeParse({ blocks: [] }).success).toBe(false);
  });

  it("accepts a valid multi-block reorder payload", () => {
    const result = reorderBlocksSchema.safeParse({
      blocks: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          sectionId: "22222222-2222-2222-2222-222222222222",
          position: 0,
        },
        {
          id: "33333333-3333-3333-3333-333333333333",
          sectionId: "22222222-2222-2222-2222-222222222222",
          position: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("createRevisionSchema", () => {
  it("accepts an empty object — label is optional", () => {
    expect(createRevisionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a labeled checkpoint", () => {
    expect(createRevisionSchema.safeParse({ label: "Before restore" }).success).toBe(true);
  });
});

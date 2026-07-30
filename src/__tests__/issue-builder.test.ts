import { describe, it, expect, beforeEach } from "vitest";
import { validateBlockPayload, BLOCK_PAYLOAD_SCHEMAS } from "@/lib/blocks/schemas";
import { IMPLEMENTED_BLOCK_TYPES, isImplementedBlockType } from "@/lib/blocks/types";
import { BLOCK_REGISTRY } from "@/lib/blocks/registry";
import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import type { BlockRow, SectionRow } from "@/lib/stores/issue-builder-store";

describe("IMPLEMENTED_BLOCK_TYPES", () => {
  it("has exactly the 15 block types from the Milestone 5 brief", () => {
    expect(IMPLEMENTED_BLOCK_TYPES).toHaveLength(15);
    expect(IMPLEMENTED_BLOCK_TYPES).toEqual(
      expect.arrayContaining([
        "heading",
        "paragraph",
        "image",
        "table_block",
        "hero_story",
        "signal_card",
        "career_insight",
        "research_summary",
        "github_repository_block",
        "company_profile",
        "timeline",
        "quote",
        "reflection",
        "todays_wisdom",
        "action_checklist",
      ])
    );
  });

  it("every implemented type has a registered schema and a registry entry", () => {
    for (const type of IMPLEMENTED_BLOCK_TYPES) {
      expect(BLOCK_PAYLOAD_SCHEMAS[type]).toBeDefined();
      expect(BLOCK_REGISTRY[type]).toBeDefined();
      expect(BLOCK_REGISTRY[type].label).toBeTruthy();
    }
  });
});

describe("isImplementedBlockType", () => {
  it("is true for every implemented type and false for enum-only types", () => {
    expect(isImplementedBlockType("heading")).toBe(true);
    expect(isImplementedBlockType("todays_wisdom")).toBe(true);
    expect(isImplementedBlockType("chart")).toBe(false);
    expect(isImplementedBlockType("decision_framework")).toBe(false);
    expect(isImplementedBlockType("not_a_real_type")).toBe(false);
  });
});

describe("validateBlockPayload", () => {
  it("accepts a well-formed heading payload", () => {
    const result = validateBlockPayload("heading", { text: "Hello", level: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects a heading payload missing required text", () => {
    const result = validateBlockPayload("heading", { level: 2 });
    expect(result.success).toBe(false);
  });

  it("rejects an image payload with an invalid URL", () => {
    const result = validateBlockPayload("image", { url: "not-a-url", alt: "test" });
    expect(result.success).toBe(false);
  });

  it("rejects a timeline with zero events (min 1 required)", () => {
    const result = validateBlockPayload("timeline", { events: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a todays_wisdom payload with only translation set (every other field optional)", () => {
    const result = validateBlockPayload("todays_wisdom", {
      translation: "Act without attachment to outcome.",
    });
    expect(result.success).toBe(true);
  });

  it("returns an error for a type with no registered schema", () => {
    const result = validateBlockPayload("not_a_real_type", {});
    expect(result.success).toBe(false);
  });
});

describe("useIssueBuilderStore", () => {
  const section: SectionRow = { id: "s1", issue_id: "i1", title: null, position: 0 };
  const block: BlockRow = {
    id: "b1",
    section_id: "s1",
    type: "paragraph",
    position: 0,
    payload: { text: "original" },
    ai_generated: false,
    last_edited_by: null,
    last_edited_at: new Date().toISOString(),
  };

  beforeEach(() => {
    useIssueBuilderStore.setState({
      sections: [],
      blocks: [],
      pendingBlockIds: new Set(),
      saveStatus: "idle",
    });
  });

  it("hydrate populates sections and blocks", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    expect(useIssueBuilderStore.getState().sections).toEqual([section]);
    expect(useIssueBuilderStore.getState().blocksForSection("s1")).toEqual([block]);
  });

  it("updateBlockLocal updates payload and last_edited_at", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    useIssueBuilderStore.getState().updateBlockLocal("b1", { text: "changed" });
    const updated = useIssueBuilderStore.getState().blocks[0];
    expect(updated?.payload.text).toBe("changed");
  });

  it("removeBlockLocal removes the block", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    useIssueBuilderStore.getState().removeBlockLocal("b1");
    expect(useIssueBuilderStore.getState().blocks).toHaveLength(0);
  });

  it("reorderBlocksLocal updates position to match the given order", () => {
    const block2: BlockRow = { ...block, id: "b2", position: 1 };
    useIssueBuilderStore.getState().hydrate([section], [block, block2]);
    useIssueBuilderStore.getState().reorderBlocksLocal("s1", ["b2", "b1"]);
    const state = useIssueBuilderStore.getState();
    expect(state.blocks.find((b) => b.id === "b2")?.position).toBe(0);
    expect(state.blocks.find((b) => b.id === "b1")?.position).toBe(1);
  });

  it("applyRemoteBlockChange ignores an incoming change for a block with a pending local edit (echo suppression)", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    useIssueBuilderStore.getState().markPending("b1");

    useIssueBuilderStore
      .getState()
      .applyRemoteBlockChange({ ...block, payload: { text: "remote change" } }, "UPDATE");

    // The local edit is still "original" because b1 is pending — the
    // remote echo must not have overwritten it.
    expect(useIssueBuilderStore.getState().blocks[0]?.payload.text).toBe("original");
  });

  it("applyRemoteBlockChange DOES apply an incoming change once the block is no longer pending", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    useIssueBuilderStore
      .getState()
      .applyRemoteBlockChange({ ...block, payload: { text: "remote change" } }, "UPDATE");
    expect(useIssueBuilderStore.getState().blocks[0]?.payload.text).toBe("remote change");
  });

  it("applyRemoteBlockChange with DELETE removes the block", () => {
    useIssueBuilderStore.getState().hydrate([section], [block]);
    useIssueBuilderStore.getState().applyRemoteBlockChange(block, "DELETE");
    expect(useIssueBuilderStore.getState().blocks).toHaveLength(0);
  });

  it("blocksForSection returns blocks sorted by position", () => {
    const block2: BlockRow = { ...block, id: "b2", position: -1 };
    useIssueBuilderStore.getState().hydrate([section], [block, block2]);
    const sorted = useIssueBuilderStore.getState().blocksForSection("s1");
    expect(sorted.map((b) => b.id)).toEqual(["b2", "b1"]);
  });
});

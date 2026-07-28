import { create } from "zustand";
import type { ImplementedBlockType } from "@/lib/blocks/types";

export interface BlockRow {
  id: string;
  section_id: string;
  type: ImplementedBlockType | string;
  position: number;
  payload: Record<string, unknown>;
  ai_generated: boolean;
  last_edited_by: string | null;
  last_edited_at: string;
}

export interface SectionRow {
  id: string;
  issue_id: string;
  title: string | null;
  position: number;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface IssueBuilderState {
  issueId: string | null;
  sections: SectionRow[];
  blocks: BlockRow[];
  saveStatus: SaveStatus;
  /** Block ids with an in-flight or debounce-pending save — drives the per-block "saving" affordance and prevents a stale Realtime echo from clobbering a not-yet-persisted local edit (see docs/ISSUE_BUILDER.md, "Echo suppression"). */
  pendingBlockIds: Set<string>;

  hydrate: (sections: SectionRow[], blocks: BlockRow[]) => void;
  setSaveStatus: (status: SaveStatus) => void;

  addBlockLocal: (block: BlockRow) => void;
  updateBlockLocal: (id: string, payload: Record<string, unknown>) => void;
  removeBlockLocal: (id: string) => void;
  reorderBlocksLocal: (sectionId: string, orderedIds: string[]) => void;
  moveBlockToSectionLocal: (blockId: string, targetSectionId: string, orderedIds: string[]) => void;

  markPending: (blockId: string) => void;
  clearPending: (blockId: string) => void;

  /** Applied when a Realtime postgres_changes event arrives from another client — never overwrites a block currently in pendingBlockIds, so a collaborator's stale broadcast can't stomp on an edit still being typed locally. */
  applyRemoteBlockChange: (block: BlockRow, eventType: "INSERT" | "UPDATE" | "DELETE") => void;

  blocksForSection: (sectionId: string) => BlockRow[];
}

/**
 * Client-side editor state (Solution Architecture doc's Issue Builder
 * state-management note: "dedicated client-side editor store (Zustand)
 * holding the block tree for optimistic drag-and-drop reordering, synced
 * to the server via debounced autosave"). This store IS the block tree
 * the canvas renders from — API calls update this store optimistically,
 * then reconcile with the server response; they never wait for the
 * server round trip before the UI reflects a change.
 */
export const useIssueBuilderStore = create<IssueBuilderState>((set, get) => ({
  issueId: null,
  sections: [],
  blocks: [],
  saveStatus: "idle",
  pendingBlockIds: new Set(),

  hydrate: (sections, blocks) => set({ sections, blocks }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  addBlockLocal: (block) => set((s) => ({ blocks: [...s.blocks, block] })),

  updateBlockLocal: (id, payload) =>
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, payload, last_edited_at: new Date().toISOString() } : b)),
    })),

  removeBlockLocal: (id) => set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),

  reorderBlocksLocal: (sectionId, orderedIds) =>
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.section_id !== sectionId) return b;
        const newPosition = orderedIds.indexOf(b.id);
        return newPosition === -1 ? b : { ...b, position: newPosition };
      }),
    })),

  moveBlockToSectionLocal: (blockId, targetSectionId, orderedIds) =>
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.id === blockId) return { ...b, section_id: targetSectionId, position: orderedIds.indexOf(blockId) };
        if (b.section_id === targetSectionId) {
          const newPosition = orderedIds.indexOf(b.id);
          return newPosition === -1 ? b : { ...b, position: newPosition };
        }
        return b;
      }),
    })),

  markPending: (blockId) =>
    set((s) => {
      const next = new Set(s.pendingBlockIds);
      next.add(blockId);
      return { pendingBlockIds: next };
    }),

  clearPending: (blockId) =>
    set((s) => {
      const next = new Set(s.pendingBlockIds);
      next.delete(blockId);
      return { pendingBlockIds: next };
    }),

  applyRemoteBlockChange: (block, eventType) => {
    const { pendingBlockIds } = get();
    if (pendingBlockIds.has(block.id)) return; // local edit in flight — don't clobber it with a stale echo

    set((s) => {
      if (eventType === "DELETE") {
        return { blocks: s.blocks.filter((b) => b.id !== block.id) };
      }
      const exists = s.blocks.some((b) => b.id === block.id);
      return {
        blocks: exists ? s.blocks.map((b) => (b.id === block.id ? block : b)) : [...s.blocks, block],
      };
    });
  },

  blocksForSection: (sectionId) =>
    get()
      .blocks.filter((b) => b.section_id === sectionId)
      .sort((a, b) => a.position - b.position),
}));

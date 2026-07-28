"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { BlockRow } from "@/lib/stores/issue-builder-store";
import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import { BLOCK_REGISTRY } from "@/lib/blocks/registry";
import { isImplementedBlockType } from "@/lib/blocks/types";
import { validateBlockPayload } from "@/lib/blocks/schemas";
import { logger } from "@/lib/logger";
import { BlockRenderer } from "./block-renderer";
import { BlockEditorFields } from "./block-editor-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/error/error-boundary";

const AUTOSAVE_DEBOUNCE_MS = 800;

async function persistBlock(blockId: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/blocks/${blockId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? "Failed to save block");
  }
}

export function BlockCard({ block }: { block: BlockRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const updateBlockLocal = useIssueBuilderStore((s) => s.updateBlockLocal);
  const removeBlockLocal = useIssueBuilderStore((s) => s.removeBlockLocal);
  const markPending = useIssueBuilderStore((s) => s.markPending);
  const clearPending = useIssueBuilderStore((s) => s.clearPending);

  const [isEditing, setIsEditing] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const definition = isImplementedBlockType(block.type) ? BLOCK_REGISTRY[block.type] : null;

  function handlePayloadChange(nextPayload: Record<string, unknown>) {
    updateBlockLocal(block.id, nextPayload);
    markPending(block.id);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (isImplementedBlockType(block.type)) {
          const validation = validateBlockPayload(block.type, nextPayload);
          if (!validation.success) return;
        }
        await persistBlock(block.id, nextPayload);
      } catch (error) {
        logger.error("Autosave failed", { error, blockId: block.id });
        toast.error("Couldn't save changes to this block");
      } finally {
        clearPending(block.id);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function handleDelete() {
    const previous = block;
    removeBlockLocal(block.id);
    try {
      const res = await fetch(`/api/blocks/${block.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete block");
    } catch (error) {
      logger.error("Block delete failed", { error, blockId: block.id });
      toast.error("Couldn't delete this block");
      useIssueBuilderStore.getState().addBlockLocal(previous);
    }
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative flex gap-1 rounded-md">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="mt-1 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-neutral-300 opacity-0 hover:bg-secondary hover:text-muted-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-focus-gold group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1 rounded-md border border-transparent p-1 hover:border-neutral-200">
        <div className="mb-1 flex items-center justify-between opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex items-center gap-1.5">
            <Badge variant="neutral" className="text-[10px]">
              {definition?.label ?? block.type}
            </Badge>
            {block.ai_generated && (
              <Badge variant="signal" className="text-[10px]">
                <Sparkles className="h-2.5 w-2.5" /> AI-generated
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsEditing((v) => !v)}>
              {isEditing ? "Done" : "Edit"}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-danger-700" aria-label="Delete block" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ErrorBoundary boundaryName={`${definition?.label ?? block.type} block`}>
          {isEditing ? (
            <BlockEditorFields type={block.type} payload={block.payload} onChange={handlePayloadChange} />
          ) : (
            <div onClick={() => setIsEditing(true)} className="cursor-text">
              <BlockRenderer type={block.type} payload={block.payload} />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

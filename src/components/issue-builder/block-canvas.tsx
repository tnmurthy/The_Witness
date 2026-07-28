"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";

import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import { logger } from "@/lib/logger";
import { BlockCard } from "./block-card";
import { InsertBlockMenu } from "./insert-block-menu";
import { Muted } from "@/components/ui/typography";

/**
 * DnD via @dnd-kit — chosen over the older, now-unmaintained
 * react-beautiful-dnd for accessibility (keyboard sensor built in,
 * screen-reader announcements out of the box) and active maintenance.
 * PointerSensor's activationConstraint requires an 8px move before a
 * drag starts, so a plain click on a block (to enter edit mode) is never
 * misread as a drag attempt.
 */
export function BlockCanvas({ issueId }: { issueId: string }) {
  const sections = useIssueBuilderStore((s) => s.sections);
  const blocks = useIssueBuilderStore((s) => s.blocks);
  const reorderBlocksLocal = useIssueBuilderStore((s) => s.reorderBlocksLocal);
  const moveBlockToSectionLocal = useIssueBuilderStore((s) => s.moveBlockToSectionLocal);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function persistReorder(affected: { id: string; sectionId: string; position: number }[]) {
    try {
      const res = await fetch(`/api/issues/${issueId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: affected }),
      });
      if (!res.ok) throw new Error("Failed to save new order");
    } catch (error) {
      logger.error("Reorder persist failed", { error, issueId });
      toast.error("Couldn't save the new block order");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeBlock = blocks.find((b) => b.id === active.id);
    const overBlock = blocks.find((b) => b.id === over.id);
    if (!activeBlock || !overBlock) return;

    const targetSectionId = overBlock.section_id;
    const sectionBlocks = blocks.filter((b) => b.section_id === targetSectionId).sort((a, b) => a.position - b.position);
    const withoutActive = sectionBlocks.filter((b) => b.id !== activeBlock.id);
    const overIndex = withoutActive.findIndex((b) => b.id === overBlock.id);
    const nextOrder = [...withoutActive.slice(0, overIndex), activeBlock, ...withoutActive.slice(overIndex)].map((b) => b.id);

    if (activeBlock.section_id === targetSectionId) {
      reorderBlocksLocal(targetSectionId, nextOrder);
    } else {
      moveBlockToSectionLocal(activeBlock.id, targetSectionId, nextOrder);
    }

    void persistReorder(nextOrder.map((id, index) => ({ id, sectionId: targetSectionId, position: index })));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="mx-auto max-w-reading space-y-8 py-8">
        {sections
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((section) => {
            const sectionBlocks = blocks.filter((b) => b.section_id === section.id).sort((a, b) => a.position - b.position);
            return (
              <div key={section.id} className="space-y-1">
                <SortableContext items={sectionBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {sectionBlocks.length === 0 ? (
                    <Muted className="rounded-md border border-dashed border-neutral-300 p-6 text-center">
                      Empty section — add a block below to get started.
                    </Muted>
                  ) : (
                    sectionBlocks.map((block) => <BlockCard key={block.id} block={block} />)
                  )}
                </SortableContext>
                <InsertBlockMenu sectionId={section.id} />
              </div>
            );
          })}
      </div>
    </DndContext>
  );
}

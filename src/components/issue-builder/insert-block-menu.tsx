"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from "@/lib/blocks/registry";
import type { ImplementedBlockType } from "@/lib/blocks/types";
import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InsertBlockMenu({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = React.useState(false);
  const addBlockLocal = useIssueBuilderStore((s) => s.addBlockLocal);

  async function handleInsert(type: ImplementedBlockType) {
    setOpen(false);
    const definition = BLOCK_REGISTRY[type];
    const currentCount = useIssueBuilderStore.getState().blocksForSection(sectionId).length;

    try {
      const res = await fetch(`/api/sections/${sectionId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload: {}, position: currentCount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add block");

      addBlockLocal(body.block);
    } catch (error) {
      logger.error("Insert block failed in UI", { error, sectionId, type: definition.type });
      toast.error(error instanceof Error ? error.message : "Couldn't add block");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Plus className="h-4 w-4" /> Add block
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 max-h-96 overflow-y-auto">
        {BLOCK_CATEGORIES.map((category) => {
          const items = Object.values(BLOCK_REGISTRY).filter((b) => b.category === category.value);
          if (items.length === 0) return null;
          return (
            <div key={category.value} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{category.label}</p>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleInsert(item.type)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:bg-secondary"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span>
                      <span className="block font-medium text-foreground">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

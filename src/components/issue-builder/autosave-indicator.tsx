"use client";

import { Check, Loader2, CloudOff } from "lucide-react";
import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import { cn } from "@/lib/utils";

/**
 * Reads pendingBlockIds directly rather than a separate global
 * saveStatus flag — "saving" is true exactly when at least one block has
 * a debounced write in flight, which is a more honest signal than a
 * store-wide flag that some other piece of code has to remember to
 * flip.
 */
export function AutosaveIndicator() {
  const pendingCount = useIssueBuilderStore((s) => s.pendingBlockIds.size);
  const saveStatus = useIssueBuilderStore((s) => s.saveStatus);

  if (saveStatus === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger-700">
        <CloudOff className="h-3.5 w-3.5" /> Couldn&apos;t save
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground")}>
      <Check className="h-3.5 w-3.5 text-success-600" /> Saved
    </span>
  );
}

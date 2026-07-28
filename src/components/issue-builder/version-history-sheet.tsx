"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Muted } from "@/components/ui/typography";

interface Revision {
  id: string;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  snapshot: { label?: string | null };
}

function revisionAuthorName(revision: Revision): string {
  const profile = Array.isArray(revision.profiles) ? revision.profiles[0] : revision.profiles;
  return profile?.full_name || "Someone";
}

export function VersionHistorySheet({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [revisions, setRevisions] = React.useState<Revision[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  async function loadRevisions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/revisions`);
      const body = await res.json();
      if (res.ok) setRevisions(body.revisions ?? []);
    } catch (error) {
      logger.error("Failed to load revisions", { error, issueId });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCheckpoint() {
    try {
      const res = await fetch(`/api/issues/${issueId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to save version");
      toast.success("Version saved");
      loadRevisions();
    } catch (error) {
      logger.error("Manual checkpoint failed", { error, issueId });
      toast.error("Couldn't save a version checkpoint");
    }
  }

  async function handleRestore(revisionId: string) {
    setRestoringId(revisionId);
    try {
      const res = await fetch(`/api/issues/${issueId}/revisions/${revisionId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore");
      toast.success("Restored — reloading the issue");
      setOpen(false);
      router.refresh();
      window.location.reload();
    } catch (error) {
      logger.error("Restore failed", { error, issueId, revisionId });
      toast.error("Couldn't restore this version");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) loadRevisions();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4" /> Version history
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Automatic checkpoints save at most once every 5 minutes while editing. Restoring first saves the current
            state as its own checkpoint, so nothing is ever lost.
          </SheetDescription>
        </SheetHeader>

        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleSaveCheckpoint}>
          Save version now
        </Button>

        <div className="mt-4 space-y-2 overflow-y-auto">
          {loading && <Muted>Loading…</Muted>}
          {!loading && revisions.length === 0 && <Muted>No versions saved yet.</Muted>}
          {revisions.map((revision) => (
            <div key={revision.id} className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{revision.snapshot?.label || "Autosave checkpoint"}</p>
                <Muted className="text-xs">
                  {new Date(revision.created_at).toLocaleString()} · {revisionAuthorName(revision)}
                </Muted>
              </div>
              <Button variant="ghost" size="sm" disabled={restoringId === revision.id} onClick={() => handleRestore(revision.id)}>
                <RotateCcw className="h-3.5 w-3.5" /> {restoringId === revision.id ? "Restoring…" : "Restore"}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

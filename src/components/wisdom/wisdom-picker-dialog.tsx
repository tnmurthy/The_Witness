"use client";

import * as React from "react";
import { toast } from "sonner";
import { BookOpen, Search } from "lucide-react";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Muted } from "@/components/ui/typography";

interface WisdomEntrySummary {
  id: string;
  title: string;
  translation: string;
}

/**
 * Lets an editor browse the approved Wisdom Engine library and attach an
 * entry to a Today's Wisdom block in one click — the editorial
 * integration this milestone's brief asks for, as an alternative to
 * typing a one-off quote by hand (still supported directly in the block
 * editor, for content that isn't in the curated library). Only fetches
 * once the dialog opens, not on every Issue Builder page load.
 */
export function WisdomPickerDialog({
  blockId,
  onAttached,
}: {
  blockId: string;
  onAttached: (payload: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<WisdomEntrySummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [attachingId, setAttachingId] = React.useState<string | null>(null);

  async function loadEntries(query?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ reviewStatus: "approved" });
      if (query) params.set("search", query);
      const res = await fetch(`/api/wisdom-entries?${params.toString()}`);
      const body = await res.json();
      if (res.ok) setEntries(body.entries ?? []);
    } catch (error) {
      logger.error("Failed to load wisdom entries for picker", { error });
    } finally {
      setLoading(false);
    }
  }

  async function handleAttach(entryId: string) {
    setAttachingId(entryId);
    try {
      const res = await fetch(`/api/blocks/${blockId}/attach-wisdom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wisdomEntryId: entryId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to attach");

      onAttached(body.block.payload);
      toast.success("Wisdom entry attached");
      setOpen(false);
    } catch (error) {
      logger.error("Attach wisdom failed in UI", { error, blockId, entryId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) loadEntries();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookOpen className="h-3.5 w-3.5" /> Pick from Wisdom Engine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick from Wisdom Engine</DialogTitle>
          <DialogDescription>Only approved entries are shown.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadEntries(search)}
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {loading && <Muted>Loading…</Muted>}
          {!loading && entries.length === 0 && <Muted>No approved entries found.</Muted>}
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={attachingId === entry.id}
              onClick={() => handleAttach(entry.id)}
              className="w-full rounded-md border border-neutral-200 p-3 text-left hover:border-neutral-300 hover:bg-secondary disabled:opacity-50"
            >
              <p className="font-medium text-foreground">{entry.title}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{entry.translation}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { IMPLEMENTED_BLOCK_TYPES } from "@/lib/blocks/types";
import { BLOCK_REGISTRY } from "@/lib/blocks/registry";
import { useIssueBuilderStore } from "@/lib/stores/issue-builder-store";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const STARTER_TYPES = ["hero_story", "signal_card", "career_insight"] as const;

/**
 * The "Generate issue" entry point — the AI Workspace's flagship
 * function, matching the Solution Architecture design document's AI
 * Workspace flow diagram exactly: editor specifies topic/audience/tone,
 * reviews the result as ordinary editable blocks. This dialog only
 * triggers generation into the section the Issue Builder canvas is
 * already showing (passed in as `sectionId`) — nothing here creates a
 * new issue or publishes anything; see docs/AI_WORKSPACE.md.
 */
export function GenerateIssueDialog({ issueId, sectionId }: { issueId: string; sectionId: string }) {
  const router = useRouter();
  const addBlockLocal = useIssueBuilderStore((s) => s.addBlockLocal);
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [tone, setTone] = React.useState("");
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([...STARTER_TYPES]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [rejected, setRejected] = React.useState<{ type: string; reason: string }[]>([]);

  function toggleType(type: string) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleGenerate() {
    if (!topic.trim() || selectedTypes.length === 0) return;
    setIsGenerating(true);
    setRejected([]);

    try {
      const res = await fetch(`/api/issues/${issueId}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          audience: audience || undefined,
          tone: tone || undefined,
          blockTypes: selectedTypes,
          sectionId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed");

      for (const block of body.blocks) {
        addBlockLocal(block);
      }
      setRejected(body.rejected ?? []);

      toast.success(`Drafted ${body.blocks.length} block${body.blocks.length === 1 ? "" : "s"}`, {
        description: body.rejected?.length ? `${body.rejected.length} block(s) didn't validate and were skipped.` : "Review and edit before publishing.",
      });
      if (body.rejected?.length === 0) setOpen(false);
      router.refresh();
    } catch (error) {
      logger.error("Generate Issue failed in UI", { error, issueId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="signal" size="sm">
          <Sparkles className="h-4 w-4" /> Generate issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate issue</DialogTitle>
          <DialogDescription>
            Drafts editable blocks into this issue&apos;s current section. Nothing publishes automatically — review
            and edit every block before it goes live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic</Label>
            <Input id="topic" placeholder="The return of on-premise AI infrastructure" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="audience">Audience (optional)</Label>
              <Input id="audience" placeholder="Engineering leaders" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input id="tone" placeholder="Analytical, direct" value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Blocks to draft</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {IMPLEMENTED_BLOCK_TYPES.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox id={`type-${type}`} checked={selectedTypes.includes(type)} onCheckedChange={() => toggleType(type)} />
                  <Label htmlFor={`type-${type}`} className="text-sm font-normal">
                    {BLOCK_REGISTRY[type].label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {rejected.length > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                {rejected.length} block(s) didn&apos;t match their expected shape and were skipped:{" "}
                {rejected.map((r) => r.type).join(", ")}.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="signal" disabled={isGenerating || !topic.trim() || selectedTypes.length === 0} onClick={handleGenerate}>
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

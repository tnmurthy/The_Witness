"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sparkles, BookOpen } from "lucide-react";

import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Muted } from "@/components/ui/typography";

interface Recommendation {
  id: string;
  score: number;
  rationale: string;
  wisdom_entries:
    | { id: string; title: string; translation: string }
    | { id: string; title: string; translation: string }[]
    | null;
}

/**
 * The "AI should automatically recommend appropriate wisdom based on
 * issue topics" requirement, in the Issue Builder itself. "Automatically"
 * here means one click, not zero — an editor triggers it (a real AI
 * provider call has a real cost per Milestone 6's ai_jobs tracking, so
 * this doesn't fire on every keystroke or page load), and the results
 * are readable recommendations with a rationale, not a silent background
 * process.
 */
export function WisdomRecommendationsPanel({ issueId }: { issueId: string }) {
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  async function loadRecommendations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/wisdom/recommendations`);
      const body = await res.json();
      if (res.ok) setRecommendations(body.recommendations ?? []);
    } catch (error) {
      logger.error("Failed to load wisdom recommendations", { error, issueId });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/wisdom/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate recommendations");

      await loadRecommendations();
      toast.success(
        `Found ${body.recommendations.length} recommendation${body.recommendations.length === 1 ? "" : "s"}`
      );
    } catch (error) {
      logger.error("Generate wisdom recommendations failed in UI", { error, issueId });
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Sheet onOpenChange={(open) => open && loadRecommendations()}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="h-4 w-4" /> Wisdom
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recommended wisdom</SheetTitle>
          <SheetDescription>
            Based on this issue&apos;s hero story and signal content, or its title if those are empty.
          </SheetDescription>
        </SheetHeader>

        <Button
          variant="signal"
          size="sm"
          className="mt-4 w-full"
          disabled={generating}
          onClick={handleGenerate}
        >
          <Sparkles className="h-4 w-4" /> {generating ? "Thinking…" : "Get recommendations"}
        </Button>

        <div className="mt-4 space-y-3">
          {loading && <Muted>Loading…</Muted>}
          {!loading && recommendations.length === 0 && (
            <Muted>No recommendations yet — click above to generate some.</Muted>
          )}
          {recommendations.map((rec) => {
            const entry = Array.isArray(rec.wisdom_entries) ? rec.wisdom_entries[0] : rec.wisdom_entries;
            if (!entry) return null;
            return (
              <div key={rec.id} className="space-y-1.5 rounded-md border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{entry.title}</p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {Math.round(rec.score * 100)}%
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{entry.translation}</p>
                <p className="text-xs italic text-gold-700">{rec.rationale}</p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

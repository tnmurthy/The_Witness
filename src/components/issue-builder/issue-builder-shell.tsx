"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useIssueBuilderStore, type SectionRow, type BlockRow } from "@/lib/stores/issue-builder-store";
import {
  subscribeToIssueChannel,
  unsubscribeFromIssueChannel,
  type PresenceUser,
} from "@/lib/supabase/realtime-issue";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlockCanvas } from "./block-canvas";
import { AutosaveIndicator } from "./autosave-indicator";
import { PresenceBar } from "./presence-bar";
import { VersionHistorySheet } from "./version-history-sheet";
import { GenerateIssueDialog } from "@/components/ai-workspace/generate-issue-dialog";
import { AIAssistantSheet } from "@/components/ai-workspace/ai-assistant-sheet";
import { WisdomRecommendationsPanel } from "@/components/wisdom/wisdom-recommendations-panel";
import { IssueGraphPanel } from "@/components/graph/issue-graph-panel";
import { ErrorBoundary } from "@/components/error/error-boundary";

interface IssueBuilderShellProps {
  issue: {
    id: string;
    title: string;
    status: string;
    publication_id: string;
    publications: { name: string } | { name: string }[] | null;
  };
  initialSections: SectionRow[];
  initialBlocks: BlockRow[];
  currentUserId: string;
  currentUserName: string;
}

/**
 * The client half of the Issue Builder page. Server Component
 * (src/app/(dashboard)/issues/[id]/page.tsx) does the initial data fetch
 * (respecting RLS via the request's own session, same as every other
 * page in this app); this component owns everything that happens after
 * that first paint — store hydration, the Realtime subscription
 * lifecycle, and rendering the canvas.
 */
export function IssueBuilderShell({
  issue,
  initialSections,
  initialBlocks,
  currentUserId,
  currentUserName,
}: IssueBuilderShellProps) {
  const hydrate = useIssueBuilderStore((s) => s.hydrate);
  const applyRemoteBlockChange = useIssueBuilderStore((s) => s.applyRemoteBlockChange);
  const [presenceUsers, setPresenceUsers] = React.useState<PresenceUser[]>([]);

  React.useEffect(() => {
    hydrate(initialSections, initialBlocks);
    // Intentionally only re-hydrates when the issue itself changes
    // (navigating between issues), not on every initialBlocks reference
    // change — the store is the source of truth for the canvas from this
    // point forward; re-running hydrate on every render would stomp on
    // in-progress local edits and Realtime-applied remote changes alike.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id]);

  React.useEffect(() => {
    const channel = subscribeToIssueChannel(issue.id, currentUserId, currentUserName, {
      onBlockChange: applyRemoteBlockChange,
      onPresenceChange: setPresenceUsers,
    });
    return () => unsubscribeFromIssueChannel(channel);
  }, [issue.id, currentUserId, currentUserName, applyRemoteBlockChange]);

  const publicationName = Array.isArray(issue.publications)
    ? issue.publications[0]?.name
    : issue.publications?.name;
  // Live store state, not the initialSections prop — a section added via
  // "Add section" after the initial page load must be selectable as a
  // Generate Issue target without a full page reload.
  const sections = useIssueBuilderStore((s) => s.sections);
  const firstSectionId = sections.slice().sort((a, b) => a.position - b.position)[0]?.id;

  async function handleAddSection() {
    try {
      const res = await fetch(`/api/issues/${issue.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add section");
      useIssueBuilderStore.setState((s) => ({ sections: [...s.sections, body.section] }));
    } catch (error) {
      logger.error("Add section failed in UI", { error, issueId: issue.id });
      toast.error("Couldn't add a new section");
    }
  }

  return (
    // Negative margin cancels AppShell's p-4/p-6 main padding (Milestone
    // 1) so the Issue Builder toolbar can sit flush against the Topbar
    // rather than floating with a visible gap — the one page in the app
    // that wants edge-to-edge control within the shared shell rather than
    // living inside its padding. calc(100vh-3.5rem) reclaims the vertical
    // space AppShell's Topbar (h-14 = 3.5rem) takes above it.
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col sm:-m-6">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to issues">
            <Link href="/issues">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{issue.title}</p>
            {publicationName && <p className="truncate text-xs text-muted-foreground">{publicationName}</p>}
          </div>
          <Badge variant={issue.status === "published" ? "success" : "neutral"} className="capitalize">
            {issue.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator />
          <PresenceBar users={presenceUsers} currentUserId={currentUserId} />
          <AIAssistantSheet
            publicationId={issue.publication_id}
            publicationName={publicationName ?? "The Witness"}
            issueId={issue.id}
          />
          <WisdomRecommendationsPanel issueId={issue.id} />
          <IssueGraphPanel issueId={issue.id} />
          {firstSectionId && <GenerateIssueDialog issueId={issue.id} sectionId={firstSectionId} />}
          <VersionHistorySheet issueId={issue.id} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        <ErrorBoundary boundaryName="Issue Builder canvas">
          <BlockCanvas issueId={issue.id} />
        </ErrorBoundary>
        <div className="mx-auto max-w-reading pb-16">
          <Button variant="outline" size="sm" onClick={handleAddSection}>
            Add section
          </Button>
        </div>
      </div>
    </div>
  );
}

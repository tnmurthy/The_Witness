import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { RecentAiJobs } from "@/components/ai-workspace/recent-ai-jobs";
import { KnowledgeGraphSummary } from "@/components/graph/knowledge-graph-summary";

export const metadata = { title: "Dashboard" };

/**
 * Dashboard matching the Design System's Dashboard Layout section and
 * the Solution Architecture's Dashboard module spec (Publishing
 * Calendar, Issue Pipeline, Subscribers, Analytics, Recent AI Jobs,
 * Research Queue, Knowledge Graph Summary, Quick Actions). Recent AI
 * Jobs is now real (Milestone 6); the rest remain placeholders for the
 * milestones that own that domain (Issue Pipeline -> Milestone 4 detail
 * view, Analytics -> Milestone 9, etc.).
 */
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Issue pipeline</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          See every issue at{" "}
          <Link href="/issues" className="text-navy-700 underline-offset-4 hover:underline">
            Issue Builder
          </Link>
          .
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Wired up in Milestone 10 — Publishing Pipeline.
        </CardContent>
      </Card>

      <RecentAiJobs />

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Publishing calendar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Wired up in Milestone 3 — Publication Management.
        </CardContent>
      </Card>

      <KnowledgeGraphSummary />

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild variant="signal" size="sm" className="justify-start">
            <Link href="/issues">
              <Sparkles className="h-4 w-4" /> Generate issue
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">Open an issue to generate content into it.</p>
        </CardContent>
      </Card>
    </div>
  );
}

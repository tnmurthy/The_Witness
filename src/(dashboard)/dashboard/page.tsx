import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const metadata = { title: "Dashboard" };

/**
 * Placeholder Dashboard matching the Design System's Dashboard Layout
 * section and the Solution Architecture's Dashboard module spec
 * (Publishing Calendar, Issue Pipeline, Subscribers, Analytics, Recent AI
 * Jobs, Research Queue, Knowledge Graph Summary, Quick Actions). Real data
 * wiring for each widget belongs to the milestone that owns that domain
 * (Issue Pipeline -> Milestone 4, AI Jobs -> Milestone 5, Analytics ->
 * Milestone 9, etc.) — this milestone only establishes the shell layout.
 */
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Issue pipeline</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Wired up in Milestone 4 — Issue Builder.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscribers</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Wired up in Milestone 10 — Publishing Pipeline.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI jobs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Wired up in Milestone 5 — AI Workspace.</CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Publishing calendar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Wired up in Milestone 3 — Publication Management.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge graph</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Wired up in Milestone 7 — Knowledge Graph.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="signal" size="sm" disabled className="justify-start">
            <Sparkles className="h-4 w-4" /> Generate issue
          </Button>
          <p className="text-xs text-muted-foreground">Enabled in Milestone 5 — AI Workspace.</p>
        </CardContent>
      </Card>
    </div>
  );
}

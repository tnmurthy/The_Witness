"use client";

import * as React from "react";
import { Waypoints } from "lucide-react";
import type { GraphEntityType } from "@/lib/graph/types";
import { GraphSearchPanel } from "./graph-search-panel";
import { GraphNodeDetail, GraphBreadcrumbTrail, type SelectedNode } from "./graph-node-detail";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The Graph Explorer: search on the left, the selected node's neighbors
 * on the right, with a breadcrumb trail of every node visited this
 * session. Trail state lives here (not in the URL) — a deliberate,
 * simple choice for a first version of graph browsing; a URL-addressable
 * trail (shareable/bookmarkable exploration paths) is a natural
 * follow-up once this UI has real usage to learn from, not assumed
 * necessary up front.
 */
export function GraphExplorerShell() {
  const [trail, setTrail] = React.useState<SelectedNode[]>([]);
  const current = trail[trail.length - 1];

  function navigateTo(entityType: GraphEntityType, entityId: string, label: string) {
    setTrail((prev) => [...prev, { entityType, entityId, label }]);
  }

  function jumpTo(index: number) {
    setTrail((prev) => prev.slice(0, index + 1));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="pt-6">
          <GraphSearchPanel onSelect={navigateTo} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {current && <GraphBreadcrumbTrail trail={trail} onJump={jumpTo} />}

        {current ? (
          <GraphNodeDetail node={current} onNavigate={navigateTo} />
        ) : (
          <EmptyState
            icon={Waypoints}
            title="Search for something to start exploring"
            description="Pick any technology, company, article, book, paper, course, GitHub repository, wisdom entry, person, or issue from the search panel to see how it connects to everything else."
          />
        )}
      </div>
    </div>
  );
}

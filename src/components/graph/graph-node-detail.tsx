"use client";

import * as React from "react";
import { Waypoints, ArrowRight } from "lucide-react";
import { useGraphNeighbors } from "@/lib/graph/hooks";
import { GRAPH_ENTITY_LABELS, type GraphEntityType } from "@/lib/graph/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { QueryStateView } from "@/components/ui/query-state-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { H2, Muted } from "@/components/ui/typography";

export interface SelectedNode {
  entityType: GraphEntityType;
  entityId: string;
  label: string;
}

interface GraphNodeDetailProps {
  node: SelectedNode;
  onNavigate: (entityType: GraphEntityType, entityId: string, label: string) => void;
}

const RELATION_LABEL: Record<string, string> = {
  related: "related to",
  mentions: "mentions",
  cites: "cites",
  authored_by: "authored by",
  works_at: "works at",
  founded: "founded",
  built: "built",
  invested_in: "invested in",
  teaches: "teaches",
  implements: "implements",
  inspired_by: "inspired by",
  discusses: "discusses",
  part_of: "part of",
  attributed_to: "attributed to",
};

/**
 * The Graph Explorer's main panel: shows the selected node and every
 * entity reachable within `depth` hops, each with its relation label and
 * how many hops away it is. Clicking a neighbor navigates the whole
 * panel to it — this is "Knowledge Graph navigation" as a literal
 * feature, not just a data endpoint: browsing the graph by clicking
 * through it.
 */
export function GraphNodeDetail({ node, onNavigate }: GraphNodeDetailProps) {
  const [depth, setDepth] = React.useState(2);
  const query = useGraphNeighbors(node.entityType, node.entityId, depth);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="neutral" className="mb-1">
            {GRAPH_ENTITY_LABELS[node.entityType]}
          </Badge>
          <H2 className="text-lg">{node.label}</H2>
        </div>
        <Select value={String(depth)} onValueChange={(v) => setDepth(Number(v))}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 hop</SelectItem>
            <SelectItem value="2">2 hops</SelectItem>
            <SelectItem value="3">3 hops</SelectItem>
            <SelectItem value="4">4 hops</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <QueryStateView
        query={query}
        loading={
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        }
        isEmpty={(data) => data.neighbors.length === 0}
        empty={
          <EmptyState
            icon={Waypoints}
            title="No connections found"
            description="This entity has no recorded edges within this many hops. Try increasing the hop count, or add a connection from an entity's page."
          />
        }
      >
        {(data) => (
          <ul className="space-y-2">
            {data.neighbors
              .slice()
              .sort((a, b) => a.depth - b.depth)
              .map((neighbor) => (
                <li key={`${neighbor.entityType}:${neighbor.entityId}`}>
                  <button
                    type="button"
                    onClick={() => onNavigate(neighbor.entityType, neighbor.entityId, neighbor.label)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 text-left hover:border-neutral-300 hover:bg-secondary focus-visible:outline-none focus-visible:shadow-focus-gold"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{neighbor.label}</p>
                      <Muted className="text-xs">
                        {neighbor.relationType ? (RELATION_LABEL[neighbor.relationType] ?? neighbor.relationType) : "connected"} ·{" "}
                        {neighbor.depth} hop{neighbor.depth === 1 ? "" : "s"} away
                      </Muted>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="neutral" className="text-[10px]">
                        {GRAPH_ENTITY_LABELS[neighbor.entityType]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </QueryStateView>
    </div>
  );
}

export function GraphBreadcrumbTrail({ trail, onJump }: { trail: SelectedNode[]; onJump: (index: number) => void }) {
  if (trail.length <= 1) return null;

  return (
    <nav aria-label="Graph navigation trail" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {trail.map((node, i) => (
        <span key={`${node.entityType}:${node.entityId}`} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden="true">/</span>}
          {i === trail.length - 1 ? (
            <span className="font-medium text-foreground">{node.label}</span>
          ) : (
            <Button variant="ghost" size="sm" className="h-auto px-1.5 py-0.5 text-sm text-muted-foreground" onClick={() => onJump(i)}>
              {node.label}
            </Button>
          )}
        </span>
      ))}
    </nav>
  );
}

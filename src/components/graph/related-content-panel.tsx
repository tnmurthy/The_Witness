"use client";

import Link from "next/link";
import { Waypoints } from "lucide-react";
import { useRelatedContent } from "@/lib/graph/hooks";
import type { GraphEntityType } from "@/lib/graph/types";
import { QueryStateView } from "@/components/ui/query-state-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Entity types that have a real detail page in this app to link to.
 * Every entity type is a graph node, but not every type has its own
 * dedicated page yet (technology, company, book, paper, course, video,
 * podcast, github_repository, and source are reference-library rows
 * with no standalone page — they're referenced from articles/issues,
 * not browsed directly). Linking only where a real destination exists
 * avoids a "Related Content" panel whose items are dead links.
 */
const LINKABLE_TYPES: Partial<Record<GraphEntityType, (id: string) => string>> = {
  wisdom_entry: (id) => `/wisdom/${id}`,
  person: (id) => `/people/${id}`,
  issue: (id) => `/issues/${id}`,
};

interface RelatedContentPanelProps {
  entityType: GraphEntityType;
  entityId: string;
  title?: string;
}

/**
 * Embeddable on any entity's detail page — this is the "Related Content
 * panels" requirement as a genuinely reusable component, not one
 * bespoke implementation per page. Every item is also a link into its
 * own page when one exists, or a plain labeled entry when it doesn't
 * (see LINKABLE_TYPES above) — a full deep-linkable Graph Explorer URL
 * scheme is a natural follow-up, not assumed necessary for this pass.
 */
export function RelatedContentPanel({ entityType, entityId, title = "Related content" }: RelatedContentPanelProps) {
  const query = useRelatedContent(entityType, entityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryStateView
          query={query}
          loading={
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          }
          isEmpty={(data) => data.groups.length === 0}
          empty={<EmptyState icon={Waypoints} title="No connections yet" description="Nothing in the Knowledge Graph is linked to this yet." />}
        >
          {(data) => (
            <div className="space-y-4">
              {data.groups.map((group) => (
                <div key={group.entityType}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => {
                      const href = LINKABLE_TYPES[group.entityType]?.(item.entityId);
                      return href ? (
                        <Link key={item.entityId} href={href}>
                          <Badge variant="info" className="cursor-pointer hover:opacity-80">
                            {item.label}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge key={item.entityId} variant="neutral" className="cursor-default">
                          {item.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryStateView>
      </CardContent>
    </Card>
  );
}

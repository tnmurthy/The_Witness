import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_LABELS, type GraphEntityType } from "@/lib/graph/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Muted } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { Share2 } from "lucide-react";

/**
 * Real Knowledge Graph analytics — entity counts by type, connection
 * counts by relation type, and the most-connected entities — computed
 * directly from knowledge_graph_edges and the entity tables, not
 * projected or estimated. This is deliberately narrow: it answers "how
 * connected is the graph, and what's it connected by," not "how do
 * readers engage with content," which is a different question this
 * platform genuinely can't answer yet (no event-tracking pipeline
 * exists — see the rest of this page for that honest boundary,
 * unchanged by this addition).
 */
export async function KnowledgeGraphAnalytics() {
  const supabase = await createClient();

  const { data: edges } = await supabase
    .from("knowledge_graph_edges")
    .select("source_type, source_id, target_type, target_id, relation_type");

  if (!edges || edges.length === 0) {
    return (
      <EmptyState
        icon={Share2}
        title="No Knowledge Graph connections yet"
        description="Once entities are connected — from the Graph Explorer, an entity's Related Content panel, or the Issue Builder — this will show connection counts and the most-connected entities."
      />
    );
  }

  const relationCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();
  const entityTypeLabel = new Map<string, GraphEntityType>();

  for (const edge of edges) {
    relationCounts.set(edge.relation_type, (relationCounts.get(edge.relation_type) ?? 0) + 1);

    const sourceKey = `${edge.source_type}:${edge.source_id}`;
    const targetKey = `${edge.target_type}:${edge.target_id}`;
    entityCounts.set(sourceKey, (entityCounts.get(sourceKey) ?? 0) + 1);
    entityCounts.set(targetKey, (entityCounts.get(targetKey) ?? 0) + 1);
    entityTypeLabel.set(sourceKey, edge.source_type as GraphEntityType);
    entityTypeLabel.set(targetKey, edge.target_type as GraphEntityType);
  }

  const topRelations = Array.from(relationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const topEntities = Array.from(entityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connections by relation type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topRelations.map(([relation, count]) => (
            <div key={relation} className="flex items-center justify-between text-sm">
              <span className="capitalize text-foreground">{relation.replace(/_/g, " ")}</span>
              <span className="font-mono text-muted-foreground">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most-connected entities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topEntities.map(([key, count]) => {
            const type = entityTypeLabel.get(key);
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <Badge variant="neutral" className="text-[10px]">
                  {type ? GRAPH_ENTITY_LABELS[type] : "—"}
                </Badge>
                <span className="font-mono text-muted-foreground">{count} connections</span>
              </div>
            );
          })}
          <Muted className="pt-1 text-xs">
            Entity labels aren&apos;t shown here — see the Graph Explorer to browse by name.
          </Muted>
        </CardContent>
      </Card>
    </div>
  );
}

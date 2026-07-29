import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GRAPH_ENTITY_LABELS } from "@/lib/graph/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Muted } from "@/components/ui/typography";

/**
 * Replaces the Milestone 1 placeholder card with real counts — entities
 * and connections in the Knowledge Graph, pulled directly from the
 * tables the Knowledge Graph milestone built. Deliberately just a
 * summary with a link into the real explorer, not a miniature graph
 * visualization crammed into a dashboard card — that's what /graph is
 * for.
 */
export async function KnowledgeGraphSummary() {
  const supabase = await createClient();

  const [technologies, companies, wisdomEntries, people, edges] = await Promise.all([
    supabase.from("technologies").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("wisdom_entries").select("id", { count: "exact", head: true }).eq("review_status", "approved"),
    supabase.from("people").select("id", { count: "exact", head: true }),
    supabase.from("knowledge_graph_edges").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: GRAPH_ENTITY_LABELS.technology, count: technologies.count ?? 0 },
    { label: GRAPH_ENTITY_LABELS.company, count: companies.count ?? 0 },
    { label: "Approved wisdom", count: wisdomEntries.count ?? 0 },
    { label: GRAPH_ENTITY_LABELS.person, count: people.count ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Graph</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-mono text-lg font-semibold text-foreground">{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <Muted className="text-xs">{edges.count ?? 0} recorded connections.</Muted>
        <Link href="/graph" className="block text-xs font-medium text-navy-700 hover:underline">
          Explore the graph →
        </Link>
      </CardContent>
    </Card>
  );
}

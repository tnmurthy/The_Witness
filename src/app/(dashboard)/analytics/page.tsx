import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeGraphAnalytics } from "@/components/graph/knowledge-graph-analytics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { H1, H2, Muted } from "@/components/ui/typography";

export const metadata = { title: "Analytics" };

/**
 * One real, honest slice of analytics — the Knowledge Graph's own
 * connection data, computed directly from knowledge_graph_edges, not
 * projected or faked. Reader engagement, subscriber growth, and content
 * performance remain genuinely unbuilt (no event-tracking pipeline
 * exists in this platform yet) — the page says so explicitly rather
 * than building fake widgets with placeholder numbers that would look
 * finished until someone noticed they never changed.
 */
export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <div>
        <H1 className="text-xl">Analytics</H1>
        <Muted>Reader engagement, subscriber growth, and content performance.</Muted>
      </div>

      <div>
        <H2 className="mb-3 text-lg">Knowledge Graph</H2>
        <KnowledgeGraphAnalytics />
      </div>

      <Alert variant="info">
        <AlertDescription>
          Reader and subscriber analytics need an event-tracking pipeline this platform doesn&apos;t have yet
          — reader opens, click-throughs, subscriber growth. Those dashboards will appear here once that
          pipeline exists, not before.
        </AlertDescription>
      </Alert>
    </div>
  );
}

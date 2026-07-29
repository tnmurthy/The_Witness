import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H2, Muted } from "@/components/ui/typography";
import { Sparkles, FileEdit, BookOpen, Share2 } from "lucide-react";

export const metadata = { title: "AI Workspace" };

const STATUS_VARIANT: Record<string, "success" | "info" | "danger" | "neutral"> = {
  completed: "success",
  running: "info",
  pending: "neutral",
  failed: "danger",
};

/**
 * AI Workspace has never had a dedicated authoring page — every one of
 * its 12 functions (Milestones 6-8) is deliberately contextual: Generate
 * Issue and the 9 content functions live in the Issue Builder toolbar,
 * Recommend Wisdom lives on the issue's Wisdom panel, Suggest Graph
 * Connections lives on an entity's Knowledge Graph panel. That design
 * doesn't change here. What this page is: the nav's "AI Workspace" link
 * needed a real destination instead of the dead route it pointed to
 * before — a full job history across every publication the user
 * belongs to (the Dashboard's Recent AI Jobs card only shows 5), plus
 * direct links to where each function actually lives, since a person
 * clicking "AI Workspace" from the nav is looking for the AI features,
 * not necessarily an issue they already have open.
 */
export default async function AIWorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: jobs } = await supabase
    .from("ai_jobs")
    .select("id, function_id, status, provider, model, cost_usd, created_at, issue_id, publications(name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-6">
      <div>
        <H1 className="text-xl">AI Workspace</H1>
        <Muted>Every AI function lives where you&apos;d use it — in context, not in a separate authoring screen.</Muted>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 pt-6">
            <FileEdit className="h-5 w-5 text-navy-700" />
            <p className="text-sm font-medium text-foreground">Issue Builder</p>
            <p className="text-xs text-muted-foreground">
              Generate Issue, Rewrite, Summarize, Improve Writing, Suggest Headlines, Suggest Images, Generate LinkedIn
              Post/Email/PDF/SEO Metadata.
            </p>
            <Link href="/issues" className="text-xs font-medium text-navy-700 hover:underline">
              Open an issue →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-6">
            <BookOpen className="h-5 w-5 text-gold-700" />
            <p className="text-sm font-medium text-foreground">Wisdom Engine</p>
            <p className="text-xs text-muted-foreground">Recommend Wisdom for an issue&apos;s topic, from the Issue Builder&apos;s Wisdom panel.</p>
            <Link href="/wisdom" className="text-xs font-medium text-navy-700 hover:underline">
              Browse the library →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-6">
            <Share2 className="h-5 w-5 text-navy-700" />
            <p className="text-sm font-medium text-foreground">Knowledge Graph</p>
            <p className="text-xs text-muted-foreground">Suggest Graph Connections for any entity, from its Knowledge Graph panel.</p>
            <Link href="/graph" className="text-xs font-medium text-navy-700 hover:underline">
              Explore the graph →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div>
        <H2 className="mb-3 text-lg">Job history</H2>
        {!jobs?.length ? (
          <EmptyState
            icon={Sparkles}
            title="No AI Workspace activity yet"
            description="Every AI generation across every publication you belong to will show up here."
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const publication = Array.isArray(job.publications) ? job.publications[0] : job.publications;
              return (
                <Card key={job.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize text-foreground">
                        {(job.function_id ?? "generate_issue").replace(/_/g, " ")}
                      </p>
                      <Muted className="text-xs">
                        {publication?.name ?? "—"} · {job.provider}/{job.model} · {new Date(job.created_at).toLocaleString()}
                      </Muted>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.cost_usd != null && <span className="font-mono text-xs text-muted-foreground">${Number(job.cost_usd).toFixed(4)}</span>}
                      <Badge variant={STATUS_VARIANT[job.status] ?? "neutral"} className="text-[10px] capitalize">
                        {job.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

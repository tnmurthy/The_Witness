import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Muted } from "@/components/ui/typography";

const STATUS_VARIANT: Record<string, "success" | "info" | "danger" | "neutral"> = {
  completed: "success",
  running: "info",
  pending: "neutral",
  failed: "danger",
};

/**
 * Replaces the Milestone 1 "Wired up in Milestone 5" placeholder card
 * with real data. Reads across every publication the user belongs to
 * (RLS via ai_jobs_select_member scopes this automatically) rather than
 * one specific publication, matching the dashboard's own scope.
 */
export async function RecentAiJobs() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("ai_jobs")
    .select("id, function_id, status, cost_usd, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent AI jobs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!jobs?.length ? (
          <Muted className="text-sm">No AI Workspace activity yet.</Muted>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-foreground">{(job.function_id ?? "generate_issue").replace(/_/g, " ")}</span>
              <Badge variant={STATUS_VARIANT[job.status] ?? "neutral"} className="text-[10px] capitalize">
                {job.status}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

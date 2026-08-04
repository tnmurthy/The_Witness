import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Issue Builder" };

const PAGE_SIZE = 25;

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let query = supabase
    .from("issues")
    .select("id, title, status, updated_at, publications(name)")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      const [afterDate, afterId] = decoded.split(":");
      if (afterDate && afterId) {
        query = query.or(`updated_at.lt.${afterDate},and(updated_at.eq.${afterDate},id.lt.${afterId})`);
      }
    } catch {
      /* ignore bad cursor */
    }
  }

  const { data: allIssues } = await query;
  const hasMore = (allIssues?.length ?? 0) > PAGE_SIZE;
  const issues = hasMore ? allIssues!.slice(0, PAGE_SIZE) : (allIssues ?? []);
  const last = issues[issues.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(`${last.updated_at}:${last.id}`).toString("base64") : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <H1 className="text-xl">Issue Builder</H1>
          <Muted>Every issue across every publication you belong to.</Muted>
        </div>
        <Button asChild>
          <Link href="/issues/new">New issue</Link>
        </Button>
      </div>

      {!issues?.length ? (
        <Muted>No issues yet.</Muted>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {issues.map((issue) => {
            const pub = Array.isArray(issue.publications) ? issue.publications[0] : issue.publications;
            return (
              <Link key={issue.id} href={`/issues/${issue.id}`}>
                <Card className="h-full transition-colors hover:border-neutral-300">
                  <CardHeader>
                    <CardTitle className="truncate text-base">{issue.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Muted className="truncate text-xs">{pub?.name}</Muted>
                    <Badge
                      variant={issue.status === "published" ? "success" : "neutral"}
                      className="capitalize"
                    >
                      {issue.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" asChild>
            <Link href={`/issues?cursor=${nextCursor}`}>Load more</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

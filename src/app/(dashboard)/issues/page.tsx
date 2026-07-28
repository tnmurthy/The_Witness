import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Issue Builder" };

export default async function IssuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, status, updated_at, publications(name)")
    .order("updated_at", { ascending: false });

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
                    <Badge variant={issue.status === "published" ? "success" : "neutral"} className="capitalize">
                      {issue.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

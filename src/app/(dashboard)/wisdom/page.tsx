import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WISDOM_SOURCE_LABELS } from "@/lib/validation/wisdom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { H1, Muted } from "@/components/ui/typography";
import { WisdomSearchBar } from "@/components/wisdom/wisdom-search-bar";

export const metadata = { title: "Wisdom Engine" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success",
  in_review: "warning",
  rejected: "danger",
  draft: "neutral",
};

interface WisdomPageProps {
  searchParams: Promise<{ search?: string; sourceType?: string; reviewStatus?: string }>;
}

/**
 * The Wisdom Engine's own scoped search (this milestone's "Search"
 * deliverable) — Postgres full-text search over wisdom_entries.
 * search_vector, not a platform-wide search system (Milestone 8). See
 * docs/WISDOM_ENGINE.md.
 */
export default async function WisdomPage({ searchParams }: WisdomPageProps) {
  const { search, sourceType, reviewStatus } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let query = supabase
    .from("wisdom_entries")
    .select("id, title, source_type, translation, review_status, keywords, wisdom_categories(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (search) query = query.textSearch("search_vector", search, { type: "websearch" });
  if (sourceType) query = query.eq("source_type", sourceType);
  if (reviewStatus) query = query.eq("review_status", reviewStatus);

  const { data: entries } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <H1 className="text-xl">Wisdom Engine</H1>
          <Muted>Structured knowledge from seven classical sources, reframed for technology and career decisions.</Muted>
        </div>
        <Button asChild variant="signal">
          <Link href="/wisdom/new">New entry</Link>
        </Button>
      </div>

      <Suspense fallback={<div className="h-10" aria-hidden="true" />}>
        <WisdomSearchBar />
      </Suspense>

      {!entries?.length ? (
        <Muted>No wisdom entries match.</Muted>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const category = Array.isArray(entry.wisdom_categories) ? entry.wisdom_categories[0] : entry.wisdom_categories;
              return (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Link href={`/wisdom/${entry.id}`} className="font-medium text-foreground hover:underline">
                      {entry.title}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{entry.translation}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{WISDOM_SOURCE_LABELS[entry.source_type as keyof typeof WISDOM_SOURCE_LABELS]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{category?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[entry.review_status] ?? "neutral"} className="capitalize">
                      {entry.review_status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

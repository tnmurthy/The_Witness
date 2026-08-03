import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, FileTextIcon } from "lucide-react";

export const metadata = { title: "Articles" };

export default async function ArticlesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, slug, status, published_at, updated_at, publications(name, slug)")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Articles</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Standalone articles — evergreen content not tied to a specific issue edition.
          </p>
        </div>
        <Button asChild>
          <Link href="/articles/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            New article
          </Link>
        </Button>
      </div>

      {!articles?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <FileTextIcon className="h-10 w-10 text-neutral-300" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-4 text-sm font-medium text-neutral-900">No articles yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Create your first article — it will appear here once saved.
          </p>
          <Button asChild size="sm" className="mt-6">
            <Link href="/articles/new">Write your first article</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {articles.map((article) => {
            const pub = Array.isArray(article.publications) ? article.publications[0] : article.publications;
            return (
              <li key={article.id}>
                <Link
                  href={`/articles/${article.id}`}
                  className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{article.title}</p>
                    {pub && <p className="mt-0.5 text-xs text-neutral-400">{pub.name}</p>}
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <Badge
                      variant={article.status === "published" ? "success" : "neutral"}
                      className="capitalize"
                    >
                      {article.status}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      {new Date(article.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

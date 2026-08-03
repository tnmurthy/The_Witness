/**
 * /p/[pubSlug]/[issueSlug] — Public issue reader
 * Renders published issue content. No auth required.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicBlockRenderer } from "@/components/public/public-block-renderer";
import { SubscribeForm } from "@/components/public/subscribe-form";

export default async function PublicIssuePage({
  params,
}: {
  params: Promise<{ pubSlug: string; issueSlug: string }>;
}) {
  const { pubSlug, issueSlug } = await params;
  const supabase = await createClient();

  const { data: pub } = await supabase
    .from("publications")
    .select("id, name, slug, description")
    .eq("slug", pubSlug)
    .single();

  if (!pub) notFound();

  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, slug, status, published_at, publication_id")
    .eq("slug", issueSlug)
    .eq("publication_id", pub.id)
    .eq("status", "published")
    .single();

  if (!issue) notFound();

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, position, payload")
    .eq("issue_id", issue.id)
    .order("position");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      {/* Publication header */}
      <div className="mb-10 text-center">
        <Link
          href={`/p/${pubSlug}`}
          className="text-xs font-semibold uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
        >
          {pub.name}
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-neutral-900">{issue.title}</h1>
        {issue.published_at && (
          <time className="mt-3 block text-sm text-neutral-400">
            {new Date(issue.published_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
      </div>

      {/* Issue content */}
      <article className="prose prose-lg prose-neutral max-w-none">
        <PublicBlockRenderer blocks={blocks ?? []} />
      </article>

      {/* Subscribe CTA at bottom */}
      <div className="mt-16 border-t border-neutral-200 pt-12">
        <p className="mb-6 text-center text-sm text-neutral-500">
          Enjoy this issue? Subscribe to get future ones in your inbox.
        </p>
        <SubscribeForm publicationId={pub.id} publicationName={pub.name} />
      </div>
    </main>
  );
}

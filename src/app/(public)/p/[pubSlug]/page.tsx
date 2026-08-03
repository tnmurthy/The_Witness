/**
 * /p/[pubSlug] — Public publication home page
 * Shows the publication description, published issues, and subscribe form.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubscribeForm } from "@/components/public/subscribe-form";

export default async function PublicationPage({ params }: { params: Promise<{ pubSlug: string }> }) {
  const { pubSlug } = await params;
  const supabase = await createClient();

  const { data: pub } = await supabase
    .from("publications")
    .select("id, name, slug, description, status")
    .eq("slug", pubSlug)
    .eq("status", "active")
    .single();

  if (!pub) notFound();

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, slug, published_at")
    .eq("publication_id", pub.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12 text-center">
        <h1 className="mb-3 font-serif text-4xl font-bold text-neutral-900">{pub.name}</h1>
        {pub.description && <p className="text-lg leading-relaxed text-neutral-600">{pub.description}</p>}
      </header>

      <SubscribeForm publicationId={pub.id} publicationName={pub.name} />

      <section className="mt-12">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-neutral-400">Issues</h2>
        {!issues?.length ? (
          <p className="py-8 text-center text-neutral-500">No published issues yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {issues.map((issue) => (
              <li key={issue.id} className="py-5">
                <Link href={`/p/${pubSlug}/${issue.slug}`} className="group block">
                  <h3 className="font-serif text-xl text-neutral-900 transition-colors group-hover:text-navy-700">
                    {issue.title}
                  </h3>
                  {issue.published_at && (
                    <time className="mt-1 block text-sm text-neutral-400">
                      {new Date(issue.published_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArticleNewForm } from "@/components/articles/article-new-form";

export const metadata = { title: "New Article" };

export default async function NewArticlePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Fetch publications the user belongs to
  const { data: memberships } = await supabase
    .from("publication_members")
    .select("publication_id, role, publications(id, name, slug)")
    .eq("user_id", user.id);

  const publications = (memberships ?? [])
    .map((m) => {
      const pub = Array.isArray(m.publications) ? m.publications[0] : m.publications;
      return pub ? { ...pub, memberRole: m.role } : null;
    })
    .filter(Boolean);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">New article</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Articles are standalone pieces of evergreen content — guides, deep-dives, and reference material.
        </p>
      </div>
      <ArticleNewForm
        publications={publications as Array<{ id: string; name: string; slug: string; memberRole: string }>}
      />
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IssueBuilderShell } from "@/components/issue-builder/issue-builder-shell";
import type { BlockRow } from "@/lib/stores/issue-builder-store";

export const metadata = { title: "Article Builder" };

export default async function ArticleBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Articles use the same section/block model as issues.
  // We synthesise an "issue-like" shape so the IssueBuilderShell
  // requires zero modification — the only difference is the source table.
  const { data: article } = await supabase
    .from("articles")
    .select("id, title, status, publication_id, publications(name)")
    .eq("id", id)
    .single();

  if (!article) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", article.publication_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipRole = (membership?.role ?? null) as
    "editor_in_chief" | "editor" | "writer" | "researcher" | null;

  // Sections linked to this article_id (article_id column, not issue_id)
  const { data: sections } = await supabase
    .from("sections")
    .select("id, title, position")
    .eq("article_id", id)
    .order("position");

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: blocks } = sectionIds.length
    ? await supabase
        .from("blocks")
        .select("id, section_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
        .in("section_id", sectionIds)
        .order("position")
    : { data: [] };

  // Adapt article to the issue shape expected by IssueBuilderShell
  const issueShape = {
    id: article.id,
    title: article.title,
    status: article.status,
    publication_id: article.publication_id,
    publications: article.publications,
    // Articles don't have a slug displayed in the builder
    slug: article.id,
  };

  return (
    <IssueBuilderShell
      issue={issueShape as Parameters<typeof IssueBuilderShell>[0]["issue"]}
      initialSections={(sections ?? []) as Parameters<typeof IssueBuilderShell>[0]["initialSections"]}
      initialBlocks={(blocks ?? []) as BlockRow[]}
      currentUserId={user.id}
      currentUserName={profile?.full_name || user.email || "Someone"}
      membershipRole={membershipRole}
      platformRole={profile?.role ?? "subscriber"}
    />
  );
}

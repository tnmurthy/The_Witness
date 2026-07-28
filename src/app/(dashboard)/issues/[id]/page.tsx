import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IssueBuilderShell } from "@/components/issue-builder/issue-builder-shell";
import type { BlockRow } from "@/lib/stores/issue-builder-store";

export const metadata = { title: "Issue Builder" };

export default async function IssueBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, status, publication_id, publications(name)")
    .eq("id", id)
    .single();
  if (!issue) notFound();

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { data: sections } = await supabase.from("sections").select("id, issue_id, title, position").eq("issue_id", id).order("position");

  const { data: rawBlocks } = await supabase
    .from("blocks")
    .select("id, section_id, issue_id, type, position, payload, ai_generated, last_edited_by, last_edited_at")
    .eq("issue_id", id)
    .order("position");

  // Untyped Supabase response (no generated database types yet — see
  // Milestone 1's README note) coerced into the store's BlockRow shape
  // at this one boundary, rather than threading `any` further into
  // client components.
  const blocks: BlockRow[] = (rawBlocks ?? []).map((b) => ({
    id: b.id,
    section_id: b.section_id,
    type: b.type,
    position: b.position,
    payload: (b.payload ?? {}) as Record<string, unknown>,
    ai_generated: b.ai_generated,
    last_edited_by: b.last_edited_by,
    last_edited_at: b.last_edited_at,
  }));

  return (
    <IssueBuilderShell
      issue={issue}
      initialSections={sections ?? []}
      initialBlocks={blocks}
      currentUserId={user.id}
      currentUserName={profile?.full_name || user.email || "Someone"}
    />
  );
}

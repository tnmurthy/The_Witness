import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateIssueForm } from "@/components/issue-builder/create-issue-form";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "New issue" };

export default async function NewIssuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: memberships } = await supabase
    .from("publication_members")
    .select("publications(id, name)")
    .eq("user_id", user.id);

  const publications = (memberships ?? [])
    .map((m) => (Array.isArray(m.publications) ? m.publications[0] : m.publications))
    .filter((p): p is { id: string; name: string } => !!p);

  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">New issue</H1>
        <Muted>Starts with one empty section — you&apos;ll add blocks from the builder canvas.</Muted>
      </div>
      <CreateIssueForm publications={publications} />
    </div>
  );
}

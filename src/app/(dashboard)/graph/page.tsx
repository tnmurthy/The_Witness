import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GraphExplorerShell } from "@/components/graph/graph-explorer-shell";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Knowledge Graph" };

export default async function GraphExplorerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">Knowledge Graph</H1>
        <Muted>
          Technology → Companies → Articles → Books → Research → Courses → GitHub → Wisdom → People → Issues — every
          connection, browsable.
        </Muted>
      </div>
      <GraphExplorerShell />
    </div>
  );
}

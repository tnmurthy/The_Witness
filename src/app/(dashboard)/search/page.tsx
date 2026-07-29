import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchResults } from "@/components/search/search-results";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Search" };

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">Search</H1>
        <Muted>Find anything in the Knowledge Graph.</Muted>
      </div>
      <SearchResults />
    </div>
  );
}

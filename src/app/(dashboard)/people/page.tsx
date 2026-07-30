import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PeopleList } from "@/components/people/people-list";
import { Button } from "@/components/ui/button";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <H1 className="text-xl">People</H1>
          <Muted>Authors, founders, and other individuals referenced across the Knowledge Graph.</Muted>
        </div>
        <Button asChild>
          <Link href="/people/new">Add person</Link>
        </Button>
      </div>
      <PeopleList />
    </div>
  );
}

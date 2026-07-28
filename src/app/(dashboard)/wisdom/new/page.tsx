import { createClient } from "@/lib/supabase/server";
import { WisdomEntryForm } from "@/components/wisdom/wisdom-entry-form";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "New wisdom entry" };

export default async function NewWisdomEntryPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("wisdom_categories").select("id, name").order("name");

  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">New wisdom entry</H1>
        <Muted>Saved as a draft — submit for review when ready.</Muted>
      </div>
      <WisdomEntryForm categories={categories ?? []} />
    </div>
  );
}

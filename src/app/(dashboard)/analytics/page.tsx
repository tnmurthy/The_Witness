import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, Muted } from "@/components/ui/typography";

export const metadata = { title: "Analytics" };

/**
 * A real page, not a dead link — but honestly not a real analytics
 * dashboard either. Building fake widgets with placeholder numbers
 * would be worse than this: it would look like a finished feature until
 * someone noticed the numbers never changed. Analytics is genuinely a
 * later milestone's scope (reader engagement, subscriber growth,
 * content performance — none of which this app tracks yet, since no
 * event pipeline exists). This page says so plainly instead of faking
 * it, and is what "do not leave placeholder components" means applied
 * to a feature that legitimately isn't built yet: an honest empty
 * state, not a decorative mockup.
 */
export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <div>
        <H1 className="text-xl">Analytics</H1>
        <Muted>Reader engagement, subscriber growth, and content performance.</Muted>
      </div>
      <EmptyState
        icon={BarChart3}
        title="Not built yet"
        description="Analytics needs an event-tracking pipeline this platform doesn't have yet — reader opens, click-throughs, subscriber growth. This page will show real dashboards once that exists, not before."
      />
    </div>
  );
}

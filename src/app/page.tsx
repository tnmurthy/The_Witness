import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The root route has no UI of its own — it just routes an authenticated
 * user to the dashboard and everyone else to sign-in. Real marketing/public
 * landing content is out of scope for Milestone 1 (Implementation Plan).
 */
export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  redirect(data.user ? "/dashboard" : "/sign-in");
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout for every route under /dashboard. Middleware (middleware.ts)
 * already redirects unauthenticated requests away before this ever
 * renders, but this Server Component re-checks the user directly rather
 * than trusting that redirect alone — defense in depth, and it's also
 * how we get the user's identity to pass down to the Topbar/UserMenu
 * without another client-side round trip.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // profiles.full_name / role (Database Schema Design, Migration 002/013).
  // Read defensively: a signed-in auth.users row can exist for a moment
  // before its profiles row is created (though Migration 013's
  // handle_new_auth_user trigger closes most of that race), and this
  // should never crash the shell.
  // NOTE: untyped for now — `supabase gen types typescript` gets wired up
  // once a real Supabase project exists (see README), which will replace
  // this `any`-typed .from() call with a fully typed one.
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

  return (
    <AppShell userEmail={user.email ?? ""} userFullName={profile?.full_name} showAdmin={profile?.role === "super_admin"}>
      {children}
    </AppShell>
  );
}

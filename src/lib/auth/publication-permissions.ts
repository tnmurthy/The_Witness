import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipRole, PlatformRole } from "@/lib/auth/roles";

/**
 * Mirrors is_publication_editor_or_above() (supabase/migrations/002_
 * identity_and_access.sql) exactly, so an API route can return a clean
 * 403 with a helpful message before ever issuing the write that RLS
 * would otherwise silently reject with a generic "row violates policy"
 * error. This check is defense-in-depth, not the security boundary — see
 * docs/RBAC.md, "Two layers of enforcement."
 */
export async function canEditPublication(
  supabase: SupabaseClient,
  publicationId: string,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if ((profile?.role as PlatformRole | undefined) === "super_admin") return true;

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", publicationId)
    .eq("user_id", userId)
    .single();

  const role = membership?.role as MembershipRole | undefined;
  return role === "editor_in_chief" || role === "editor";
}

/** True if the user may create new publications at all — platform-wide, not scoped to an existing one. Mirrors publications_insert_editorial. */
export function canCreatePublicationRole(role: PlatformRole | undefined): boolean {
  return role === "super_admin" || role === "editor_in_chief";
}

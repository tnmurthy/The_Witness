import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipRole, PlatformRole } from "@/lib/auth/roles";

/**
 * Mirrors can_edit_issue() (supabase/migrations/004_issue_builder.sql)
 * exactly: Super Admin, publication editor-or-above, or the writer/
 * researcher who authored the (still-draft) issue. Same defense-in-depth
 * relationship to RLS as canEditPublication — see docs/RBAC.md.
 */
export async function canEditIssue(
  supabase: SupabaseClient,
  issueId: string,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if ((profile?.role as PlatformRole | undefined) === "super_admin") return true;

  const { data: issue } = await supabase
    .from("issues")
    .select("publication_id, created_by")
    .eq("id", issueId)
    .single();
  if (!issue) return false;

  const { data: membership } = await supabase
    .from("publication_members")
    .select("role")
    .eq("publication_id", issue.publication_id)
    .eq("user_id", userId)
    .single();

  const role = membership?.role as MembershipRole | undefined;
  if (role === "editor_in_chief" || role === "editor") return true;
  if ((role === "writer" || role === "researcher") && issue.created_by === userId) return true;

  return false;
}

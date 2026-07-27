import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PlatformRole } from "./roles";
import { logger } from "@/lib/logger";

interface RequireRoleResult {
  userId: string;
  email: string;
  role: PlatformRole;
}

/**
 * Server Component / Route Handler guard: redirects to /sign-in if
 * unauthenticated, and to /dashboard (with a toast-friendly query param) if
 * authenticated but the role check fails. Call at the top of any
 * role-restricted page or layout — e.g. the Admin Users page:
 *
 *   const { role } = await requireRole(["super_admin"]);
 *
 * This is a UX guard, not the security boundary — Row Level Security
 * enforces the actual data access restriction underneath it (see
 * docs/RBAC.md). A page that forgets to call this would still have every
 * database read/write correctly restricted by RLS; it would just render
 * an empty or broken UI instead of redirecting cleanly, which is why this
 * helper exists rather than relying on RLS's denial as the only user
 * -facing signal.
 */
export async function requireRole(allowed: PlatformRole[]): Promise<RequireRoleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const role = profile?.role as PlatformRole | undefined;

  if (!role || !allowed.includes(role)) {
    logger.warn("Role-guarded route denied", { userId: user.id, role, allowed });
    redirect("/dashboard?error=insufficient_role");
  }

  return { userId: user.id, email: user.email ?? "", role };
}

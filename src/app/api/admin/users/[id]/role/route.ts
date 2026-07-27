import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageUsers } from "@/lib/auth/permissions";
import { changeUserRoleSchema } from "@/lib/validation/admin";
import { logger } from "@/lib/logger";
import type { PlatformRole } from "@/lib/auth/roles";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]/role — Super Admin only.
 *
 * Deliberately uses the service-role client (src/lib/supabase/admin.ts)
 * for the actual write: profiles_update_self's RLS policy intentionally
 * has no path for one user's session to change another user's role
 * (Migration 002/013), so "Super Admin changes someone else's role" is a
 * genuinely privileged, cross-user action that has to go through the
 * service role. canManageUsers() below is what stands in for RLS here —
 * it is checked BEFORE the admin client is ever touched, so a caller who
 * fails this check never reaches a code path that could bypass RLS.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = callerProfile?.role as PlatformRole | undefined;

  if (!callerRole || !canManageUsers(callerRole)) {
    logger.warn("Role change denied — insufficient permission", { actorId: user.id, targetUserId });
    return NextResponse.json({ error: "Only a Super Admin can change user roles" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changeUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", targetUserId)
    .select("id, full_name, role")
    .single();

  if (error || !updated) {
    logger.error("Role change failed", { error, actorId: user.id, targetUserId });
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  // The audit_profile_role_change trigger (Migration 013) fires on this
  // update regardless of which client performed it, so the audit_logs row
  // is written automatically — no separate logging call needed here.
  // Note its actor_id will be null for this specific write (the service
  // role has no auth.uid() session), which is why the route itself also
  // logs the actor via the structured logger below.
  logger.info("User role changed", { actorId: user.id, targetUserId, newRole: parsed.data.role });

  return NextResponse.json({ profile: updated });
}

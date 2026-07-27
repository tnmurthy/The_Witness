import type { PlatformRole, OrganizationRole } from "./roles";

/**
 * RBAC permission model (Milestone 2).
 *
 * This module is the application-layer permission check — used for UI
 * conditionals (hide a button the user can't use) and as defense-in-depth
 * in API routes (reject a request before it ever reaches the database).
 * It is NOT the actual security boundary: Row Level Security policies
 * (supabase/migrations/002_identity_and_access.sql and onward) are what
 * actually stop an unauthorized read or write at the database layer, and
 * remain the enforcement of record even if a check here is ever missed on
 * a new route. See docs/RBAC.md, "Two layers of enforcement."
 *
 * Editorial roles and subscriber tiers are deliberately NOT one linear
 * hierarchy — a Premium Subscriber is not "above" a Writer, they're a
 * different track (consumer vs. editorial staff). Two separate rank maps
 * below reflect that; there is no single getRoleRank() that would imply
 * an ordering across both.
 */

const EDITORIAL_RANK: Record<Extract<PlatformRole, "super_admin" | "editor_in_chief" | "editor" | "writer" | "researcher">, number> = {
  super_admin: 4,
  editor_in_chief: 3,
  editor: 2,
  writer: 1,
  researcher: 1, // writer and researcher are peers — neither manages the other
};

function editorialRank(role: PlatformRole): number {
  return role in EDITORIAL_RANK ? EDITORIAL_RANK[role as keyof typeof EDITORIAL_RANK] : 0;
}

/** True if `role` is at or above `min` on the editorial track. Subscriber-track roles always return false, since they aren't on this track. */
export function hasEditorialRankAtLeast(role: PlatformRole, min: keyof typeof EDITORIAL_RANK): boolean {
  return editorialRank(role) >= EDITORIAL_RANK[min];
}

/** Platform-wide user/role administration — the Admin: Users & Roles screen. Deliberately Super Admin only: even an Editor-in-Chief cannot change another user's platform_role (they can manage publication_members roles within their own publication instead). */
export function canManageUsers(role: PlatformRole): boolean {
  return role === "super_admin";
}

/** Full audit log visibility. Mirrors the audit_logs_select_admin RLS policy exactly — kept in sync deliberately so the UI never offers a view the database will then deny. */
export function canViewAuditLog(role: PlatformRole): boolean {
  return role === "super_admin" || role === "editor_in_chief";
}

/** Creating a new publication (Milestone 3 surface, gated here in Milestone 2 since role administration is this milestone's scope). Mirrors publications_insert_editorial. */
export function canCreatePublication(role: PlatformRole): boolean {
  return role === "super_admin" || role === "editor_in_chief";
}

/** Organization administration is scoped to the organization, not the platform — pass the caller's organization_role for the specific org, not their platform_role. */
export function canManageOrganization(orgRole: OrganizationRole | null | undefined): boolean {
  return orgRole === "admin";
}

/** Whether `role` may access premium-only content. Distinct from the editorial track entirely. */
export function hasPremiumAccess(role: PlatformRole): boolean {
  return role === "premium_subscriber" || isEditorialTrack(role);
}

function isEditorialTrack(role: PlatformRole): boolean {
  return role in EDITORIAL_RANK;
}

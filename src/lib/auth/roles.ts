import { z } from "zod";

/**
 * Platform roles — must stay byte-for-byte in sync with the `platform_role`
 * Postgres enum (supabase/migrations/013_rbac_and_audit.sql). There is no
 * automated codegen keeping these in sync in this milestone (that would be
 * a reasonable Milestone 11 hardening task); src/__tests__/roles.test.ts
 * pins this exact list so a drift is caught by `npm test`, not discovered
 * at runtime as a rejected insert.
 */
export const PLATFORM_ROLES = [
  "super_admin",
  "editor_in_chief",
  "editor",
  "writer",
  "researcher",
  "subscriber",
  "premium_subscriber",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const platformRoleSchema = z.enum(PLATFORM_ROLES);

/** Role a user holds within a specific publication. Mirrors `membership_role`. */
export const MEMBERSHIP_ROLES = ["editor_in_chief", "editor", "writer", "researcher"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** Role within an organization. Mirrors `organization_role`. "Organization
 * Admin" (from the Milestone 2 role list) is this role, scoped to one
 * organization — deliberately not a platform_role value, since org
 * administration and platform-wide editorial standing are orthogonal: a
 * user can be an Organization Admin for their employer's enterprise seat
 * while holding any platform_role, including a bare subscriber. See
 * docs/RBAC.md for the full rationale. */
export const ORGANIZATION_ROLES = ["admin", "member"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  editor_in_chief: "Editor-in-Chief",
  editor: "Editor",
  writer: "Writer",
  researcher: "Researcher",
  subscriber: "Subscriber",
  premium_subscriber: "Premium Subscriber",
};

export const EDITORIAL_ROLES: readonly PlatformRole[] = [
  "super_admin",
  "editor_in_chief",
  "editor",
  "writer",
  "researcher",
];

export function isEditorialRole(role: PlatformRole): boolean {
  return (EDITORIAL_ROLES as PlatformRole[]).includes(role);
}

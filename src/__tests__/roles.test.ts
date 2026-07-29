import { describe, it, expect } from "vitest";
import {
  PLATFORM_ROLES,
  MEMBERSHIP_ROLES,
  ORGANIZATION_ROLES,
  PLATFORM_ROLE_LABELS,
  isEditorialRole,
} from "@/lib/auth/roles";

describe("PLATFORM_ROLES", () => {
  it("matches the exact role list from the Milestone 2 spec and the platform_role DB enum", () => {
    // If this fails, either this file or
    // supabase/migrations/013_rbac_and_audit.sql has drifted — update
    // whichever one is stale, don't just change this assertion.
    expect(PLATFORM_ROLES).toEqual([
      "super_admin",
      "editor_in_chief",
      "editor",
      "writer",
      "researcher",
      "subscriber",
      "premium_subscriber",
    ]);
  });

  it("has a display label for every role", () => {
    for (const role of PLATFORM_ROLES) {
      expect(PLATFORM_ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("does not include designer — dropped in favor of the finalized Milestone 2 role list", () => {
    expect(PLATFORM_ROLES).not.toContain("designer");
  });
});

describe("MEMBERSHIP_ROLES", () => {
  it("matches the membership_role DB enum", () => {
    expect(MEMBERSHIP_ROLES).toEqual(["editor_in_chief", "editor", "writer", "researcher"]);
  });
});

describe("ORGANIZATION_ROLES", () => {
  it("matches the organization_role DB enum", () => {
    expect(ORGANIZATION_ROLES).toEqual(["admin", "member"]);
  });
});

describe("isEditorialRole", () => {
  it("is true for editorial staff roles", () => {
    expect(isEditorialRole("editor")).toBe(true);
    expect(isEditorialRole("writer")).toBe(true);
    expect(isEditorialRole("super_admin")).toBe(true);
  });

  it("is false for subscriber-track roles", () => {
    expect(isEditorialRole("subscriber")).toBe(false);
    expect(isEditorialRole("premium_subscriber")).toBe(false);
  });
});

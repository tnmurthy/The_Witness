import { describe, it, expect } from "vitest";
import {
  canManageUsers,
  canViewAuditLog,
  canCreatePublication,
  canManageOrganization,
  hasPremiumAccess,
  hasEditorialRankAtLeast,
} from "@/lib/auth/permissions";

describe("canManageUsers", () => {
  it("is true only for super_admin", () => {
    expect(canManageUsers("super_admin")).toBe(true);
    expect(canManageUsers("editor_in_chief")).toBe(false);
    expect(canManageUsers("editor")).toBe(false);
  });
});

describe("canViewAuditLog", () => {
  it("is true for super_admin and editor_in_chief only", () => {
    expect(canViewAuditLog("super_admin")).toBe(true);
    expect(canViewAuditLog("editor_in_chief")).toBe(true);
    expect(canViewAuditLog("editor")).toBe(false);
    expect(canViewAuditLog("writer")).toBe(false);
  });
});

describe("canCreatePublication", () => {
  it("mirrors the publications_insert_editorial RLS policy: super_admin or editor_in_chief", () => {
    expect(canCreatePublication("super_admin")).toBe(true);
    expect(canCreatePublication("editor_in_chief")).toBe(true);
    expect(canCreatePublication("editor")).toBe(false);
    expect(canCreatePublication("subscriber")).toBe(false);
  });
});

describe("canManageOrganization", () => {
  it("is true only for an org admin, scoped to organization_role not platform_role", () => {
    expect(canManageOrganization("admin")).toBe(true);
    expect(canManageOrganization("member")).toBe(false);
    expect(canManageOrganization(null)).toBe(false);
    expect(canManageOrganization(undefined)).toBe(false);
  });
});

describe("hasPremiumAccess", () => {
  it("is true for premium_subscriber and every editorial role", () => {
    expect(hasPremiumAccess("premium_subscriber")).toBe(true);
    expect(hasPremiumAccess("writer")).toBe(true);
    expect(hasPremiumAccess("super_admin")).toBe(true);
  });

  it("is false for a bare subscriber", () => {
    expect(hasPremiumAccess("subscriber")).toBe(false);
  });
});

describe("hasEditorialRankAtLeast", () => {
  it("ranks super_admin above editor_in_chief above editor above writer/researcher", () => {
    expect(hasEditorialRankAtLeast("super_admin", "editor_in_chief")).toBe(true);
    expect(hasEditorialRankAtLeast("editor", "editor_in_chief")).toBe(false);
    expect(hasEditorialRankAtLeast("editor_in_chief", "editor")).toBe(true);
  });

  it("treats writer and researcher as peers — neither outranks the other", () => {
    expect(hasEditorialRankAtLeast("writer", "researcher")).toBe(true);
    expect(hasEditorialRankAtLeast("researcher", "writer")).toBe(true);
  });

  it("is false for subscriber-track roles regardless of the minimum requested", () => {
    expect(hasEditorialRankAtLeast("premium_subscriber", "writer")).toBe(false);
    expect(hasEditorialRankAtLeast("subscriber", "writer")).toBe(false);
  });
});

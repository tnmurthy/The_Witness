import { describe, it, expect } from "vitest";
import { createOrganizationSchema, inviteMemberSchema } from "@/lib/validation/organizations";
import { changeUserRoleSchema } from "@/lib/validation/admin";
import { updateProfileSchema } from "@/lib/validation/profile";

describe("createOrganizationSchema", () => {
  it("accepts a valid organization", () => {
    const result = createOrganizationSchema.safeParse({ name: "Acme University", type: "university" });
    expect(result.success).toBe(true);
  });

  it("rejects a name that's too short", () => {
    const result = createOrganizationSchema.safeParse({ name: "A", type: "company" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid organization type", () => {
    const result = createOrganizationSchema.safeParse({ name: "Acme", type: "nonprofit" });
    expect(result.success).toBe(false);
  });
});

describe("inviteMemberSchema", () => {
  it("defaults role to member when omitted", () => {
    const result = inviteMemberSchema.safeParse({ email: "person@example.com" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("member");
  });

  it("rejects a malformed email", () => {
    const result = inviteMemberSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("changeUserRoleSchema", () => {
  it("accepts every valid platform role", () => {
    for (const role of [
      "super_admin",
      "editor_in_chief",
      "editor",
      "writer",
      "researcher",
      "subscriber",
      "premium_subscriber",
    ]) {
      expect(changeUserRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects a role outside the finalized list", () => {
    expect(changeUserRoleSchema.safeParse({ role: "designer" }).success).toBe(false);
    expect(changeUserRoleSchema.safeParse({ role: "admin" }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("rejects an empty name", () => {
    expect(updateProfileSchema.safeParse({ fullName: "" }).success).toBe(false);
  });

  it("accepts a normal name", () => {
    expect(updateProfileSchema.safeParse({ fullName: "Ada Admin" }).success).toBe(true);
  });
});

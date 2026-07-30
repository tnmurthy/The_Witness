import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}));

describe("GET /api/admin/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/admin/users/route");

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 403 for a role without user-management permission (e.g. writer)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/admin/users/route");

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns the user list for a Super Admin", async () => {
    const users = [{ id: "u1", full_name: "Ada", role: "writer", created_at: "2026-01-01" }];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .from("profiles", { data: users, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/admin/users/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual(users);
  });
});

describe("PATCH /api/admin/users/[id]/role", () => {
  beforeEach(() => vi.clearAllMocks());

  const params = Promise.resolve({ id: "target-user-id" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { PATCH } = await import("@/app/api/admin/users/[id]/role/route");

    const response = await PATCH(new Request("http://test", { method: "PATCH", body: "{}" }), { params });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-Super-Admin caller — even an Editor-in-Chief cannot change roles", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor_in_chief" }, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/admin/users/[id]/role/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ role: "editor" }) }),
      {
        params,
      }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Super Admin");
  });

  it("returns 422 for an invalid role value", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/admin/users/[id]/role/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ role: "not_a_real_role" }) }),
      { params }
    );
    expect(response.status).toBe(422);
  });

  it("uses the service-role admin client (not the caller's session client) for the actual write, and succeeds for a Super Admin", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .build()
    );
    const updated = { id: "target-user-id", full_name: "Target", role: "editor" };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    };
    mockAdminFrom.mockReturnValue(updateChain);

    const { PATCH } = await import("@/app/api/admin/users/[id]/role/route");
    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ role: "editor" }) }),
      {
        params,
      }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toEqual(updated);
    expect(mockAdminFrom).toHaveBeenCalledWith("profiles");
    expect(updateChain.update).toHaveBeenCalledWith({ role: "editor" });
  });
});

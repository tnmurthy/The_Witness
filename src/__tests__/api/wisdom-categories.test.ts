import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

/**
 * `vi.mock` on the module path replaces `createClient` everywhere it's
 * imported from `@/lib/supabase/server` — including inside the route
 * handler under test — with a function this test controls per-case via
 * `mockCreateClient.mockResolvedValue(...)`. This is what makes it
 * possible to import and call a real route handler directly (the exact
 * function Next.js itself would invoke for a real request) without a
 * live database, network, or running server — genuine integration
 * testing of the handler's own logic (auth checks, validation,
 * authorization, response shape), not a reimplementation of it.
 */
const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("GET/POST /api/wisdom-categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/wisdom-categories/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("GET returns the category list for an authenticated user", async () => {
    const categories = [{ id: "c1", name: "Decision-Making", slug: "decision-making", description: null }];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("wisdom_categories", { data: categories, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/wisdom-categories/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.categories).toEqual(categories);
  });

  it("GET returns 500 with a clean message when the query fails", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("wisdom_categories", { data: null, error: { message: "connection refused" } })
        .build()
    );
    const { GET } = await import("@/app/api/wisdom-categories/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to load categories");
  });

  it("POST returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/wisdom-categories/route");

    const response = await POST(new Request("http://test", { method: "POST", body: JSON.stringify({}) }));
    expect(response.status).toBe(401);
  });

  it("POST returns 403 for a non-editorial role", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-categories/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "X", slug: "x" }) })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("editor");
  });

  it("POST returns 422 for invalid input (bad slug format)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-categories/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ name: "X", slug: "Not A Valid Slug!" }),
      })
    );

    expect(response.status).toBe(422);
  });

  it("POST creates a category and returns 201 for valid input from an editor", async () => {
    const created = { id: "c2", name: "Leadership", slug: "leadership" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor_in_chief" }, error: null })
        .from("wisdom_categories", { data: created, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-categories/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ name: "Leadership", slug: "leadership" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.category).toEqual(created);
  });

  it("POST returns 409 with a clean message on a duplicate slug", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("wisdom_categories", { data: null, error: { message: "duplicate key", code: "23505" } })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-categories/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "X", slug: "x" }) })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already in use");
  });
});

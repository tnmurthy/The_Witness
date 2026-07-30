import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("PATCH /api/blocks/[id] — the Issue Builder's autosave target", () => {
  beforeEach(() => vi.clearAllMocks());

  const params = Promise.resolve({ id: "block-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(new Request("http://test", { method: "PATCH", body: "{}" }), { params });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the block doesn't exist", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("blocks", { data: null, error: null }).build()
    );
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(new Request("http://test", { method: "PATCH", body: "{}" }), { params });
    expect(response.status).toBe(404);
  });

  it("returns 403 when canEditIssue's full chain (not super admin, no membership) denies access", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("blocks", { data: { issue_id: "issue-1", type: "paragraph" }, error: null })
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("issues", { data: { publication_id: "pub-1", created_by: "someone-else" }, error: null })
        .from("publication_members", { data: null, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ payload: { text: "x" } }) }),
      { params }
    );
    expect(response.status).toBe(403);
  });

  it("returns 422 when the payload doesn't match the block's own type schema", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("blocks", { data: { issue_id: "issue-1", type: "heading" }, error: null })
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ payload: { level: 2 } }) }),
      { params }
    );
    expect(response.status).toBe(422);
  });

  it("saves successfully for a Super Admin (shortest canEditIssue path)", async () => {
    const updated = {
      id: "block-1",
      section_id: "s1",
      issue_id: "issue-1",
      type: "paragraph",
      position: 0,
      payload: { text: "updated" },
      ai_generated: false,
      last_edited_by: testUser.id,
      last_edited_at: "2026-01-01",
    };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("blocks", { data: { issue_id: "issue-1", type: "paragraph" }, error: null })
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .from("blocks", { data: updated, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ payload: { text: "updated" } }) }),
      { params }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.block).toEqual(updated);
  });

  it("saves successfully for the issue's own author (writer role, self-authored draft)", async () => {
    const updated = {
      id: "block-1",
      section_id: "s1",
      issue_id: "issue-1",
      type: "paragraph",
      position: 0,
      payload: { text: "x" },
      ai_generated: false,
      last_edited_by: testUser.id,
      last_edited_at: "2026-01-01",
    };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("blocks", { data: { issue_id: "issue-1", type: "paragraph" }, error: null })
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("issues", { data: { publication_id: "pub-1", created_by: testUser.id }, error: null })
        .from("publication_members", { data: { role: "writer" }, error: null })
        .from("blocks", { data: updated, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/blocks/[id]/route");

    const response = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ payload: { text: "x" } }) }),
      { params }
    );
    expect(response.status).toBe(200);
  });
});

describe("GET/POST /api/issues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/issues/route");

    const response = await GET(new Request("http://test/api/issues"));
    expect(response.status).toBe(401);
  });

  it("GET returns the issue list for an authenticated user", async () => {
    const issues = [{ id: "i1", title: "Issue One", status: "draft" }];
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("issues", { data: issues, error: null }).build()
    );
    const { GET } = await import("@/app/api/issues/route");

    const response = await GET(new Request("http://test/api/issues"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.issues).toEqual(issues);
  });

  it("POST returns 403 when the caller isn't a member of the target publication", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: null, error: null })
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ publicationId: "11111111-1111-1111-1111-111111111111", title: "New Issue" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST returns 422 for a missing title", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(testUser).build());
    const { POST } = await import("@/app/api/issues/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ publicationId: "11111111-1111-1111-1111-111111111111" }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("POST creates an issue plus its starting section for a publication member", async () => {
    const issue = { id: "new-issue", title: "New Issue", slug: "new-issue-abc123" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: { role: "writer" }, error: null })
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("issues", { data: issue, error: null })
        .from("sections", { data: null, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ publicationId: "11111111-1111-1111-1111-111111111111", title: "New Issue" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.issue).toEqual(issue);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("GET/POST /api/wisdom-entries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/wisdom-entries/route");

    const response = await GET(new Request("http://test/api/wisdom-entries"));
    expect(response.status).toBe(401);
  });

  it("GET returns entries filtered by review status", async () => {
    const entries = [
      { id: "w1", title: "On detachment", source_type: "gita_verse", review_status: "approved" },
    ];
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("wisdom_entries", { data: entries, error: null }).build()
    );
    const { GET } = await import("@/app/api/wisdom-entries/route");

    const response = await GET(new Request("http://test/api/wisdom-entries?reviewStatus=approved"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries).toEqual(entries);
  });

  it("POST returns 403 for a subscriber (not editorial staff)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ title: "X", sourceType: "gita_verse", translation: "Y" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST returns 422 when translation is missing", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ title: "X", sourceType: "gita_verse" }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("POST returns 422 for a gita_verse missing its required chapter/verse source fields", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ title: "X", sourceType: "gita_verse", translation: "Y", sourceFields: {} }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("POST creates an entry with source_type 'other' (no source-field sub-table needed) and returns 201", async () => {
    const entry = { id: "w2" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("wisdom_entries", { data: entry, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ title: "A general reflection", sourceType: "other", translation: "Y" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.entry).toEqual(entry);
  });
});

describe("POST /api/wisdom-entries/[id]/approve", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "w1" });

  it("returns 403 for a writer attempting to approve (approval is editor-and-above only)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/approve/route");

    const response = await POST(new Request("http://test", { method: "POST" }), { params });
    expect(response.status).toBe(403);
  });

  it("approves and stamps reviewed_by/reviewed_at for an editor", async () => {
    const approved = { id: "w1", review_status: "approved" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("wisdom_entries", { data: approved, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/approve/route");

    const response = await POST(new Request("http://test", { method: "POST" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entry).toEqual(approved);
  });
});

describe("POST /api/wisdom-entries/[id]/submit-review", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "w1" });

  it("returns 403 when the caller isn't the entry's own author", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("wisdom_entries", { data: null, error: { message: "no rows" } })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/submit-review/route");

    const response = await POST(new Request("http://test", { method: "POST" }), { params });
    expect(response.status).toBe(403);
  });

  it("submits successfully for the entry's own author", async () => {
    const updated = { id: "w1", review_status: "in_review" };
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("wisdom_entries", { data: updated, error: null }).build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/submit-review/route");

    const response = await POST(new Request("http://test", { method: "POST" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entry).toEqual(updated);
  });
});

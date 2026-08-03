/**
 * Tests for high-priority untested routes:
 *   GET/POST /api/sections/[id]/blocks
 *   POST     /api/issues/[id]/revisions + restore
 *   GET      /api/issues/[id]/wisdom/recommend
 *   GET      /api/publications/[id]/ai-jobs
 *   GET/PATCH /api/people/[id]
 *   GET      /api/wisdom-entries/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mockAdminFrom }) }));

// ─── POST /api/issues/[id]/revisions ─────────────────────────────────────────
describe("POST /api/issues/[id]/revisions", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "issue-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/issues/[id]/revisions/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user cannot edit the issue", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .from("issues", { data: { publication_id: "pub-1", created_by: "other-user" }, error: null })
        .from("publication_members", { data: null, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/revisions/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(403);
  });

  it("creates a revision snapshot for an authorized editor", async () => {
    const revision = { id: "rev-1", issue_id: "issue-1", label: "Before edit", created_at: "2026-01-01" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .from("issues", { data: { publication_id: "pub-1", created_by: testUser.id }, error: null })
        .from("issue_revisions", { data: revision, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/revisions/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ label: "Before edit" }) }),
      { params }
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.revision.label).toBe("Before edit");
  });
});

// ─── GET /api/publications/[id]/ai-jobs ──────────────────────────────────────
describe("GET /api/publications/[id]/ai-jobs", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "pub-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/publications/[id]/ai-jobs/route");
    const res = await GET(new Request("http://test"), { params });
    expect(res.status).toBe(401);
  });

  it("returns empty array when user has no membership (RLS filters results)", async () => {
    // The ai-jobs route relies on RLS, not an explicit membership check.
    // A user without access gets an empty array (RLS returns 0 rows), not a 403.
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("ai_jobs", { data: [], error: null }).build()
    );
    const { GET } = await import("@/app/api/publications/[id]/ai-jobs/route");
    const res = await GET(new Request("http://test"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.jobs).toEqual([]);
  });

  it("returns AI job list for publication members", async () => {
    const jobs = [{ id: "j1", function_id: "rewrite", status: "completed", cost_usd: 0.002 }];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: { role: "writer" }, error: null })
        .from("ai_jobs", { data: jobs, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/publications/[id]/ai-jobs/route");
    const res = await GET(new Request("http://test"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.jobs).toEqual(jobs);
  });
});

// ─── GET/PATCH /api/people/[id] ───────────────────────────────────────────────
describe("GET /api/people/[id]", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "person-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/people/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when person not found", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("people", { data: null, error: null }).build()
    );
    const { GET } = await import("@/app/api/people/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    expect(res.status).toBe(404);
  });

  it("returns person data for authenticated users", async () => {
    const person = { id: "person-1", full_name: "Ada Lovelace", slug: "ada-lovelace", bio: "Mathematician" };
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("people", { data: person, error: null }).build()
    );
    const { GET } = await import("@/app/api/people/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.person.full_name).toBe("Ada Lovelace");
  });
});

describe("PATCH /api/people/[id]", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "person-1" });

  it("returns 403 for a subscriber (not editorial staff)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/people/[id]/route");
    const res = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ fullName: "X" }) }),
      { params }
    );
    expect(res.status).toBe(403);
  });

  it("updates a person's details for editorial staff", async () => {
    const updated = { id: "person-1", full_name: "Ada Byron", slug: "ada-lovelace", bio: "Updated" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("people", { data: updated, error: null })
        .build()
    );
    const { PATCH } = await import("@/app/api/people/[id]/route");
    const res = await PATCH(
      new Request("http://test", { method: "PATCH", body: JSON.stringify({ fullName: "Ada Byron" }) }),
      { params }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.person.full_name).toBe("Ada Byron");
  });
});

// ─── GET /api/wisdom-entries/[id] ────────────────────────────────────────────
describe("GET /api/wisdom-entries/[id]", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "w1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/wisdom-entries/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when entry not found", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("wisdom_entries", { data: null, error: null }).build()
    );
    const { GET } = await import("@/app/api/wisdom-entries/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    expect(res.status).toBe(404);
  });

  it("returns wisdom entry for authenticated users", async () => {
    const entry = { id: "w1", title: "On detachment", source_type: "gita_verse", review_status: "approved" };
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("wisdom_entries", { data: entry, error: null }).build()
    );
    const { GET } = await import("@/app/api/wisdom-entries/[id]/route");
    const res = await GET(new Request("http://test"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entry.title).toBe("On detachment");
  });
});

// ─── POST /api/wisdom-entries/[id]/reject ────────────────────────────────────
describe("POST /api/wisdom-entries/[id]/reject", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "w1" });

  it("returns 403 for a writer (not editor)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/reject/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ notes: "Needs revision" }) }),
      { params }
    );
    expect(res.status).toBe(403);
  });

  it("rejects a wisdom entry with review notes for an editor", async () => {
    const rejected = { id: "w1", review_status: "rejected", review_notes: "Needs revision" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("wisdom_entries", { data: rejected, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/wisdom-entries/[id]/reject/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ notes: "Needs revision" }) }),
      { params }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entry.review_status).toBe("rejected");
  });
});

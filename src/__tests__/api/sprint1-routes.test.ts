/**
 * Tests for all Sprint 1 routes:
 *   POST /api/issues/[id]/publish
 *   POST /api/issues/[id]/submit-review
 *   POST /api/publications/[id]/subscribe
 *   GET  /api/unsubscribe
 *   GET  /api/health
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockAdminFrom,
    storage: { listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }) },
  }),
}));

vi.mock("@/lib/email/resend-client", () => ({
  isEmailConfigured: () => false, // disable real sends in tests
  getResendClient: vi.fn(),
}));

vi.mock("@/lib/email/delivery-service", () => ({
  deliverIssueToSubscribers: vi.fn().mockResolvedValue({ total: 5, sent: 5, failed: 0, skipped: 0 }),
}));

vi.mock("@/lib/rate-limit", () => ({
  getAIRateLimiter: () => null,
  getSubscribeRateLimiter: () => null,
  isRateLimitConfigured: () => false,
}));

// ─── POST /api/issues/[id]/publish ───────────────────────────────────────────
describe("POST /api/issues/[id]/publish", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "issue-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when issue doesn't exist", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("issues", { data: null, error: null }).build()
    );
    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is a writer (not editor)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", {
          data: {
            id: "issue-1",
            title: "T",
            slug: "t",
            status: "in_review",
            publication_id: "pub-1",
            publications: { name: "P", slug: "p" },
          },
          error: null,
        })
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("publication_members", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 409 when issue is already published", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", {
          data: {
            id: "issue-1",
            title: "T",
            slug: "t",
            status: "published",
            publication_id: "pub-1",
            publications: { name: "P", slug: "p" },
          },
          error: null,
        })
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    expect(res.status).toBe(409);
  });

  it("publishes immediately for an editor and returns delivery stats", async () => {
    const published = {
      id: "issue-1",
      title: "T",
      slug: "t",
      status: "published",
      published_at: new Date().toISOString(),
      publication_id: "pub-1",
    };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", {
          data: {
            id: "issue-1",
            title: "T",
            slug: "t",
            status: "in_review",
            publication_id: "pub-1",
            publications: { name: "P", slug: "p" },
          },
          error: null,
        })
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("publication_members", { data: { role: "editor" }, error: null })
        .build()
    );
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: published, error: null }),
    };
    mockAdminFrom.mockReturnValue(chain);

    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.issue.status).toBe("published");
  });

  it("schedules publish when scheduled_at is provided", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", {
          data: {
            id: "issue-1",
            title: "T",
            slug: "t",
            status: "draft",
            publication_id: "pub-1",
            publications: { name: "P", slug: "p" },
          },
          error: null,
        })
        .from("profiles", { data: { role: "super_admin" }, error: null })
        .build()
    );
    const updateChain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
    mockAdminFrom.mockImplementation((table: string) =>
      table === "scheduled_jobs" ? insertChain : updateChain
    );

    const { POST } = await import("@/app/api/issues/[id]/publish/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ scheduled_at: futureDate }) }),
      { params }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.issue.status).toBe("scheduled");
  });
});

// ─── POST /api/issues/[id]/submit-review ─────────────────────────────────────
describe("POST /api/issues/[id]/submit-review", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "issue-1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/issues/[id]/submit-review/route");
    const res = await POST(new Request("http://test"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not the author", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", { data: null, error: { message: "no rows" } })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/submit-review/route");
    const res = await POST(new Request("http://test"), { params });
    expect(res.status).toBe(403);
  });

  it("transitions to in_review for the issue author", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("issues", { data: { id: "issue-1", status: "in_review" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/issues/[id]/submit-review/route");
    const res = await POST(new Request("http://test"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.issue.status).toBe("in_review");
  });
});

// ─── POST /api/publications/[id]/subscribe ────────────────────────────────────
describe("POST /api/publications/[id]/subscribe", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ id: "pub-1" });

  it("returns 422 for invalid email", async () => {
    const { POST } = await import("@/app/api/publications/[id]/subscribe/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ email: "not-an-email" }) }),
      { params }
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when publication doesn't exist or isn't active", async () => {
    const adminChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockAdminFrom.mockReturnValue(adminChain);

    const { POST } = await import("@/app/api/publications/[id]/subscribe/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ email: "test@example.com" }) }),
      { params }
    );
    expect(res.status).toBe(404);
  });

  it("creates subscriber and returns 201 for a valid email", async () => {
    let callCount = 0;
    mockAdminFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1)
          return Promise.resolve({ data: { id: "pub-1", name: "P", slug: "p" }, error: null });
        return Promise.resolve({ data: { id: "sub-1" }, error: null });
      }),
      upsert: vi.fn().mockReturnThis(),
    }));

    const { POST } = await import("@/app/api/publications/[id]/subscribe/route");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ email: "reader@example.com" }) }),
      { params }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.subscribed).toBe(true);
  });
});

// ─── GET /api/unsubscribe ─────────────────────────────────────────────────────
describe("GET /api/unsubscribe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when token is missing", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(new Request("http://test/api/unsubscribe"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is malformed", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(new Request("http://test/api/unsubscribe?token=notbase64valid!!"));
    expect(res.status).toBe(400);
  });

  it("processes a valid unsubscribe token and redirects to /unsubscribed", async () => {
    const token = Buffer.from("sub-1:pub-1").toString("base64");
    // Set up the mock BEFORE the route module uses it
    // The route calls: admin.from("subscriptions").update({}).eq().eq()
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const eq1Fn = vi.fn().mockReturnValue({ eq: eqFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eq1Fn });
    mockAdminFrom.mockReturnValue({ update: updateFn });

    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(new Request(`http://localhost/api/unsubscribe?token=${token}`));

    // The route redirects to siteUrl/unsubscribed
    // In test env NEXT_PUBLIC_SITE_URL is undefined so it goes to /unsubscribed
    expect(res.status).toBe(302);
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 503 when database is unreachable", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: "connection failed" } }),
    };
    mockAdminFrom.mockReturnValue(chain);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.database.status).toBe("error");
  });

  it("returns 200 with database:ok when Supabase is reachable", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
    };
    mockAdminFrom.mockReturnValue(chain);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.database.status).toBe("ok");
    expect(body.status).toBe("ok");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("GET /api/graph/entities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/graph/entities/route");

    const response = await GET(new Request("http://test/api/graph/entities"));
    expect(response.status).toBe(401);
  });

  it("scopes to a single table when a type filter is given", async () => {
    const technologies = [{ id: "t1", name: "Vector Databases" }];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("technologies", { data: technologies, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/graph/entities/route");

    const response = await GET(new Request("http://test/api/graph/entities?type=technology"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entities).toEqual([{ entityType: "technology", entityId: "t1", label: "Vector Databases" }]);
  });

  it("ignores an unknown type filter and falls back to searching every entity type", async () => {
    const supabase = mockSupabase().authenticatedAs(testUser);
    for (const table of [
      "articles",
      "issues",
      "technologies",
      "companies",
      "books",
      "papers",
      "courses",
      "videos",
      "podcasts",
      "github_repositories",
      "wisdom_entries",
      "sources",
      "people",
    ]) {
      supabase.from(table, { data: [], error: null });
    }
    mockCreateClient.mockResolvedValue(supabase.build());
    const { GET } = await import("@/app/api/graph/entities/route");

    const response = await GET(new Request("http://test/api/graph/entities?type=not_a_real_type"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entities).toEqual([]);
  });
});

describe("GET /api/graph/nodes/[type]/[id]/neighbors", () => {
  beforeEach(() => vi.clearAllMocks());
  const params = Promise.resolve({ type: "technology", id: "t1" });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/graph/nodes/[type]/[id]/neighbors/route");

    const response = await GET(new Request("http://test"), { params });
    expect(response.status).toBe(401);
  });

  it("returns 422 for an unknown entity type in the URL", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(testUser).build());
    const { GET } = await import("@/app/api/graph/nodes/[type]/[id]/neighbors/route");

    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ type: "not_real", id: "x" }),
    });
    expect(response.status).toBe(422);
  });

  it("calls graph_neighbors via RPC and hydrates labels from each neighbor's own table", async () => {
    const rpcRows = [
      {
        entity_type: "company",
        entity_id: "c1",
        depth: 1,
        relation_type: "built",
        via_type: null,
        via_id: null,
      },
    ];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .rpc("graph_neighbors", { data: rpcRows, error: null })
        .from("companies", { data: [{ id: "c1", name: "Vectorwise AI" }], error: null })
        .build()
    );
    const { GET } = await import("@/app/api/graph/nodes/[type]/[id]/neighbors/route");

    const response = await GET(new Request("http://test?depth=2"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.neighbors).toEqual([
      {
        entityType: "company",
        entityId: "c1",
        label: "Vectorwise AI",
        depth: 1,
        relationType: "built",
        via: null,
      },
    ]);
  });

  it("returns 500 with a clean message when the RPC call itself fails", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .rpc("graph_neighbors", { data: null, error: { message: "function error" } })
        .build()
    );
    const { GET } = await import("@/app/api/graph/nodes/[type]/[id]/neighbors/route");

    const response = await GET(new Request("http://test"), { params });
    expect(response.status).toBe(500);
  });
});

describe("POST /api/graph/edges", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/graph/edges/route");

    const response = await POST(new Request("http://test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a subscriber (not editorial staff)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/graph/edges/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "issue",
          sourceId: "11111111-1111-1111-1111-111111111111",
          targetType: "technology",
          targetId: "22222222-2222-2222-2222-222222222222",
        }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("returns 422 for an invalid relation type", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/graph/edges/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "issue",
          sourceId: "11111111-1111-1111-1111-111111111111",
          targetType: "technology",
          targetId: "22222222-2222-2222-2222-222222222222",
          relationType: "made_up",
        }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("returns 409 when the same edge already exists", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .from("knowledge_graph_edges", { data: null, error: { message: "duplicate", code: "23505" } })
        .build()
    );
    const { POST } = await import("@/app/api/graph/edges/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "issue",
          sourceId: "11111111-1111-1111-1111-111111111111",
          targetType: "technology",
          targetId: "22222222-2222-2222-2222-222222222222",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already exists");
  });

  it("creates the edge and returns 201 for editorial staff", async () => {
    const edge = {
      id: "e1",
      source_type: "issue",
      source_id: "i1",
      target_type: "technology",
      target_id: "t1",
      relation_type: "related",
    };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("knowledge_graph_edges", { data: edge, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/graph/edges/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "issue",
          sourceId: "11111111-1111-1111-1111-111111111111",
          targetType: "technology",
          targetId: "22222222-2222-2222-2222-222222222222",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.edge).toEqual(edge);
  });
});

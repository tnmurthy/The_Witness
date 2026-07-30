import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("GET/POST /api/publications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/publications/route");

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("GET returns every publication the caller belongs to", async () => {
    const publications = [{ id: "p1", name: "The Witness", slug: "the-witness" }];
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publications", { data: publications, error: null })
        .build()
    );
    const { GET } = await import("@/app/api/publications/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.publications).toEqual(publications);
  });

  it("POST returns 403 for a role that cannot create publications (e.g. writer)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/publications/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ name: "New Pub" }) })
    );
    expect(response.status).toBe(403);
  });

  it("POST creates a publication and its creator's editor_in_chief membership for an authorized role", async () => {
    const publication = { id: "p2", name: "New Pub", slug: "new-pub" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor_in_chief" }, error: null })
        .from("publications", { data: publication, error: null })
        .from("publication_members", { data: null, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/publications/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ name: "New Pub", slug: "new-pub" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.publication).toEqual(publication);
  });
});

describe("GET/POST /api/people", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { GET } = await import("@/app/api/people/route");

    const response = await GET(new Request("http://test/api/people"));
    expect(response.status).toBe(401);
  });

  it("GET returns the people list", async () => {
    const people = [
      { id: "pe1", full_name: "Ada Lovelace", slug: "ada-lovelace", bio: null, avatar_url: null },
    ];
    mockCreateClient.mockResolvedValue(
      mockSupabase().authenticatedAs(testUser).from("people", { data: people, error: null }).build()
    );
    const { GET } = await import("@/app/api/people/route");

    const response = await GET(new Request("http://test/api/people"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.people).toEqual(people);
  });

  it("POST returns 403 for a subscriber (not editorial staff)", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "subscriber" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/people/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ fullName: "X" }) })
    );
    expect(response.status).toBe(403);
  });

  it("POST returns 422 for a missing full name", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "editor" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/people/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ fullName: "" }) })
    );
    expect(response.status).toBe(422);
  });

  it("POST creates a person for editorial staff and returns 201", async () => {
    const person = { id: "pe2", full_name: "Grace Hopper" };
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("profiles", { data: { role: "writer" }, error: null })
        .from("people", { data: person, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/people/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ fullName: "Grace Hopper" }) })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.person).toEqual(person);
  });
});

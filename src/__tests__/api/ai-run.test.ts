import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase, testUser } from "@/lib/testing/mock-supabase";
import { AIProviderError } from "@/lib/ai/types";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockRunAIFunction = vi.fn();
vi.mock("@/lib/ai/orchestrator", () => ({
  runAIFunction: (...args: unknown[]) => mockRunAIFunction(...args),
}));

const mockGetDefaultProviderId = vi.fn();
vi.mock("@/lib/ai/registry", () => ({
  isProviderConfigured: vi.fn(() => false),
  getDefaultProviderId: () => mockGetDefaultProviderId(),
}));

const validBody = {
  functionId: "rewrite",
  publicationId: "11111111-1111-1111-1111-111111111111",
  input: { text: "hello" },
};

describe("POST /api/ai/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultProviderId.mockReturnValue("anthropic");
  });

  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(null).build());
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(new Request("http://test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("returns 422 for a malformed request body (bad publicationId)", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(testUser).build());
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ functionId: "rewrite", publicationId: "not-a-uuid" }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("returns 422 for generate_issue — it has its own dedicated route", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(testUser).build());
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ ...validBody, functionId: "generate_issue" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toContain("issues/:id/ai/generate");
  });

  it("returns 422 for an unknown function id", async () => {
    mockCreateClient.mockResolvedValue(mockSupabase().authenticatedAs(testUser).build());
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ ...validBody, functionId: "not_a_real_function" }),
      })
    );
    expect(response.status).toBe(422);
  });

  it("returns 403 when the caller isn't a member of the target publication", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: null, error: null })
        .from("profiles", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(response.status).toBe(403);
  });

  it("returns 503 when no AI provider is configured", async () => {
    mockGetDefaultProviderId.mockReturnValue(null);
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: { role: "writer" }, error: null })
        .build()
    );
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify(validBody) })
    );
    expect(response.status).toBe(503);
  });

  it("returns 502 when the orchestrator throws a retryable AIProviderError", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: { role: "writer" }, error: null })
        .build()
    );
    mockRunAIFunction.mockRejectedValue(
      new AIProviderError("rate limited", { providerId: "anthropic", retryable: true })
    );
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify(validBody) })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.retryable).toBe(true);
  });

  it("dispatches to the orchestrator and returns its result for a valid, authorized request", async () => {
    mockCreateClient.mockResolvedValue(
      mockSupabase()
        .authenticatedAs(testUser)
        .from("publication_members", { data: { role: "writer" }, error: null })
        .build()
    );
    mockRunAIFunction.mockResolvedValue({
      jobId: "job-1",
      output: "Rewritten text.",
      tokenUsage: { input: 10, output: 5 },
      costUsd: 0.001,
    });
    const { POST } = await import("@/app/api/ai/run/route");

    const response = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify(validBody) })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.output).toBe("Rewritten text.");
    expect(mockRunAIFunction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ functionId: "rewrite", actorId: testUser.id })
    );
  });

  it("GET lists every registered AI function's id, label, and description", async () => {
    const { GET } = await import("@/app/api/ai/run/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.functions.length).toBeGreaterThanOrEqual(13);
    expect(body.functions.every((f: { id: string; label: string }) => f.id && f.label)).toBe(true);
  });
});

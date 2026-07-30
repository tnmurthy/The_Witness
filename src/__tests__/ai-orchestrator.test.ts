import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase } from "@/lib/testing/mock-supabase";
import { AIProviderError } from "@/lib/ai/types";

const mockGetProvider = vi.fn();
const mockGetDefaultProviderId = vi.fn();
vi.mock("@/lib/ai/registry", () => ({
  getProvider: (id: string) => mockGetProvider(id),
  getDefaultProviderId: () => mockGetDefaultProviderId(),
  DEFAULT_MODEL_BY_PROVIDER: { openai: "gpt-4o", anthropic: "claude-sonnet-4-5" },
}));

describe("runAIFunction (the AI orchestrator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultProviderId.mockReturnValue("anthropic");
  });

  it("throws for an unknown function id", async () => {
    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase().build();

    await expect(
      runAIFunction(supabase as never, {
        functionId: "not_a_real_function" as never,
        input: {},
        publicationId: "p1",
        actorId: "u1",
      })
    ).rejects.toThrow("Unknown AI function");
  });

  it("throws when the input fails the function's own schema validation, before any provider call or ai_jobs write", async () => {
    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase().build();

    await expect(
      runAIFunction(supabase as never, {
        functionId: "rewrite",
        input: {},
        publicationId: "p1",
        actorId: "u1",
      })
    ).rejects.toThrow();
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it("throws when no AI provider is configured", async () => {
    mockGetDefaultProviderId.mockReturnValue(null);
    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase().build();

    await expect(
      runAIFunction(supabase as never, {
        functionId: "rewrite",
        input: { text: "hi" },
        publicationId: "p1",
        actorId: "u1",
      })
    ).rejects.toThrow("No AI provider is configured");
  });

  it("throws when the initial ai_jobs insert fails — never reaches the provider", async () => {
    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase()
      .from("ai_jobs", { data: null, error: { message: "insert failed" } })
      .build();

    await expect(
      runAIFunction(supabase as never, {
        functionId: "rewrite",
        input: { text: "hi" },
        publicationId: "p1",
        actorId: "u1",
      })
    ).rejects.toThrow("Failed to start AI job");
    expect(mockGetProvider).not.toHaveBeenCalled();
  });

  it("creates an ai_jobs row, calls the provider, updates the row to completed, and returns the parsed output", async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: "Rewritten text.",
      tokenUsage: { input: 20, output: 10 },
      costUsd: 0.0015,
      modelUsed: "claude-sonnet-4-5",
    });
    mockGetProvider.mockReturnValue({ id: "anthropic", generateText });

    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase()
      .from("ai_jobs", { data: { id: "job-1" }, error: null })
      .from("ai_jobs", { data: null, error: null })
      .build();

    const result = await runAIFunction(supabase as never, {
      functionId: "rewrite",
      input: { text: "hello" },
      publicationId: "p1",
      actorId: "u1",
    });

    expect(result.jobId).toBe("job-1");
    expect(result.output).toBe("Rewritten text.");
    expect(result.costUsd).toBe(0.0015);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-5", prompt: expect.stringContaining("hello") })
    );
  });

  it("marks the ai_jobs row failed and re-throws when the provider call itself fails", async () => {
    const generateText = vi
      .fn()
      .mockRejectedValue(new AIProviderError("rate limited", { providerId: "anthropic", retryable: true }));
    mockGetProvider.mockReturnValue({ id: "anthropic", generateText });

    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase()
      .from("ai_jobs", { data: { id: "job-2" }, error: null })
      .from("ai_jobs", { data: null, error: null })
      .build();

    await expect(
      runAIFunction(supabase as never, {
        functionId: "rewrite",
        input: { text: "hello" },
        publicationId: "p1",
        actorId: "u1",
      })
    ).rejects.toThrow("rate limited");
  });

  it("respects an explicit providerId override instead of the default", async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: "x",
      tokenUsage: { input: 1, output: 1 },
      costUsd: 0.0001,
      modelUsed: "gpt-4o",
    });
    mockGetProvider.mockReturnValue({ id: "openai", generateText });

    const { runAIFunction } = await import("@/lib/ai/orchestrator");
    const supabase = mockSupabase()
      .from("ai_jobs", { data: { id: "job-3" }, error: null })
      .from("ai_jobs", { data: null, error: null })
      .build();

    await runAIFunction(supabase as never, {
      functionId: "rewrite",
      input: { text: "hello" },
      publicationId: "p1",
      actorId: "u1",
      providerId: "openai",
    });

    expect(mockGetProvider).toHaveBeenCalledWith("openai");
    expect(mockGetDefaultProviderId).not.toHaveBeenCalled();
  });
});

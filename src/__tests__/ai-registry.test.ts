import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/ai/providers/openai", () => ({
  createOpenAIProvider: vi.fn(() => ({ id: "openai", generateText: vi.fn() })),
}));
vi.mock("@/lib/ai/providers/anthropic", () => ({
  createAnthropicProvider: vi.fn(() => ({ id: "anthropic", generateText: vi.fn() })),
}));

describe("AI provider registry", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("isProviderConfigured is false for both providers when no keys are set", async () => {
    const { isProviderConfigured } = await import("@/lib/ai/registry");
    expect(isProviderConfigured("openai")).toBe(false);
    expect(isProviderConfigured("anthropic")).toBe(false);
  });

  it("isProviderConfigured is true once the corresponding env var is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { isProviderConfigured } = await import("@/lib/ai/registry");
    expect(isProviderConfigured("anthropic")).toBe(true);
    expect(isProviderConfigured("openai")).toBe(false);
  });

  it("getDefaultProviderId returns null when neither provider is configured", async () => {
    const { getDefaultProviderId } = await import("@/lib/ai/registry");
    expect(getDefaultProviderId()).toBeNull();
  });

  it("getDefaultProviderId prefers anthropic when both are configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    process.env.ANTHROPIC_API_KEY = "sk-test-anthropic";
    const { getDefaultProviderId } = await import("@/lib/ai/registry");
    expect(getDefaultProviderId()).toBe("anthropic");
  });

  it("getDefaultProviderId falls back to openai when only openai is configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    const { getDefaultProviderId } = await import("@/lib/ai/registry");
    expect(getDefaultProviderId()).toBe("openai");
  });

  it("getProvider throws a specific, actionable error naming the missing env var", async () => {
    const { getProvider } = await import("@/lib/ai/registry");
    expect(() => getProvider("openai")).toThrow("OPENAI_API_KEY is not set");
    expect(() => getProvider("anthropic")).toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("getProvider returns a working provider once its key is configured, and caches it", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { getProvider } = await import("@/lib/ai/registry");
    const { createAnthropicProvider } = await import("@/lib/ai/providers/anthropic");

    const first = getProvider("anthropic");
    const second = getProvider("anthropic");

    expect(first).toBe(second);
    expect(createAnthropicProvider).toHaveBeenCalledTimes(1);
  });

  it("DEFAULT_MODEL_BY_PROVIDER has an entry for both providers", async () => {
    const { DEFAULT_MODEL_BY_PROVIDER } = await import("@/lib/ai/registry");
    expect(DEFAULT_MODEL_BY_PROVIDER.openai).toBeTruthy();
    expect(DEFAULT_MODEL_BY_PROVIDER.anthropic).toBeTruthy();
  });
});

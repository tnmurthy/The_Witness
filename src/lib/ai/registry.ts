import "server-only";
import type { AIProvider, AIProviderId } from "./types";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProviderId, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5",
};

const cache = new Map<AIProviderId, AIProvider>();

/**
 * Lazily constructs and caches one provider instance per process — the
 * underlying SDK clients are stateless and safe to reuse across
 * requests, and constructing a new OpenAI/Anthropic client per call
 * would be wasted work. `server-only` (Milestone 2's admin client
 * established the same pattern) makes it a build error to import this
 * from a Client Component, since it reads API keys from the environment.
 *
 * Throws a clear, specific error — not a generic "undefined is not a
 * function" three layers deep — when the requested provider's API key
 * isn't configured, since "which env var is missing" is exactly what a
 * developer needs to know in that moment, both locally and in
 * production logs.
 */
export function getProvider(id: AIProviderId): AIProvider {
  const cached = cache.get(id);
  if (cached) return cached;

  const apiKey = id === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      `${id === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is not set. AI Workspace functions require at least one provider's API key — see .env.example.`
    );
  }

  const provider = id === "openai" ? createOpenAIProvider(apiKey) : createAnthropicProvider(apiKey);
  cache.set(id, provider);
  return provider;
}

/** True if the given provider has a usable API key configured — used by the API layer to return a clean, actionable error instead of letting getProvider's throw surface as a raw 500. */
export function isProviderConfigured(id: AIProviderId): boolean {
  return !!(id === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
}

/** The first provider with a configured API key, preferring Anthropic — used when a publication/platform hasn't explicitly chosen a default (Milestone 4's settings table reserves the actual per-publication override, not yet wired to a UI in this milestone; see docs/AI_WORKSPACE.md). */
export function getDefaultProviderId(): AIProviderId | null {
  if (isProviderConfigured("anthropic")) return "anthropic";
  if (isProviderConfigured("openai")) return "openai";
  return null;
}

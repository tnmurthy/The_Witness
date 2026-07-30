/**
 * AI provider abstraction (Milestone 6).
 *
 * Every AI Workspace function (src/lib/ai/functions/*) calls a provider
 * exclusively through this interface — never `openai` or
 * `@anthropic-ai/sdk` directly. This is what the Solution Architecture
 * design document's AI integration pattern ("model choice is a
 * configuration decision, not a code change") actually means in code:
 * adding a third provider (e.g. a future in-house or open-weight model)
 * means writing one new file that implements AIProvider and registering
 * it in registry.ts — nothing in src/lib/ai/functions or any API route
 * changes.
 */

export interface GenerateTextParams {
  /** System-level instruction — role, tone, constraints. Kept separate from `prompt` because providers treat it differently (OpenAI: a system message; Anthropic: a top-level `system` param), and merging them would lose that distinction for no benefit. */
  system?: string;
  /** The actual user-facing request content. */
  prompt: string;
  /** Provider-specific model identifier, e.g. "gpt-4o" or "claude-sonnet-4-5". Model selection is the caller's (orchestrator's) responsibility, informed by publication/platform settings, not this abstraction's. */
  model: string;
  maxTokens?: number;
  temperature?: number;
  /** Hard wall-clock timeout in milliseconds. See src/lib/ai/retry.ts for why this exists at the abstraction level rather than left to each provider's SDK default. */
  timeoutMs?: number;
}

export interface GenerateTextResult {
  text: string;
  tokenUsage: { input: number; output: number };
  /** Estimated cost in USD, computed from the provider's published per-token pricing (src/lib/ai/pricing.ts) — an estimate, not a value the provider API itself returns, since neither OpenAI nor Anthropic's chat completion responses include a dollar figure. */
  costUsd: number;
  /** The provider's own identifier for this specific model, as actually used — useful when `model` was an alias the provider resolved to a dated snapshot. */
  modelUsed: string;
}

export type AIProviderId = "openai" | "anthropic";

export interface AIProvider {
  readonly id: AIProviderId;
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
}

/**
 * Raised by a provider implementation for any failure — auth, rate
 * limit, timeout, malformed response — so calling code (the
 * orchestrator) can handle "the AI call failed" uniformly regardless of
 * which provider or which of its many possible SDK-specific error types
 * was responsible. `retryable` drives src/lib/ai/retry.ts's
 * backoff-and-retry decision; a 401 (bad API key) is not retryable, a
 * 429 (rate limited) or a network timeout is.
 */
export class AIProviderError extends Error {
  readonly providerId: AIProviderId;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(message: string, options: { providerId: AIProviderId; retryable: boolean; cause?: unknown }) {
    super(message);
    this.name = "AIProviderError";
    this.providerId = options.providerId;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}

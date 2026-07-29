import { AIProviderError } from "./types";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

/**
 * Wraps a provider call with timeout enforcement and exponential-backoff
 * retry — used by both provider implementations (openai.ts,
 * anthropic.ts) rather than each reimplementing it, so "how a transient
 * failure is handled" is one policy, not two slightly-different ones.
 *
 * Only retries when the thrown error is an AIProviderError with
 * retryable: true (rate limits, timeouts, 5xx) — an auth failure or a
 * malformed-request 400 retrying three times just wastes 3x the latency
 * before failing the same way a first attempt would have.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      const retryable = error instanceof AIProviderError ? error.retryable : false;
      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

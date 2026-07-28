import OpenAI from "openai";
import type { AIProvider, GenerateTextParams, GenerateTextResult } from "../types";
import { AIProviderError } from "../types";
import { estimateCostUsd } from "../pricing";
import { withRetry } from "../retry";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Determines retryability from an OpenAI SDK error without a hard
 * dependency on its exact error class shape across SDK versions —
 * checked by HTTP status, which is stable API surface, rather than
 * `instanceof OpenAI.APIError` subclasses that have changed across major
 * SDK versions historically.
 */
function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true; // network error / no response at all — worth a retry
  return status === 429 || status >= 500;
}

export function createOpenAIProvider(apiKey: string): AIProvider {
  const client = new OpenAI({ apiKey });

  return {
    id: "openai",

    async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
      const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      return withRetry(async (signal) => {
        try {
          const response = await client.chat.completions.create(
            {
              model: params.model,
              messages: [
                ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
                { role: "user" as const, content: params.prompt },
              ],
              max_tokens: params.maxTokens ?? 2000,
              temperature: params.temperature ?? 0.7,
            },
            { signal }
          );

          const text = response.choices[0]?.message?.content;
          if (!text) {
            throw new AIProviderError("OpenAI returned an empty response", { providerId: "openai", retryable: true });
          }

          const inputTokens = response.usage?.prompt_tokens ?? 0;
          const outputTokens = response.usage?.completion_tokens ?? 0;

          return {
            text,
            tokenUsage: { input: inputTokens, output: outputTokens },
            costUsd: estimateCostUsd(params.model, inputTokens, outputTokens),
            modelUsed: response.model,
          };
        } catch (error) {
          if (error instanceof AIProviderError) throw error;

          if (error instanceof OpenAI.APIError) {
            throw new AIProviderError(`OpenAI API error: ${error.message}`, {
              providerId: "openai",
              retryable: isRetryableStatus(error.status),
              cause: error,
            });
          }

          throw new AIProviderError("OpenAI request failed", { providerId: "openai", retryable: true, cause: error });
        }
      }, timeoutMs);
    },
  };
}

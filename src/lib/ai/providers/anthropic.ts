import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateTextParams, GenerateTextResult } from "../types";
import { AIProviderError } from "../types";
import { estimateCostUsd } from "../pricing";
import { withRetry } from "../retry";

const DEFAULT_TIMEOUT_MS = 30_000;

function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  return status === 429 || status >= 500;
}

export function createAnthropicProvider(apiKey: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    id: "anthropic",

    async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
      const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      return withRetry(async (signal) => {
        try {
          const response = await client.messages.create(
            {
              model: params.model,
              system: params.system,
              messages: [{ role: "user", content: params.prompt }],
              max_tokens: params.maxTokens ?? 2000,
              temperature: params.temperature ?? 0.7,
            },
            { signal }
          );

          const textBlock = response.content.find((block) => block.type === "text");
          if (!textBlock || textBlock.type !== "text") {
            throw new AIProviderError("Anthropic returned no text content", { providerId: "anthropic", retryable: true });
          }

          return {
            text: textBlock.text,
            tokenUsage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
            costUsd: estimateCostUsd(params.model, response.usage.input_tokens, response.usage.output_tokens),
            modelUsed: response.model,
          };
        } catch (error) {
          if (error instanceof AIProviderError) throw error;

          if (error instanceof Anthropic.APIError) {
            throw new AIProviderError(`Anthropic API error: ${error.message}`, {
              providerId: "anthropic",
              retryable: isRetryableStatus(error.status),
              cause: error,
            });
          }

          throw new AIProviderError("Anthropic request failed", { providerId: "anthropic", retryable: true, cause: error });
        }
      }, timeoutMs);
    },
  };
}

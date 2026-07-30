/**
 * Per-million-token USD pricing, used to estimate ai_jobs.cost_usd since
 * neither provider's API response includes a dollar figure directly.
 * Prices as published at the time this milestone was built — these WILL
 * drift as providers change pricing, and there is deliberately no
 * automated way to keep this current in this milestone. Treated as an
 * estimate for cost visibility (a full AI cost dashboard is a later
 * milestone's scope), not a billing-grade source of truth — a real
 * invoice reconciliation would read the actual provider billing API, not
 * this table.
 */
export const MODEL_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // Anthropic
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

const DEFAULT_PRICING = { input: 3, output: 15 }; // conservative mid-tier fallback for an unrecognized model id

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model] ?? DEFAULT_PRICING;
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Math.round(cost * 10000) / 10000; // matches ai_jobs.cost_usd's numeric(10,4)
}

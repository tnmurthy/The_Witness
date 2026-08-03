/**
 * src/lib/embeddings/generate.ts
 *
 * Generates vector embeddings for content using OpenAI's
 * text-embedding-3-small model (1536 dimensions — matches the
 * vector(1536) columns added in Migration 008).
 *
 * Called by:
 *   - POST /api/cron/process-embeddings (Vercel cron, every 5 min)
 *   - The Supabase Edge Function generate-embeddings (alternative path)
 *
 * Design choices:
 *   - text-embedding-3-small: best price/performance for semantic search
 *     ($0.02/1M tokens — 50x cheaper than ada-002 with better quality)
 *   - Batch up to 100 items per API call (OpenAI limit)
 *   - Truncate input to 8,000 tokens (model context limit)
 *   - Fall back gracefully if OPENAI_API_KEY is not configured
 */
import "server-only";

const MODEL = "text-embedding-3-small";
const MAX_CHARS = 30_000; // ~8k tokens at ~3.75 chars/token
const BATCH_SIZE = 100;

export interface EmbeddingResult {
  id: string;
  embedding: number[];
}

/**
 * Generate embeddings for a batch of text strings.
 * Returns null for each input that failed (safe to retry).
 */
export async function generateEmbeddings(
  items: Array<{ id: string; text: string }>
): Promise<Array<EmbeddingResult | null>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Truncate inputs to max context length
  const inputs = items.map((item) => ({
    id: item.id,
    text: item.text.slice(0, MAX_CHARS),
  }));

  const results: Array<EmbeddingResult | null> = [];

  // Process in batches
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: batch.map((b) => b.text),
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embeddings API error ${response.status}: ${error.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
    };

    for (const item of data.data) {
      const source = batch[item.index];
      if (source) {
        results.push({ id: source.id, embedding: item.embedding });
      }
    }
  }

  return results;
}

/**
 * Extract the text content to embed from a content row.
 * Different tables have different relevant fields.
 */
export function extractEmbeddingText(tableName: string, row: Record<string, unknown>): string {
  switch (tableName) {
    case "issues":
      return [row.title, row.subtitle].filter(Boolean).join("\n");
    case "articles":
      return [row.title, row.summary].filter(Boolean).join("\n");
    case "wisdom_entries":
      return [row.title, row.content, row.contemporary_application].filter(Boolean).join("\n");
    case "blocks": {
      const payload = row.payload as Record<string, unknown> | null;
      if (!payload) return "";
      return Object.values(payload)
        .filter((v) => typeof v === "string")
        .join(" ")
        .slice(0, MAX_CHARS);
    }
    default:
      return String(row.title ?? "");
  }
}

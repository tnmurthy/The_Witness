/**
 * src/lib/search/semantic.ts
 *
 * Semantic (vector) search using pgvector.
 * Called when embedding_jobs have been processed and the embedding
 * columns on content tables are populated.
 *
 * Gracefully falls back to empty results when:
 *   - OPENAI_API_KEY is not configured (can't generate query embedding)
 *   - No embeddings exist yet (embedding_jobs queue not yet processed)
 *
 * This is the "swapping keyword-rank for vector-similarity" step
 * referenced in the retrieve route comment — the interface is stable,
 * only the ranking backend changes.
 */
import "server-only";
import { generateEmbeddings } from "@/lib/embeddings/generate";

export interface SemanticSearchResult {
  id: string;
  entityType: string;
  label: string;
  similarity: number;
}

/**
 * Generate a query embedding then run pgvector similarity search
 * across the requested content tables using the <=> (cosine distance) operator.
 */
export async function semanticSearch(
  supabase: SupabaseClient,
  query: string,
  tables: Array<"issues" | "articles" | "wisdom_entries">,
  limit = 10
): Promise<SemanticSearchResult[]> {
  // Can't do semantic search without an embedding model
  if (!process.env.OPENAI_API_KEY) return [];

  // Generate query embedding
  let queryEmbedding: number[];
  try {
    const results = await generateEmbeddings([{ id: "query", text: query }]);
    const result = results[0];
    if (!result) return [];
    queryEmbedding = result.embedding;
  } catch {
    // Embedding generation failed — fall back silently
    return [];
  }

  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  const allResults: SemanticSearchResult[] = [];

  for (const table of tables) {
    const labelField = table === "issues" || table === "articles" ? "title" : "title";

    // pgvector cosine similarity: 1 - (embedding <=> query_vector)
    // Only returns rows where embedding IS NOT NULL (populated by the pipeline)
    const { data } = await supabase
      .from(table)
      .select(`id, ${labelField}, embedding`)
      .not("embedding", "is", null)
      .order(`embedding <=> '${embeddingStr}'::vector`)
      .limit(limit);

    if (data?.length) {
      for (const row of data) {
        allResults.push({
          id: row.id,
          entityType: table,
          label: row[labelField] ?? row.id,
          // Approximate similarity: we don't get the distance back easily
          // without a raw SQL query. Use position as proxy for now.
          similarity: 1 - allResults.length * 0.01,
        });
      }
    }
  }

  return allResults.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

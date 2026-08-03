/**
 * src/lib/pagination.ts
 *
 * Keyset (cursor) pagination utilities — used across all list endpoints.
 *
 * We use keyset pagination over offset pagination because:
 *   - Consistent performance regardless of page depth (no OFFSET scan)
 *   - No duplicate/missing rows when items are inserted between pages
 *   - Cursor is a composite of (created_at, id) which is stable and unique
 *
 * Cursor format: base64(ISO_DATE:UUID)
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  limit: number;
  afterId?: string;
  afterDate?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    limit: number;
  };
}

/** Parse ?cursor= and ?limit= from a URL's search params */
export function parsePaginationParams(url: string): PaginationParams {
  const { searchParams } = new URL(url);

  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? DEFAULT_PAGE_SIZE : rawLimit), MAX_PAGE_SIZE);

  const cursor = searchParams.get("cursor");
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      const colonIdx = decoded.lastIndexOf(":");
      const afterDate = decoded.slice(0, colonIdx);
      const afterId = decoded.slice(colonIdx + 1);
      if (afterDate && afterId) return { limit, afterDate, afterId };
    } catch {
      // Malformed cursor — ignore and return first page
    }
  }

  return { limit };
}

/** Build a base64 cursor from the last item in a page */
export function buildCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}:${id}`).toString("base64");
}

/**
 * Build a paginated response from a raw Supabase result.
 * The query must fetch limit+1 rows; we use the extra row to detect hasMore.
 */
export function buildPaginatedResponse<T extends { id: string; created_at: string }>(
  rows: T[],
  limit: number
): PaginatedResponse<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  const nextCursor = hasMore && last ? buildCursor(last.created_at, last.id) : null;

  return {
    data,
    pagination: { hasMore, nextCursor, limit },
  };
}

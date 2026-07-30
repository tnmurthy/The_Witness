import { vi } from "vitest";

/**
 * A chainable mock Supabase client for unit/integration-testing API
 * route handlers without a live database — the "Mock Services"
 * deliverable this milestone names. Every route handler in this app
 * calls `createClient()` (src/lib/supabase/server.ts) and then chains
 * `.from(table).select(...).eq(...).single()`-style calls; this mock
 * reproduces that exact chainable shape so a route handler can be
 * imported and called directly in a test, with its Supabase
 * interactions fully controlled and asserted on, rather than requiring
 * either a live database (this repo's usual approach, via curl against
 * a running build) or complex per-test ad hoc mocking duplicated across
 * every test file.
 *
 * Design: `MockSupabaseBuilder` lets a test declare, in order, what each
 * `.from(table)` call should resolve to. Each declared response is
 * consumed once per matching `.from()` call, in the order declared —
 * this mirrors how a real handler often makes several different queries
 * in sequence (e.g. check auth, check membership, then do the real
 * work), without needing the mock to understand the actual query
 * semantics (which columns, which filters) the way a real database
 * would.
 */

export interface MockQueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

function createChainableResult(result: MockQueryResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (value: MockQueryResult) => void) => resolve(result),
  };

  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "textSearch",
    "ilike",
  ] as const;

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  return chain;
}

export class MockSupabaseBuilder {
  private fromResponses = new Map<string, MockQueryResult[]>();
  private rpcResponses = new Map<string, MockQueryResult[]>();
  private authUser: { id: string; email?: string } | null = null;

  /** Queue a response for the next `.from(table)` call — call multiple times for a table to queue multiple sequential responses (e.g. an auth-check select, then the real query). */
  from(table: string, result: MockQueryResult): this {
    const existing = this.fromResponses.get(table) ?? [];
    existing.push(result);
    this.fromResponses.set(table, existing);
    return this;
  }

  /** Queue a response for the next `.rpc(name)` call. */
  rpc(name: string, result: MockQueryResult): this {
    const existing = this.rpcResponses.get(name) ?? [];
    existing.push(result);
    this.rpcResponses.set(name, existing);
    return this;
  }

  /** Sets what `supabase.auth.getUser()` resolves to — null means unauthenticated, matching every route handler's own `if (!user) return 401` check. */
  authenticatedAs(user: { id: string; email?: string } | null): this {
    this.authUser = user;
    return this;
  }

  build() {
    const fromResponses = this.fromResponses;
    const rpcResponses = this.rpcResponses;
    const authUser = this.authUser;

    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: authUser },
          error: authUser ? null : { message: "Not authenticated" },
        })),
      },
      from: vi.fn((table: string) => {
        const queue = fromResponses.get(table);
        const result: MockQueryResult = queue?.shift() ?? {
          data: null,
          error: { message: `No mock response queued for table "${table}"` },
        };
        return createChainableResult(result);
      }),
      rpc: vi.fn(async (name: string) => {
        const queue = rpcResponses.get(name);
        return (
          queue?.shift() ?? { data: null, error: { message: `No mock response queued for rpc "${name}"` } }
        );
      }),
    };
  }
}

/** Convenience factory — `mockSupabase().authenticatedAs(...).from(...).build()`. */
export function mockSupabase(): MockSupabaseBuilder {
  return new MockSupabaseBuilder();
}

export const testUser = { id: "11111111-1111-1111-1111-111111111111", email: "test@example.com" };

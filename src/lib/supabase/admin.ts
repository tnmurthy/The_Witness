import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses Row Level Security entirely.
 * Used only for operations that are legitimately platform-administrative
 * and cannot be expressed as "the current user acting within their own
 * permissions" (e.g. Super Admin changing another user's role — RLS
 * intentionally has no policy letting one user's session write another
 * user's profiles.role row, by design, so this specific action goes
 * through the service role instead, with the caller's own authorization
 * checked in application code first via requireRole()).
 *
 * The `server-only` import makes it a build error to ever import this
 * from a Client Component — the service role key must never reach the
 * browser.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations (see .env.example)."
    );
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

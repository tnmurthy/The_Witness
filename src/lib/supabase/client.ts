import { createBrowserClient } from "@supabase/ssr";
// Database generic intentionally NOT applied here — see
// docs/PROJECT_VERIFICATION.md, "Supabase type generation," for why:
// @supabase/ssr's createBrowserClient/createServerClient (unlike plain
// @supabase/supabase-js's createClient, which does work correctly with
// this exact Database type — verified directly) resolve every query to
// `never` with the installed package versions. Wiring Database into
// admin.ts (which uses createClient) works and is done; wiring it here
// is a real, open item for whoever next updates @supabase/ssr past the
// version where this is fixed, not something silently abandoned.
import { env } from "@/lib/env";

/**
 * Supabase client for use in Client Components ("use client").
 *
 * Uses the anon key only — Row Level Security (Database Schema Design doc,
 * Section 9) is what actually restricts what this client can read or
 * write, not this file. Call `createClient()` once per component/hook via
 * `useMemo`, not on every render.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

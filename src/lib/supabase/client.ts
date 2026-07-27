import { createBrowserClient } from "@supabase/ssr";
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

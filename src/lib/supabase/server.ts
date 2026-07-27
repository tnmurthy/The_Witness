import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via Next.js's cookie store so the
 * user's auth state is available on the server without a client round
 * trip. Row Level Security (not this file) is the actual access-control
 * boundary — see Database Schema Design doc, Section 9.
 *
 * Must be called fresh per request (it reads the request-scoped cookie
 * store), never module-level cached.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll is called from a Server Component in some render paths,
          // where Next.js disallows setting cookies. This is safe to
          // swallow as long as middleware.ts (which can always write
          // cookies) is refreshing the session on every request — see
          // src/lib/supabase/middleware.ts.
        }
      },
    },
  });
}

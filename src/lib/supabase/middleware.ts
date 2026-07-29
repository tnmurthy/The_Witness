import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. This is what makes
 * server-rendered pages see an up-to-date session — Supabase access
 * tokens are short-lived, and without this, a Server Component could read
 * a stale/expired cookie and incorrectly treat a signed-in user as
 * logged out.
 *
 * Route protection here is intentionally coarse (unauthenticated ->
 * redirect to /sign-in for anything under the (dashboard) group). Role
 * and publication-membership authorization is enforced by Row Level
 * Security at the database layer (Database Schema Design doc, Section 9),
 * not by this middleware — this is a UX redirect, not the security
 * boundary.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every page rendered by the (dashboard) route group lives at one of
  // these top-level paths. Route groups don't appear in the URL, so this
  // list has to be maintained by hand alongside src/app/(dashboard)/* —
  // there is no way to derive it from the filesystem at the Edge
  // middleware runtime. Each of these ALSO re-checks auth server-side in
  // its own layout/page (see src/app/(dashboard)/layout.tsx), so a path
  // missing from this list is a UX regression (a slower redirect instead
  // of an instant one), not a security hole.
  const protectedPrefixes = [
    "/dashboard",
    "/organizations",
    "/admin",
    "/settings",
    "/publications",
    "/issues",
    "/wisdom",
    "/graph",
    "/people",
    "/ai-workspace",
    "/search",
    "/analytics",
  ];
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`)
  );
  const isAuthRoute = request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up");

  if (!user && isProtectedRoute) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

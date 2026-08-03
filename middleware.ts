/**
 * middleware.ts
 *
 * Two responsibilities:
 *   1. Refresh Supabase session cookies on every request
 *   2. Generate a cryptographic nonce and apply a nonce-based CSP
 *
 * The nonce-based CSP replaces the previous unsafe-inline/unsafe-eval
 * approach (PRR finding 2.3 / CTO report F-007). unsafe-eval specifically
 * enables the most dangerous class of XSS payloads; removing it and using
 * a per-request nonce for legitimate inline scripts provides real protection.
 *
 * Next.js 15 automatically forwards the nonce from the response header
 * to the <Head> component when you set x-nonce — the app doesn't need
 * any additional configuration.
 */
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // 1. Generate a cryptographically random nonce for this request
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");

  // 2. Build a strict nonce-based CSP.
  //    'strict-dynamic' trusts scripts loaded by a nonced script, which is
  //    what Next.js's runtime needs. Falls back to 'nonce-xxx' for browsers
  //    that don't support strict-dynamic.
  const csp = [
    `default-src 'self'`,
    // Nonce-based script policy — no unsafe-inline, no unsafe-eval
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    // Inline styles are necessary for Tailwind's runtime; shadcn/ui relies on
    // CSS custom properties applied inline. We allow unsafe-inline for styles
    // (lower risk than scripts) until we can adopt CSS modules fully.
    `style-src 'self' 'unsafe-inline'`,
    // Supabase API (REST + Auth + Realtime WebSocket)
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
    // Images from Supabase Storage + data URIs for optimized images
    `img-src 'self' https://*.supabase.co data: blob:`,
    // Fonts from self only (no Google Fonts currently used)
    `font-src 'self'`,
    // Sentry error reporting tunnel (see next.config.ts tunnelRoute)
    `report-uri /monitoring-tunnel`,
    // No framing from any origin
    `frame-ancestors 'none'`,
  ].join("; ");

  // 3. Refresh the Supabase session
  const supabaseResponse = await updateSession(request);

  // 4. Copy the CSP and nonce onto the response
  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        "x-nonce": nonce,
      }),
    },
  });

  // Copy Supabase's Set-Cookie headers onto our response
  supabaseResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      response.headers.append(key, value);
    }
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals and static assets.
     * The nonce must be generated on every page request — it cannot be
     * cached. Static assets don't need a nonce.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const CSP = [
  "default-src 'self'",
  // Supabase API and Auth
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // Next.js dev HMR + production scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Inline styles used by Tailwind/shadcn
  "style-src 'self' 'unsafe-inline'",
  // Images from Supabase Storage and data URIs
  "img-src 'self' https://*.supabase.co data: blob:",
  // Fonts
  "font-src 'self'",
  // No framing from any origin
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // CSP — defense-in-depth against XSS beyond React's own escaping
  // PRR finding 2.3: previously entirely absent
  { key: "Content-Security-Policy", value: CSP },
  // No framing from any origin (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // HSTS — HTTPS only, 1 year, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Referrer policy — don't leak paths to third-party origins
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  experimental: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes except Next.js internals and static files
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry build-time options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (production CI)
  silent: !process.env.SENTRY_AUTH_TOKEN,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Minimise bundle size by tree-shaking unused Sentry features
  disableLogger: true,
  // Tunnel Sentry requests through our own domain to avoid ad-blockers
  tunnelRoute: "/monitoring-tunnel",
});

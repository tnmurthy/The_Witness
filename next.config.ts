import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";


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

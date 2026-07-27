import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fails the production build on type errors instead of silently shipping
  // them — matches the Milestone 1 acceptance criterion that CI blocks on
  // typecheck, and keeps `next build` itself as a second, independent gate.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Server Actions are the default mutation path per the Solution
    // Architecture's state-management approach (Section on Issue Builder /
    // Publication Manager) — no extra config needed in Next 15, listed here
    // as a marker for where App Router experimental flags will land as
    // later milestones need them (e.g. typed routes).
  },
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

export default nextConfig;

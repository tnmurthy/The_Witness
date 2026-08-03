/** sentry.edge.config.ts — Sentry for Next.js Edge Runtime (middleware). */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_DEV === "true",
  tracesSampleRate: 0.1,
});

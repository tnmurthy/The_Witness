/**
 * sentry.server.config.ts
 * Sentry server-side initialisation (Node.js runtime).
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_DEV === "true",
  tracesSampleRate: 0.2,
  // Capture every unhandled promise rejection and uncaught exception
  // Unhandled rejections are captured automatically by @sentry/nextjs
});

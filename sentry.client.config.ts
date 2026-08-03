/**
 * sentry.client.config.ts
 * Sentry browser-side initialisation. Imported automatically by Next.js
 * instrumentation when NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Disable in development unless explicitly opted in
  enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLE_DEV === "true",
  tracesSampleRate: 0.2, // 20% of transactions — adjust once real traffic data exists
  replaysOnErrorSampleRate: 1.0, // Full replay on every error
  replaysSessionSampleRate: 0.05, // 5% of sessions
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // Privacy: mask all text in session replays
      blockAllMedia: false,
    }),
  ],
});

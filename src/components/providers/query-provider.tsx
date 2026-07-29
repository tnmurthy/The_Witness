"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * One QueryClient per browser session, created lazily inside a
 * useState initializer rather than at module scope — module-scope
 * instantiation would share one client across every user in a
 * server-rendering environment (Next.js can execute this file's module
 * body in a shared server process), which is exactly the kind of
 * cross-request state leak this pattern exists to avoid. This mirrors
 * TanStack Query's own documented Next.js App Router setup.
 *
 * Defaults: staleTime of 30s means a component re-mounting shortly
 * after navigation (e.g. clicking back to a page you just left) reuses
 * cached data instead of re-fetching instantly — appropriate for this
 * app's editorial/reference data, which doesn't change second-to-second
 * the way a live dashboard might. retry: 1 rather than the default 3,
 * since a 401/403/404 from this app's API routes (this app's most
 * common non-transient failures) will never succeed on retry, and
 * failing fast gives a quicker, more honest error state than three
 * silent retries before the user sees anything.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Next.js's file-based error boundary — catches any error thrown while
 * rendering this route segment or below that isn't already caught by a
 * more specific ErrorBoundary (src/components/error/error-boundary.tsx).
 * Must be a Client Component (Next.js requirement for error.tsx).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Unhandled route error", { error, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-page px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-danger-600" aria-hidden="true" />
      <div className="space-y-1">
        <h1 className="font-voice text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. The team has been notified via the application logs.
        </p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

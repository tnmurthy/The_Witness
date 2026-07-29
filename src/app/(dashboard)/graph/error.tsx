"use client";

import { RouteErrorFallback } from "@/components/error/route-error-fallback";

export default function GraphExplorerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorFallback
      reset={reset}
      title="The Knowledge Graph couldn't load"
      description="Something went wrong rendering this page."
    />
  );
}

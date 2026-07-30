"use client";

import { RouteErrorFallback } from "@/components/error/route-error-fallback";

export default function PersonDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback reset={reset} title="This person couldn't load" />;
}

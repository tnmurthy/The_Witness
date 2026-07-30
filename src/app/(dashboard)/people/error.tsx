"use client";

import { RouteErrorFallback } from "@/components/error/route-error-fallback";

export default function PeopleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback reset={reset} title="People couldn't load" />;
}

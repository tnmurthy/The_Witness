"use client";
import { RouteErrorFallback } from "@/components/error/route-error-fallback";
export default function SearchError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback reset={reset} title="Search couldn't load" />;
}

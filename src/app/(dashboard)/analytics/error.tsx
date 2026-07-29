"use client";
import { RouteErrorFallback } from "@/components/error/route-error-fallback";
export default function AnalyticsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback reset={reset} title="Analytics couldn't load" />;
}

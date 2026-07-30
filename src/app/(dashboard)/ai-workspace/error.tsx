"use client";
import { RouteErrorFallback } from "@/components/error/route-error-fallback";
export default function AIWorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback reset={reset} title="AI Workspace couldn't load" />;
}

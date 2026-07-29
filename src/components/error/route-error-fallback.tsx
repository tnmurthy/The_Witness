"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorFallbackProps {
  reset: () => void;
  title?: string;
  description?: string;
}

/**
 * The shared body for every route segment's error.tsx (Next.js App
 * Router convention — automatically wraps that segment when its Server
 * or Client Component throws during render). Each route's own error.tsx
 * stays a 5-line file that imports this and supplies a segment-specific
 * title, rather than every route hand-rolling its own copy of the same
 * alert-icon-plus-retry-button layout.
 */
export function RouteErrorFallback({ reset, title = "Something went wrong", description = "This page couldn't load." }: RouteErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-danger-200 bg-danger-50 px-6 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-danger-600" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

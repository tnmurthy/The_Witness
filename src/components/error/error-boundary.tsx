"use client";

import * as React from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Shown in the fallback UI so different boundaries can identify themselves in logs and to the user (e.g. "Issue Builder", "Analytics widget"). */
  boundaryName: string;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Reusable error boundary for wrapping a specific region of the UI (a
 * dashboard widget, the Issue Builder canvas, etc.) so one broken
 * component can't take down the entire page. Next.js's file-based
 * error.tsx (src/app/error.tsx) is a second, coarser layer that catches
 * anything this component doesn't wrap — the two are complementary, not
 * redundant: error.tsx catches render errors in Server Components and
 * whole-route failures; this ErrorBoundary is for isolating a single
 * client-rendered region.
 *
 * Must be a class component — React does not yet provide a Hooks API for
 * error boundaries.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("UI error boundary caught an error", {
      boundary: this.props.boundaryName,
      error,
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger-600/30 bg-danger-100 p-8 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-danger-700" aria-hidden="true" />
        <div>
          <p className="font-medium text-danger-700">Something went wrong in {this.props.boundaryName}.</p>
          <p className="text-sm text-danger-700/80">The rest of the page should still work.</p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}

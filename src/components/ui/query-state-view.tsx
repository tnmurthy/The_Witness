import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";

interface QueryStateViewProps<T> {
  query: UseQueryResult<T>;
  loading?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

/**
 * The single place every list/detail page's four states (loading,
 * error, empty, data) are decided, instead of each page re-implementing
 * `if (isPending) ... else if (error) ... else if (!data?.length) ...`
 * with its own slightly different shape. A 401/403 renders differently
 * from a generic failure (a permissions problem is not "something went
 * wrong, try again" — retrying won't fix it), which is exactly the kind
 * of distinction that gets lost when error handling isn't centralized.
 */
export function QueryStateView<T>({ query, loading, isEmpty, empty, children }: QueryStateViewProps<T>) {
  if (query.isPending) {
    return (
      <>
        {loading ?? (
          <div className="space-y-2" role="status" aria-label="Loading">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
      </>
    );
  }

  if (query.isError) {
    const isPermissionError = query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403);

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-danger-200 bg-danger-50 px-6 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-danger-600" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-foreground">
          {isPermissionError ? "You don't have access to this." : "Something went wrong loading this."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : "Please try again."}</p>
        {!isPermissionError && (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    );
  }

  if (query.data === undefined) return null;

  if (isEmpty?.(query.data)) {
    return <>{empty}</>;
  }

  return <>{children(query.data)}</>;
}

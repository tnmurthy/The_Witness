"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { GRAPH_ENTITY_LABELS, type GraphEntityType } from "@/lib/graph/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QueryStateView } from "@/components/ui/query-state-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RetrieveResult {
  entityType: GraphEntityType;
  entityId: string;
  label: string;
  nearSeed: boolean | null;
}

export function SearchResults() {
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");

  const results = useQuery({
    queryKey: ["graph-retrieve", query],
    queryFn: () => apiPost<{ results: RetrieveResult[] }>("/api/graph/retrieve", { query, limit: 20 }),
    enabled: query.length > 0,
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
        className="relative max-w-xl"
      >
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search technologies, companies, wisdom, people, and more…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search"
        />
      </form>

      <Alert variant="info">
        <AlertDescription>
          This searches the Knowledge Graph — technologies, companies, articles, books, research, courses,
          GitHub repositories, wisdom entries, people, and issues. It doesn&apos;t yet search inside issue
          block content or full article bodies; that&apos;s a future, broader search system.
        </AlertDescription>
      </Alert>

      {query && (
        <QueryStateView
          query={results}
          loading={
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          }
          isEmpty={(data) => data.results.length === 0}
          empty={
            <EmptyState
              icon={SearchIcon}
              title="No results"
              description={`Nothing in the Knowledge Graph matches "${query}".`}
            />
          }
        >
          {(data) => (
            <ul className="space-y-2">
              {data.results.map((result) => (
                <li
                  key={`${result.entityType}:${result.entityId}`}
                  className="flex items-center justify-between rounded-md border border-neutral-200 p-3"
                >
                  <span className="text-sm font-medium text-foreground">{result.label}</span>
                  <Badge variant="neutral" className="text-[10px]">
                    {GRAPH_ENTITY_LABELS[result.entityType]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </QueryStateView>
      )}
    </div>
  );
}

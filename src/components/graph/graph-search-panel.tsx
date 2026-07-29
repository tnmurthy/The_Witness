"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useEntitySearch } from "@/lib/graph/hooks";
import { GRAPH_ENTITY_LABELS, GRAPH_ENTITY_TYPES, type GraphEntityType } from "@/lib/graph/types";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QueryStateView } from "@/components/ui/query-state-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface GraphSearchPanelProps {
  onSelect: (entityType: GraphEntityType, entityId: string, label: string) => void;
}

export function GraphSearchPanel({ onSelect }: GraphSearchPanelProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const query = useEntitySearch(typeFilter === "all" ? undefined : typeFilter, search || undefined);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-9"
            placeholder="Search the Knowledge Graph…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search entities"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {GRAPH_ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {GRAPH_ENTITY_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryStateView
        query={query}
        loading={
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        }
        isEmpty={(data) => data.entities.length === 0}
        empty={
          <EmptyState
            icon={Search}
            title={search ? "No entities match" : "Nothing here yet"}
            description={search ? "Try a different search term or entity type." : "Start typing to search across every entity type in the graph."}
          />
        }
      >
        {(data) => (
          <ul className="max-h-[28rem] space-y-1 overflow-y-auto" role="listbox" aria-label="Search results">
            {data.entities.map((entity) => (
              <li key={`${entity.entityType}:${entity.entityId}`}>
                <button
                  type="button"
                  onClick={() => onSelect(entity.entityType, entity.entityId, entity.label)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-left hover:border-neutral-300 hover:bg-secondary focus-visible:outline-none focus-visible:shadow-focus-gold"
                >
                  <span className="truncate text-sm font-medium text-foreground">{entity.label}</span>
                  <Badge variant="neutral" className="shrink-0 text-[10px]">
                    {GRAPH_ENTITY_LABELS[entity.entityType]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </QueryStateView>
    </div>
  );
}

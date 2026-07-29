import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type { GraphEntityType } from "@/lib/graph/types";

export interface GraphEntitySummary {
  entityType: GraphEntityType;
  entityId: string;
  label: string;
}

export interface GraphNeighbor extends GraphEntitySummary {
  depth: number;
  relationType: string | null;
  via: { entityType: string; entityId: string } | null;
}

export interface RelatedGroup {
  entityType: GraphEntityType;
  label: string;
  items: { entityId: string; label: string }[];
}

/** Query key factory — one place defining how graph queries are keyed, so a mutation (createEdge, deleteEdge) can invalidate exactly the queries it affects rather than every component guessing at a matching key by hand. */
export const graphKeys = {
  all: ["graph"] as const,
  entities: (type?: string, search?: string) => [...graphKeys.all, "entities", type ?? "all", search ?? ""] as const,
  neighbors: (type: string, id: string, depth: number) => [...graphKeys.all, "neighbors", type, id, depth] as const,
  related: (type: string, id: string) => [...graphKeys.all, "related", type, id] as const,
};

export function useEntitySearch(type?: string, search?: string) {
  return useQuery({
    queryKey: graphKeys.entities(type, search),
    queryFn: () => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (search) params.set("search", search);
      return apiGet<{ entities: GraphEntitySummary[] }>(`/api/graph/entities?${params.toString()}`);
    },
  });
}

export function useGraphNeighbors(type: string, id: string, depth: number) {
  return useQuery({
    queryKey: graphKeys.neighbors(type, id, depth),
    queryFn: () => apiGet<{ neighbors: GraphNeighbor[] }>(`/api/graph/nodes/${type}/${id}/neighbors?depth=${depth}`),
    enabled: !!type && !!id,
  });
}

export function useRelatedContent(type: string, id: string) {
  return useQuery({
    queryKey: graphKeys.related(type, id),
    queryFn: () => apiGet<{ groups: RelatedGroup[] }>(`/api/graph/nodes/${type}/${id}/related`),
    enabled: !!type && !!id,
  });
}

export function useCreateEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceType: string; sourceId: string; targetType: string; targetId: string; relationType: string }) =>
      apiPost("/api/graph/edges", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
    },
  });
}

export function useDeleteEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (edgeId: string) => apiDelete(`/api/graph/edges/${edgeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import type { CreatePersonInput } from "@/lib/validation/graph";

export interface PersonSummary {
  id: string;
  full_name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface PersonDetail extends PersonSummary {
  external_links: Record<string, string>;
  created_at: string;
}

export const peopleKeys = {
  all: ["people"] as const,
  list: (search?: string) => [...peopleKeys.all, "list", search ?? ""] as const,
  detail: (id: string) => [...peopleKeys.all, "detail", id] as const,
};

export function usePeople(search?: string) {
  return useQuery({
    queryKey: peopleKeys.list(search),
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      return apiGet<{ people: PersonSummary[] }>(`/api/people${params}`);
    },
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: peopleKeys.detail(id),
    queryFn: () => apiGet<{ person: PersonDetail }>(`/api/people/${id}`),
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonInput) =>
      apiPost<{ person: { id: string; full_name: string } }>("/api/people", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
    },
  });
}

export function useUpdatePerson(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreatePersonInput>) => apiPatch(`/api/people/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
      queryClient.invalidateQueries({ queryKey: peopleKeys.detail(id) });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/people/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
    },
  });
}

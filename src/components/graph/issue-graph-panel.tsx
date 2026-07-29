"use client";

import * as React from "react";
import { toast } from "sonner";
import { Share2, Sparkles, Plus } from "lucide-react";

import { useEntitySearch, useCreateEdge } from "@/lib/graph/hooks";
import { apiPost } from "@/lib/api-client";
import { GRAPH_ENTITY_LABELS, GRAPH_RELATION_TYPES, type GraphEntityType } from "@/lib/graph/types";
import { RelatedContentPanel } from "./related-content-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Muted } from "@/components/ui/typography";

interface SuggestedConnection {
  entityType: string;
  entityId: string;
  relationType: string;
  rationale: string;
}

/**
 * The Knowledge Graph, inside the Issue Builder — this milestone's
 * explicit "wire Knowledge Graph into Issue Builder" requirement. Three
 * things in one panel: what's already connected to this issue
 * (RelatedContentPanel, reused unchanged — the same component the
 * People pages use), AI-suggested connections an editor reviews and
 * accepts one at a time (never auto-created), and a manual
 * search-and-connect form for when the editor already knows exactly
 * what to link.
 */
export function IssueGraphPanel({ issueId }: { issueId: string }) {
  const [search, setSearch] = React.useState("");
  const [selectedEntity, setSelectedEntity] = React.useState<{ entityType: GraphEntityType; entityId: string; label: string } | null>(null);
  const [relationType, setRelationType] = React.useState<string>("related");
  const [suggestions, setSuggestions] = React.useState<SuggestedConnection[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const entitySearch = useEntitySearch(undefined, search || undefined);
  const createEdge = useCreateEdge();

  async function handleGetSuggestions() {
    setIsSuggesting(true);
    try {
      const body = await apiPost<{ suggestions: SuggestedConnection[] }>("/api/graph/suggest-connections", {
        entityType: "issue",
        entityId: issueId,
        count: 3,
      });
      setSuggestions(body.suggestions);
      if (body.suggestions.length === 0) toast.info("No strong connections found");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function acceptSuggestion(s: SuggestedConnection) {
    try {
      await createEdge.mutateAsync({
        sourceType: "issue",
        sourceId: issueId,
        targetType: s.entityType,
        targetId: s.entityId,
        relationType: s.relationType,
      });
      setSuggestions((prev) => prev.filter((x) => x.entityId !== s.entityId));
      toast.success("Connection added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  async function handleManualConnect() {
    if (!selectedEntity) return;
    try {
      await createEdge.mutateAsync({
        sourceType: "issue",
        sourceId: issueId,
        targetType: selectedEntity.entityType,
        targetId: selectedEntity.entityId,
        relationType,
      });
      toast.success("Connection added");
      setSelectedEntity(null);
      setSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" /> Knowledge Graph
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md space-y-6 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Knowledge Graph</SheetTitle>
          <SheetDescription>Connect this issue to the technologies, companies, and other entities it covers.</SheetDescription>
        </SheetHeader>

        <RelatedContentPanel entityType="issue" entityId={issueId} title="Currently connected" />

        <div className="space-y-2">
          <Button variant="signal" size="sm" className="w-full" disabled={isSuggesting} onClick={handleGetSuggestions}>
            <Sparkles className="h-4 w-4" /> {isSuggesting ? "Thinking…" : "Suggest connections"}
          </Button>
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={`${s.entityType}:${s.entityId}`} className="rounded-md border border-neutral-200 p-3">
                  <p className="text-xs italic text-gold-700">{s.rationale}</p>
                  <Button size="sm" variant="outline" className="mt-2" disabled={createEdge.isPending} onClick={() => acceptSuggestion(s)}>
                    <Plus className="h-3.5 w-3.5" /> Add connection
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-neutral-200 pt-4">
          <Muted className="text-xs font-semibold uppercase tracking-wide">Connect manually</Muted>
          <Input placeholder="Search entities…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && !selectedEntity && (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {(entitySearch.data?.entities ?? []).slice(0, 8).map((e) => (
                <button
                  key={`${e.entityType}:${e.entityId}`}
                  type="button"
                  onClick={() => setSelectedEntity(e)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{e.label}</span>
                  <span className="text-xs text-muted-foreground">{GRAPH_ENTITY_LABELS[e.entityType]}</span>
                </button>
              ))}
            </div>
          )}
          {selectedEntity && (
            <div className="flex items-center gap-2 rounded-md border border-neutral-200 p-2">
              <span className="flex-1 truncate text-sm">{selectedEntity.label}</span>
              <Select value={relationType} onValueChange={setRelationType}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAPH_RELATION_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={createEdge.isPending} onClick={handleManualConnect}>
                Add
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Search } from "lucide-react";
import { usePeople } from "@/lib/graph/people-hooks";
import { QueryStateView } from "@/components/ui/query-state-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function PeopleList() {
  const [search, setSearch] = React.useState("");
  const query = usePeople(search || undefined);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-9" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search people" />
      </div>

      <QueryStateView
        query={query}
        loading={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        }
        isEmpty={(data) => data.people.length === 0}
        empty={
          <EmptyState
            icon={Users}
            title={search ? "No people match" : "No people yet"}
            description={
              search ? "Try a different search term." : "People are authors, founders, and other individuals referenced across the Knowledge Graph."
            }
            action={{ label: "Add a person", href: "/people/new" }}
          />
        }
      >
        {(data) => (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.people.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`}>
                <Card className="h-full transition-colors hover:border-neutral-300">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <Avatar>
                      {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
                      <AvatarFallback>{initials(person.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{person.full_name}</p>
                      {person.bio && <p className="line-clamp-1 text-xs text-muted-foreground">{person.bio}</p>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </QueryStateView>
    </div>
  );
}

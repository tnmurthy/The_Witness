"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { PresenceUser } from "@/lib/supabase/realtime-issue";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Collaboration-ready, not full collaborative text editing — this shows
 * who else has the issue open right now (Supabase Realtime Presence, via
 * subscribeToIssueChannel), which is the visibility layer the
 * last-write-wins block model (Migration 016) depends on to be usable: a
 * writer who sees a collaborator's avatar here knows to expect the block
 * they're about to edit might change under them, before it actually
 * does. See docs/ISSUE_BUILDER.md, "Collaboration model," for what this
 * is and isn't.
 */
export function PresenceBar({ users, currentUserId }: { users: PresenceUser[]; currentUserId: string }) {
  const others = users.filter((u) => u.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {others.slice(0, 4).map((user) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <Avatar className="h-7 w-7 border-2 border-card">
              <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>{user.name} is viewing this issue</TooltipContent>
        </Tooltip>
      ))}
      {others.length > 4 && (
        <Avatar className="h-7 w-7 border-2 border-card">
          <AvatarFallback className="text-[10px]">+{others.length - 4}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

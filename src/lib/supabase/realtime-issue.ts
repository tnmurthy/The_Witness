import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { BlockRow } from "@/lib/stores/issue-builder-store";

export interface PresenceUser {
  userId: string;
  name: string;
  joinedAt: string;
}

interface IssueChannelCallbacks {
  onBlockChange: (block: BlockRow, eventType: "INSERT" | "UPDATE" | "DELETE") => void;
  onPresenceChange: (users: PresenceUser[]) => void;
}

/**
 * One Realtime channel per issue, combining two Supabase Realtime
 * features: postgres_changes (broadcasts block INSERT/UPDATE/DELETE to
 * every subscribed client — this is what makes the canvas collaborative,
 * per Migration 016 enabling Realtime on the blocks table) and Presence
 * (tracks who currently has this issue open, for the avatar stack —
 * src/components/issue-builder/presence-bar.tsx).
 *
 * Filtered by blocks.issue_id (the denormalized column Migration 016
 * added specifically so this filter could exist — Realtime's
 * postgres_changes filter only supports direct column equality, not a
 * join through section_id).
 */
export function subscribeToIssueChannel(
  issueId: string,
  userId: string,
  userName: string,
  callbacks: IssueChannelCallbacks
): RealtimeChannel {
  const supabase = createClient();
  const channel = supabase.channel(`issue:${issueId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "blocks", filter: `issue_id=eq.${issueId}` },
      (payload) => {
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        const row = (eventType === "DELETE" ? payload.old : payload.new) as BlockRow;
        callbacks.onBlockChange(row, eventType);
      }
    )
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ name: string; joinedAt: string }>();
      const users: PresenceUser[] = Object.entries(state).map(([key, presences]) => ({
        userId: key,
        name: presences[0]?.name ?? "Someone",
        joinedAt: presences[0]?.joinedAt ?? new Date().toISOString(),
      }));
      callbacks.onPresenceChange(users);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: userName, joinedAt: new Date().toISOString() });
      }
    });

  return channel;
}

export function unsubscribeFromIssueChannel(channel: RealtimeChannel) {
  const supabase = createClient();
  supabase.removeChannel(channel);
}

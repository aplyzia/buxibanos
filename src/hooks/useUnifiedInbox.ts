import { useMemo } from "react";
import type { Message } from "@/types/database";
import type { ChannelWithPreview } from "@/stores/channels-store";
import type { UnifiedInboxItem } from "@/types/unified-inbox";

type PriorityFilter = "all" | "high" | "medium" | "low";

export function useUnifiedInbox(
  messages: Message[],
  channels: ChannelWithPreview[],
  priorityFilter: PriorityFilter
): UnifiedInboxItem[] {
  return useMemo(() => {
    const parentItems: UnifiedInboxItem[] = messages
      .filter((m) => priorityFilter === "all" || m.priority === priorityFilter)
      .map((m) => ({
        kind: "parent" as const,
        data: m,
        sortTime: new Date(m.processed_at).getTime(),
      }));

    const channelItems: UnifiedInboxItem[] = channels
      .filter(
        (ch) => priorityFilter === "all" || ch.priority === priorityFilter
      )
      .map((ch) => ({
        kind: "channel" as const,
        data: ch,
        sortTime: new Date(ch.lastMessageAt || ch.updated_at).getTime(),
      }));

    return [...parentItems, ...channelItems].sort(
      (a, b) => b.sortTime - a.sortTime
    );
  }, [messages, channels, priorityFilter]);
}

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Message } from "@/types/database";
import { RealtimeChannel } from "@supabase/supabase-js";

type PriorityFilter = "all" | "high" | "medium" | "low";

interface MessagesState {
  messages: Message[];
  filteredMessages: Message[];
  priorityFilter: PriorityFilter;
  isLoading: boolean;
  error: string | null;

  // Derived counts
  highPriorityCount: number;
  actionRequiredCount: number;

  // Actions
  fetchMessages: (organizationId: string) => Promise<void>;
  setPriorityFilter: (filter: PriorityFilter) => void;
  subscribeToRealtime: (organizationId: string) => () => void;
}

function deriveCountsAndFilter(
  messages: Message[],
  filter: PriorityFilter
) {
  const unresponded = messages.filter((m) => !m.staff_responded);
  const highPriorityCount = unresponded.filter(
    (m) => m.priority === "high"
  ).length;
  const actionRequiredCount = unresponded.filter(
    (m) => m.action_required
  ).length;

  const filtered =
    filter === "all"
      ? messages
      : messages.filter((m) => m.priority === filter);

  return {
    filteredMessages: filtered,
    highPriorityCount,
    actionRequiredCount,
  };
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  filteredMessages: [],
  priorityFilter: "all",
  isLoading: false,
  error: null,
  highPriorityCount: 0,
  actionRequiredCount: 0,

  fetchMessages: async (organizationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("organization_id", organizationId)
        .order("processed_at", { ascending: false })
        .limit(100);

      if (error) {
        set({ error: "Messages failed to load", isLoading: false });
        return;
      }

      const messages = (data ?? []) as Message[];
      const derived = deriveCountsAndFilter(messages, get().priorityFilter);
      set({ messages, ...derived, isLoading: false });
    } catch {
      set({ error: "Messages failed to load", isLoading: false });
    }
  },

  setPriorityFilter: (filter: PriorityFilter) => {
    const derived = deriveCountsAndFilter(get().messages, filter);
    set({ priorityFilter: filter, ...derived });
  },

  subscribeToRealtime: (organizationId: string) => {
    const channel: RealtimeChannel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const current = get().messages;

          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            // Skip if already present (race between fetch and subscription)
            if (current.some((m) => m.id === newMsg.id)) return;
            const updated = [newMsg, ...current];
            const derived = deriveCountsAndFilter(
              updated,
              get().priorityFilter
            );
            set({ messages: updated, ...derived });
          }

          if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as Message;
            const updated = current.map((m) =>
              m.id === updatedMsg.id ? updatedMsg : m
            );
            const derived = deriveCountsAndFilter(
              updated,
              get().priorityFilter
            );
            set({ messages: updated, ...derived });
          }

          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            const updated = current.filter((m) => m.id !== deletedId);
            const derived = deriveCountsAndFilter(
              updated,
              get().priorityFilter
            );
            set({ messages: updated, ...derived });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));

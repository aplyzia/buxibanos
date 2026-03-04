import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Channel, ChannelMessage, ChannelTask, ChannelEvent } from "@/types/database";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface ChannelWithPreview extends Channel {
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  memberNames: string[];
  memberIds: string[];
}

interface ChannelsState {
  channels: ChannelWithPreview[];
  isLoading: boolean;
  error: string | null;

  // Active channel
  activeChannelId: string | null;
  channelMessages: ChannelMessage[];
  isLoadingMessages: boolean;

  // Project management
  channelTasks: ChannelTask[];
  channelEvents: ChannelEvent[];

  // Unread
  totalUnreadCount: number;

  // Staff name cache
  staffNames: Record<string, string>;

  // Actions
  fetchChannels: (organizationId: string, staffId: string) => Promise<void>;
  fetchChannelMessages: (channelId: string) => Promise<void>;
  sendMessage: (
    channelId: string,
    senderId: string,
    content: string,
    mediaUrls?: unknown[],
    replyToId?: string
  ) => Promise<void>;
  unsendMessage: (messageId: string) => Promise<void>;
  createChannel: (params: {
    organizationId: string;
    createdBy: string;
    type: "direct" | "group";
    name?: string;
    memberIds: string[];
  }) => Promise<string | null>;
  findExistingDM: (
    staffId1: string,
    staffId2: string
  ) => Promise<string | null>;
  markChannelRead: (channelId: string, staffId: string) => Promise<void>;
  subscribeToRealtime: (
    organizationId: string,
    staffId: string
  ) => () => void;
  resolveStaffNames: (organizationId: string) => Promise<void>;

  // Project management actions
  fetchChannelItems: (channelId: string) => Promise<void>;
  createTask: (
    channelId: string,
    title: string,
    createdBy: string,
    assignedTo?: string
  ) => Promise<void>;
  toggleTaskComplete: (taskId: string, staffId: string) => Promise<void>;
  toggleTaskPin: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  createEvent: (
    channelId: string,
    title: string,
    eventAt: string,
    createdBy: string
  ) => Promise<void>;
  toggleEventPin: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  updateChannelPriority: (channelId: string, priority: "high" | "medium" | "low") => Promise<void>;

  // Search
  searchResults: ChannelMessage[];
  isSearching: boolean;
  searchChannelMessages: (query: string) => Promise<void>;
  clearSearchResults: () => void;

  // Member management
  addChannelMember: (channelId: string, staffId: string) => Promise<void>;
  removeChannelMember: (channelId: string, staffId: string) => Promise<void>;

  // Read receipts
  channelMemberReadTimes: Record<string, string>;
  fetchChannelMemberReads: (channelId: string) => Promise<void>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  isLoading: false,
  error: null,
  activeChannelId: null,
  channelMessages: [],
  isLoadingMessages: false,
  channelTasks: [],
  channelEvents: [],
  totalUnreadCount: 0,
  staffNames: {},
  searchResults: [],
  isSearching: false,
  channelMemberReadTimes: {},

  fetchChannels: async (organizationId: string, staffId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get channels the user is a member of
      const { data: memberRows, error: memErr } = await supabase
        .from("channel_members")
        .select("channel_id, last_read_at")
        .eq("staff_id", staffId);

      if (memErr || !memberRows || memberRows.length === 0) {
        set({ channels: [], isLoading: false, totalUnreadCount: 0 });
        return;
      }

      const channelIds = memberRows.map((m) => m.channel_id);
      const lastReadMap: Record<string, string> = {};
      memberRows.forEach((m) => {
        lastReadMap[m.channel_id] = m.last_read_at;
      });

      // Fetch channels
      const { data: channelsData, error: chErr } = await supabase
        .from("channels")
        .select("*")
        .in("id", channelIds)
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });

      if (chErr) {
        set({ error: "Channels failed to load", isLoading: false });
        return;
      }

      const channels = (channelsData ?? []) as Channel[];

      // Fetch all members for these channels
      const { data: allMembers } = await supabase
        .from("channel_members")
        .select("channel_id, staff_id")
        .in("channel_id", channelIds);

      // Fetch latest message for each channel
      const channelsWithPreview: ChannelWithPreview[] = await Promise.all(
        channels.map(async (ch) => {
          const { data: msgs } = await supabase
            .from("channel_messages")
            .select("content, created_at")
            .eq("channel_id", ch.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastMsg = msgs?.[0] ?? null;
          const lastReadAt = lastReadMap[ch.id];

          // Count unread
          let unreadCount = 0;
          if (lastMsg && lastReadAt) {
            const { count } = await supabase
              .from("channel_messages")
              .select("id", { count: "exact", head: true })
              .eq("channel_id", ch.id)
              .gt("created_at", lastReadAt);
            unreadCount = count ?? 0;
          }

          const chMembers = (allMembers ?? []).filter(
            (m) => m.channel_id === ch.id
          );
          const names = get().staffNames;

          return {
            ...ch,
            lastMessage: lastMsg?.content ?? null,
            lastMessageAt: lastMsg?.created_at ?? null,
            unreadCount,
            memberNames: chMembers.map(
              (m) => names[m.staff_id] || m.staff_id.slice(0, 8)
            ),
            memberIds: chMembers.map((m) => m.staff_id),
          };
        })
      );

      // Sort by latest activity
      channelsWithPreview.sort((a, b) => {
        const aTime = a.lastMessageAt || a.updated_at;
        const bTime = b.lastMessageAt || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      const totalUnreadCount = channelsWithPreview.reduce(
        (sum, ch) => sum + ch.unreadCount,
        0
      );

      set({ channels: channelsWithPreview, isLoading: false, totalUnreadCount });
    } catch {
      set({ error: "Channels failed to load", isLoading: false });
    }
  },

  fetchChannelMessages: async (channelId: string) => {
    set({ isLoadingMessages: true, activeChannelId: channelId });
    try {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) {
        set({ isLoadingMessages: false });
        return;
      }

      set({
        channelMessages: (data ?? []) as ChannelMessage[],
        isLoadingMessages: false,
      });
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (
    channelId: string,
    senderId: string,
    content: string,
    mediaUrls?: unknown[],
    replyToId?: string
  ) => {
    const insertData: Record<string, unknown> = {
      channel_id: channelId,
      sender_id: senderId,
      content,
      media_urls: (mediaUrls ?? []) as any,
    };
    if (replyToId) insertData.reply_to_id = replyToId;

    const { data, error } = await supabase
      .from("channel_messages")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      console.error("[sendMessage] INSERT error:", error.message, error.code, error.details);
      set({ error: "Failed to send message" });
      return;
    }

    // Optimistic local update — append message immediately
    if (data && get().activeChannelId === channelId) {
      const msgs = get().channelMessages;
      if (!msgs.some((m) => m.id === data.id)) {
        set({ channelMessages: [...msgs, data as ChannelMessage] });
      }
    }

    // Update channel updated_at for sorting
    await supabase
      .from("channels")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", channelId);

    // Mark as read for sender
    await get().markChannelRead(channelId, senderId);
  },

  unsendMessage: async (messageId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("channel_messages")
      .update({ deleted_at: now })
      .eq("id", messageId);

    if (error) {
      console.error("[unsendMessage] error:", error.message);
      return;
    }

    // Update local state
    set({
      channelMessages: get().channelMessages.map((m) =>
        m.id === messageId ? { ...m, deleted_at: now } : m
      ),
    });
  },

  createChannel: async ({ organizationId, createdBy, type, name, memberIds }) => {
    // For DMs, check if one already exists
    if (type === "direct" && memberIds.length === 1) {
      const existing = await get().findExistingDM(createdBy, memberIds[0]);
      if (existing) return existing;
    }

    // Use RPC to atomically create channel + members (bypasses RLS chicken-and-egg)
    const { data, error } = await supabase.rpc("create_channel_with_members", {
      p_organization_id: organizationId,
      p_name: name ?? null,
      p_type: type,
      p_created_by: createdBy,
      p_member_ids: memberIds,
    });

    if (error || !data) {
      console.error("[createChannel] RPC error:", error?.message, error?.code, error?.details);
      set({ error: "Failed to create channel" });
      return null;
    }

    return data as string;
  },

  findExistingDM: async (staffId1: string, staffId2: string) => {
    // Find channels where both users are members and type is direct
    const { data: channels1 } = await supabase
      .from("channel_members")
      .select("channel_id")
      .eq("staff_id", staffId1);

    if (!channels1 || channels1.length === 0) return null;

    const channelIds = channels1.map((c) => c.channel_id);

    const { data: matches } = await supabase
      .from("channel_members")
      .select("channel_id")
      .eq("staff_id", staffId2)
      .in("channel_id", channelIds);

    if (!matches || matches.length === 0) return null;

    // Check which of these are direct channels
    const matchIds = matches.map((m) => m.channel_id);
    const { data: directChannels } = await supabase
      .from("channels")
      .select("id")
      .in("id", matchIds)
      .eq("type", "direct")
      .limit(1);

    return directChannels?.[0]?.id ?? null;
  },

  markChannelRead: async (channelId: string, staffId: string) => {
    const now = new Date().toISOString();
    await supabase
      .from("channel_members")
      .update({ last_read_at: now })
      .eq("channel_id", channelId)
      .eq("staff_id", staffId);

    // Update local state
    const channels = get().channels.map((ch) =>
      ch.id === channelId ? { ...ch, unreadCount: 0 } : ch
    );
    const totalUnreadCount = channels.reduce(
      (sum, ch) => sum + ch.unreadCount,
      0
    );
    set({ channels, totalUnreadCount });
  },

  subscribeToRealtime: (organizationId: string, staffId: string) => {
    const channel: RealtimeChannel = supabase
      .channel("channel-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
        },
        (payload) => {
          const newMsg = payload.new as ChannelMessage;
          const currentChannels = get().channels;

          // If viewing the active channel, append the message (do this first)
          if (get().activeChannelId === newMsg.channel_id) {
            const msgs = get().channelMessages;
            if (!msgs.some((m) => m.id === newMsg.id)) {
              set({ channelMessages: [...msgs, newMsg] });
            }
          }

          // Update channel preview in list (if channel is known)
          const channelIdx = currentChannels.findIndex(
            (ch) => ch.id === newMsg.channel_id
          );
          if (channelIdx === -1) return;

          const updated = [...currentChannels];
          const ch = { ...updated[channelIdx] };
          ch.lastMessage = newMsg.content;
          ch.lastMessageAt = newMsg.created_at;
          if (newMsg.sender_id !== staffId) {
            ch.unreadCount += 1;
          }
          updated[channelIdx] = ch;

          // Re-sort by latest activity
          updated.sort((a, b) => {
            const aTime = a.lastMessageAt || a.updated_at;
            const bTime = b.lastMessageAt || b.updated_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });

          const totalUnreadCount = updated.reduce(
            (sum, c) => sum + c.unreadCount,
            0
          );

          set({ channels: updated, totalUnreadCount });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_tasks",
        },
        (payload) => {
          const activeId = get().activeChannelId;
          if (!activeId) return;
          const record = (payload.new ?? payload.old) as ChannelTask;
          if (record.channel_id !== activeId) return;

          if (payload.eventType === "DELETE") {
            set({
              channelTasks: get().channelTasks.filter(
                (t) => t.id !== (payload.old as ChannelTask).id
              ),
            });
          } else if (payload.eventType === "INSERT") {
            const tasks = get().channelTasks;
            if (!tasks.some((t) => t.id === record.id)) {
              set({ channelTasks: [...tasks, record] });
            }
          } else {
            set({
              channelTasks: get().channelTasks.map((t) =>
                t.id === record.id ? record : t
              ),
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_events",
        },
        (payload) => {
          const activeId = get().activeChannelId;
          if (!activeId) return;
          const record = (payload.new ?? payload.old) as ChannelEvent;
          if (record.channel_id !== activeId) return;

          if (payload.eventType === "DELETE") {
            set({
              channelEvents: get().channelEvents.filter(
                (e) => e.id !== (payload.old as ChannelEvent).id
              ),
            });
          } else if (payload.eventType === "INSERT") {
            const events = get().channelEvents;
            if (!events.some((e) => e.id === record.id)) {
              set({ channelEvents: [...events, record] });
            }
          } else {
            set({
              channelEvents: get().channelEvents.map((e) =>
                e.id === record.id ? record : e
              ),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  resolveStaffNames: async (organizationId: string) => {
    const { data } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", organizationId);

    if (data) {
      const names: Record<string, string> = {};
      data.forEach((s: { id: string; full_name: string }) => {
        names[s.id] = s.full_name;
      });
      set({ staffNames: names });
    }
  },

  // ── Project management actions ──

  fetchChannelItems: async (channelId: string) => {
    const [{ data: tasks }, { data: events }] = await Promise.all([
      supabase
        .from("channel_tasks")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false }),
      supabase
        .from("channel_events")
        .select("*")
        .eq("channel_id", channelId)
        .order("event_at", { ascending: true }),
    ]);
    set({
      channelTasks: (tasks ?? []) as ChannelTask[],
      channelEvents: (events ?? []) as ChannelEvent[],
    });
  },

  createTask: async (
    channelId: string,
    title: string,
    createdBy: string,
    assignedTo?: string
  ) => {
    const { data, error } = await supabase
      .from("channel_tasks")
      .insert({
        channel_id: channelId,
        title,
        created_by: createdBy,
        assigned_to: assignedTo ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      set({ error: "Failed to create task" });
      return;
    }
    set({ channelTasks: [data as ChannelTask, ...get().channelTasks] });
  },

  toggleTaskComplete: async (taskId: string, staffId: string) => {
    const task = get().channelTasks.find((t) => t.id === taskId);
    if (!task) return;

    const nowCompleted = !task.is_completed;
    const updates = nowCompleted
      ? {
          is_completed: true,
          completed_by: staffId,
          completed_at: new Date().toISOString(),
        }
      : { is_completed: false, completed_by: null, completed_at: null };

    const { error } = await supabase
      .from("channel_tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) return;

    set({
      channelTasks: get().channelTasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    });
  },

  toggleTaskPin: async (taskId: string) => {
    const task = get().channelTasks.find((t) => t.id === taskId);
    if (!task) return;

    const { error } = await supabase
      .from("channel_tasks")
      .update({ is_pinned: !task.is_pinned })
      .eq("id", taskId);

    if (error) return;

    set({
      channelTasks: get().channelTasks.map((t) =>
        t.id === taskId ? { ...t, is_pinned: !t.is_pinned } : t
      ),
    });
  },

  deleteTask: async (taskId: string) => {
    const { error } = await supabase
      .from("channel_tasks")
      .delete()
      .eq("id", taskId);

    if (error) return;
    set({ channelTasks: get().channelTasks.filter((t) => t.id !== taskId) });
  },

  createEvent: async (
    channelId: string,
    title: string,
    eventAt: string,
    createdBy: string
  ) => {
    const { data, error } = await supabase
      .from("channel_events")
      .insert({
        channel_id: channelId,
        title,
        event_at: eventAt,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      set({ error: "Failed to create event" });
      return;
    }

    // Insert sorted by event_at
    const events = [...get().channelEvents, data as ChannelEvent].sort(
      (a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()
    );
    set({ channelEvents: events });
  },

  toggleEventPin: async (eventId: string) => {
    const event = get().channelEvents.find((e) => e.id === eventId);
    if (!event) return;

    const { error } = await supabase
      .from("channel_events")
      .update({ is_pinned: !event.is_pinned })
      .eq("id", eventId);

    if (error) return;

    set({
      channelEvents: get().channelEvents.map((e) =>
        e.id === eventId ? { ...e, is_pinned: !e.is_pinned } : e
      ),
    });
  },

  deleteEvent: async (eventId: string) => {
    const { error } = await supabase
      .from("channel_events")
      .delete()
      .eq("id", eventId);

    if (error) return;
    set({
      channelEvents: get().channelEvents.filter((e) => e.id !== eventId),
    });
  },

  updateChannelPriority: async (channelId, priority) => {
    const { error } = await supabase
      .from("channels")
      .update({ priority })
      .eq("id", channelId);

    if (error) return;

    const channels = get().channels.map((ch) =>
      ch.id === channelId ? { ...ch, priority } : ch
    );
    set({ channels });
  },

  // ── Search ──

  searchChannelMessages: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      // Search across all channels the user is a member of
      const channelIds = get().channels.map((ch) => ch.id);
      if (channelIds.length === 0) {
        set({ searchResults: [], isSearching: false });
        return;
      }

      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .in("channel_id", channelIds)
        .ilike("content", `%${query}%`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        set({ isSearching: false });
        return;
      }

      set({ searchResults: (data ?? []) as ChannelMessage[], isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  clearSearchResults: () => {
    set({ searchResults: [], isSearching: false });
  },

  // ── Member management ──

  addChannelMember: async (channelId: string, staffId: string) => {
    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: channelId, staff_id: staffId });

    if (error) {
      console.error("[addChannelMember] error:", error.message);
      return;
    }

    // Update local channel memberIds
    const channels = get().channels.map((ch) => {
      if (ch.id === channelId && !ch.memberIds.includes(staffId)) {
        return {
          ...ch,
          memberIds: [...ch.memberIds, staffId],
          memberNames: [...ch.memberNames, get().staffNames[staffId] || staffId.slice(0, 8)],
        };
      }
      return ch;
    });
    set({ channels });
  },

  removeChannelMember: async (channelId: string, staffId: string) => {
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("staff_id", staffId);

    if (error) {
      console.error("[removeChannelMember] error:", error.message);
      return;
    }

    // Update local channel memberIds
    const channels = get().channels.map((ch) => {
      if (ch.id === channelId) {
        const idx = ch.memberIds.indexOf(staffId);
        if (idx !== -1) {
          const newIds = [...ch.memberIds];
          const newNames = [...ch.memberNames];
          newIds.splice(idx, 1);
          newNames.splice(idx, 1);
          return { ...ch, memberIds: newIds, memberNames: newNames };
        }
      }
      return ch;
    });
    set({ channels });
  },

  // ── Read receipts ──

  fetchChannelMemberReads: async (channelId: string) => {
    const { data } = await supabase
      .from("channel_members")
      .select("staff_id, last_read_at")
      .eq("channel_id", channelId);

    if (data) {
      const readTimes: Record<string, string> = {};
      data.forEach((m: { staff_id: string; last_read_at: string }) => {
        readTimes[m.staff_id] = m.last_read_at;
      });
      set({ channelMemberReadTimes: readTimes });
    }
  },
}));

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Announcement, AnnouncementRecipient } from "@/types/database";

export interface AnnouncementWithRecipient extends Announcement {
  recipient?: AnnouncementRecipient;
}

export interface AnalyticsSummary {
  total: number;
  viewed: number;
  responded: number;
  dismissed: number;
  pending: number;
  response_breakdown: Record<string, number>;
}

interface CreateAnnouncementParams {
  organizationId: string;
  title: string;
  body: string;
  createdBy: string;
  priority?: "normal" | "urgent";
  mediaUrls?: { type: string; url: string; file_name?: string }[];
  targetType?: "all" | "by_class" | "individual";
  targetClassIds?: string[];
  targetParentIds?: string[];
  responseOptions?: string[] | null;
  allowFreeText?: boolean;
  expiresAt?: string | null;
}

interface AnnouncementsState {
  // Parent side
  announcements: AnnouncementWithRecipient[];
  isLoading: boolean;
  unreadCount: number;

  // Staff side
  staffAnnouncements: Announcement[];
  isLoadingStaff: boolean;
  analytics: Record<string, AnalyticsSummary>;
  recipientDetails: Record<string, (AnnouncementRecipient & { parentName: string })[]>;

  // Parent actions
  fetchParentAnnouncements: (
    organizationId: string,
    parentId: string
  ) => Promise<void>;
  markViewed: (announcementId: string, parentId: string) => Promise<void>;
  respondToAnnouncement: (
    announcementId: string,
    parentId: string,
    responseValue: string,
    freeTextValue?: string
  ) => Promise<void>;
  dismissAnnouncement: (
    announcementId: string,
    parentId: string
  ) => Promise<void>;

  // Staff actions
  fetchStaffAnnouncements: (organizationId: string) => Promise<void>;
  createAnnouncement: (params: CreateAnnouncementParams) => Promise<string | null>;
  fetchAnalytics: (announcementId: string) => Promise<void>;
  fetchRecipientDetails: (announcementId: string) => Promise<void>;
}

export const useAnnouncementsStore = create<AnnouncementsState>((set, get) => ({
  // Initial state
  announcements: [],
  isLoading: false,
  unreadCount: 0,
  staffAnnouncements: [],
  isLoadingStaff: false,
  analytics: {},
  recipientDetails: {},

  // ─── Parent actions ───

  fetchParentAnnouncements: async (organizationId, parentId) => {
    set({ isLoading: true });

    // Fetch recipient records for this parent
    const { data: recipients, error: recErr } = await supabase
      .from("announcement_recipients")
      .select("*")
      .eq("parent_id", parentId);

    if (recErr) {
      console.error("[fetchParentAnnouncements] recipients error:", recErr.message);
      set({ isLoading: false });
      return;
    }

    if (!recipients || recipients.length === 0) {
      set({ announcements: [], unreadCount: 0, isLoading: false });
      return;
    }

    const announcementIds = recipients.map((r) => r.announcement_id);

    // Fetch the actual announcements
    const { data: announcements, error: annErr } = await supabase
      .from("announcements")
      .select("*")
      .in("id", announcementIds)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (annErr) {
      console.error("[fetchParentAnnouncements] announcements error:", annErr.message);
      set({ isLoading: false });
      return;
    }

    // Merge announcements with their recipient records
    const now = new Date();
    const merged: AnnouncementWithRecipient[] = (announcements ?? [])
      .filter((a) => {
        // Filter out expired announcements
        if (a.expires_at && new Date(a.expires_at) < now) return false;
        return true;
      })
      .map((a) => ({
        ...a,
        recipient: recipients.find((r) => r.announcement_id === a.id),
      })) as AnnouncementWithRecipient[];

    const unreadCount = merged.filter(
      (a) => a.recipient?.status === "sent"
    ).length;

    set({ announcements: merged, unreadCount, isLoading: false });
  },

  markViewed: async (announcementId, parentId) => {
    const { error } = await supabase
      .from("announcement_recipients")
      .update({
        status: "viewed",
        viewed_at: new Date().toISOString(),
      })
      .eq("announcement_id", announcementId)
      .eq("parent_id", parentId)
      .eq("status", "sent"); // Only update if currently 'sent'

    if (error) {
      console.error("[markViewed] error:", error.message);
      return;
    }

    // Update local state
    const announcements = get().announcements.map((a) => {
      if (a.id === announcementId && a.recipient?.status === "sent") {
        return {
          ...a,
          recipient: {
            ...a.recipient!,
            status: "viewed" as const,
            viewed_at: new Date().toISOString(),
          },
        };
      }
      return a;
    });

    const unreadCount = announcements.filter(
      (a) => a.recipient?.status === "sent"
    ).length;

    set({ announcements, unreadCount });
  },

  respondToAnnouncement: async (
    announcementId,
    parentId,
    responseValue,
    freeTextValue
  ) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("announcement_recipients")
      .update({
        status: "responded",
        response_value: responseValue,
        free_text_value: freeTextValue || null,
        responded_at: now,
        viewed_at: now, // Also mark as viewed
      })
      .eq("announcement_id", announcementId)
      .eq("parent_id", parentId);

    if (error) {
      console.error("[respondToAnnouncement] error:", error.message);
      return;
    }

    // Update local state
    const announcements = get().announcements.map((a) => {
      if (a.id === announcementId) {
        return {
          ...a,
          recipient: {
            ...a.recipient!,
            status: "responded" as const,
            response_value: responseValue,
            free_text_value: freeTextValue || null,
            responded_at: now,
            viewed_at: a.recipient?.viewed_at || now,
          },
        };
      }
      return a;
    });

    const unreadCount = announcements.filter(
      (a) => a.recipient?.status === "sent"
    ).length;

    set({ announcements, unreadCount });
  },

  dismissAnnouncement: async (announcementId, parentId) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("announcement_recipients")
      .update({
        status: "dismissed",
        dismissed_at: now,
        viewed_at: now,
      })
      .eq("announcement_id", announcementId)
      .eq("parent_id", parentId);

    if (error) {
      console.error("[dismissAnnouncement] error:", error.message);
      return;
    }

    // Update local state
    const announcements = get().announcements.map((a) => {
      if (a.id === announcementId) {
        return {
          ...a,
          recipient: {
            ...a.recipient!,
            status: "dismissed" as const,
            dismissed_at: now,
            viewed_at: a.recipient?.viewed_at || now,
          },
        };
      }
      return a;
    });

    const unreadCount = announcements.filter(
      (a) => a.recipient?.status === "sent"
    ).length;

    set({ announcements, unreadCount });
  },

  // ─── Staff actions ───

  fetchStaffAnnouncements: async (organizationId) => {
    set({ isLoadingStaff: true });

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[fetchStaffAnnouncements] error:", error.message);
      set({ isLoadingStaff: false });
      return;
    }

    set({ staffAnnouncements: (data ?? []) as Announcement[], isLoadingStaff: false });
  },

  createAnnouncement: async (params) => {
    const { error, data } = await supabase
      .from("announcements")
      .insert({
        organization_id: params.organizationId,
        title: params.title,
        body: params.body,
        created_by: params.createdBy,
        priority: params.priority || "normal",
        media_urls: params.mediaUrls || [],
        target_type: params.targetType || "all",
        target_class_ids: params.targetClassIds || [],
        target_parent_ids: params.targetParentIds || [],
        response_options: params.responseOptions || null,
        allow_free_text: params.allowFreeText || false,
        expires_at: params.expiresAt || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createAnnouncement] error:", error.message);
      return null;
    }

    // Populate recipient rows via RPC
    const { error: rpcError } = await supabase.rpc(
      "populate_announcement_recipients",
      { p_announcement_id: data.id }
    );

    if (rpcError) {
      console.error("[createAnnouncement] populate error:", rpcError.message);
    }

    return data.id;
  },

  fetchAnalytics: async (announcementId) => {
    const { data, error } = await supabase.rpc("get_announcement_analytics", {
      p_announcement_id: announcementId,
    });

    if (error) {
      console.error("[fetchAnalytics] error:", error.message);
      return;
    }

    const analytics = get().analytics;
    set({
      analytics: {
        ...analytics,
        [announcementId]: data as AnalyticsSummary,
      },
    });
  },

  fetchRecipientDetails: async (announcementId) => {
    // Fetch recipients with parent names
    const { data: recipients, error: recErr } = await supabase
      .from("announcement_recipients")
      .select("*")
      .eq("announcement_id", announcementId)
      .order("updated_at", { ascending: false });

    if (recErr) {
      console.error("[fetchRecipientDetails] error:", recErr.message);
      return;
    }

    // Fetch parent names
    const parentIds = (recipients ?? []).map((r) => r.parent_id);
    const { data: parents } = await supabase
      .from("parents")
      .select("id, full_name")
      .in("id", parentIds);

    const parentNameMap: Record<string, string> = {};
    (parents ?? []).forEach((p: { id: string; full_name: string }) => {
      parentNameMap[p.id] = p.full_name;
    });

    const details = (recipients ?? []).map((r) => ({
      ...r,
      parentName: parentNameMap[r.parent_id] || r.parent_id.slice(0, 8),
    })) as (AnnouncementRecipient & { parentName: string })[];

    set({
      recipientDetails: {
        ...get().recipientDetails,
        [announcementId]: details,
      },
    });
  },
}));

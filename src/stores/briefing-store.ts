import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface BriefingItem {
  text: string;
  detail?: string;
}

export interface BriefingSection {
  type: "urgent" | "fees" | "tasks" | "insights";
  title: string;
  items: BriefingItem[];
}

export interface BriefingContent {
  summary: string;
  sections: BriefingSection[];
  generatedAt: string;
}

interface BriefingState {
  morningBrief: BriefingContent | null;
  weeklyReport: BriefingContent | null;
  isLoadingMorning: boolean;
  isLoadingWeekly: boolean;
  error: string | null;

  fetchMorningBrief: (force?: boolean) => Promise<void>;
  fetchWeeklyReport: (force?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useBriefingStore = create<BriefingState>((set) => ({
  morningBrief: null,
  weeklyReport: null,
  isLoadingMorning: false,
  isLoadingWeekly: false,
  error: null,

  fetchMorningBrief: async (force = false) => {
    set({ isLoadingMorning: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("generate-briefing", {
        body: { type: "morning", force },
      });
      if (error) throw error;
      set({ morningBrief: data.content as BriefingContent, isLoadingMorning: false });
    } catch (err: any) {
      console.error("[briefing-store] fetchMorningBrief error:", err);
      set({ error: err?.message ?? "Failed to generate briefing", isLoadingMorning: false });
    }
  },

  fetchWeeklyReport: async (force = false) => {
    set({ isLoadingWeekly: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke("generate-briefing", {
        body: { type: "weekly", force },
      });
      if (error) throw error;
      set({ weeklyReport: data.content as BriefingContent, isLoadingWeekly: false });
    } catch (err: any) {
      console.error("[briefing-store] fetchWeeklyReport error:", err);
      set({ error: err?.message ?? "Failed to generate report", isLoadingWeekly: false });
    }
  },

  clearError: () => set({ error: null }),
}));

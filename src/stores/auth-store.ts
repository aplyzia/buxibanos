import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Staff, Parent } from "@/types/database";
import i18n from "@/i18n";

type UserRole = "director" | "teacher" | "admin" | "front_desk" | "parent";
export type SubscriptionTier = "starter" | "standard" | "premium";

interface AuthState {
  session: Session | null;
  role: UserRole | null;
  profile: Staff | Parent | null;
  organizationId: string | null;
  subscriptionTier: SubscriptionTier | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  role: null,
  profile: null,
  organizationId: null,
  subscriptionTier: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        set({ session });
        await resolveRole(session.user.id, set);
      }
    } catch {
      set({ error: i18n.t("auth.initError") });
    } finally {
      set({ isLoading: false });
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) {
        await resolveRole(session.user.id, set);
      } else {
        set({ role: null, profile: null, organizationId: null, subscriptionTier: null });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        set({ error: i18n.t("auth.signInError"), isLoading: false });
      }
      // Session will be set by onAuthStateChange listener
    } catch {
      set({ error: i18n.t("auth.networkError"), isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      session: null,
      role: null,
      profile: null,
      organizationId: null,
      subscriptionTier: null,
      isLoading: false,
      error: null,
    });
  },

  setSession: (session: Session | null) => {
    set({ session });
  },
}));

async function resolveRole(
  userId: string,
  set: (state: Partial<AuthState>) => void
) {
  // Check staff table first
  const { data: staffRow } = await supabase
    .from("staff")
    .select("*")
    .eq("supabase_user_id", userId)
    .eq("is_active", true)
    .single();

  if (staffRow) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", staffRow.organization_id)
      .single();
    set({
      role: staffRow.role as UserRole,
      profile: staffRow,
      organizationId: staffRow.organization_id,
      subscriptionTier: (orgRow?.subscription_tier ?? null) as SubscriptionTier | null,
      isLoading: false,
    });
    return;
  }

  // Check parent table
  const { data: parentRow } = await supabase
    .from("parents")
    .select("*")
    .eq("supabase_user_id", userId)
    .single();

  if (parentRow) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", parentRow.organization_id)
      .single();
    set({
      role: "parent",
      profile: parentRow,
      organizationId: parentRow.organization_id,
      subscriptionTier: (orgRow?.subscription_tier ?? null) as SubscriptionTier | null,
      isLoading: false,
    });
    return;
  }

  // No role found — sign out
  set({ error: i18n.t("auth.noAccountFound"), isLoading: false });
  await supabase.auth.signOut();
}

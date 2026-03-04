import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Task } from "@/types/database";
import { RealtimeChannel } from "@supabase/supabase-js";

type StatusFilter = "pending" | "completed" | "all";

interface TasksState {
  tasks: Task[];
  filteredTasks: Task[];
  statusFilter: StatusFilter;
  isLoading: boolean;
  error: string | null;

  // Derived counts
  pendingCount: number;

  // Staff name cache (staff.id → full_name)
  staffNames: Record<string, string>;

  // Actions
  fetchTasks: (organizationId: string) => Promise<void>;
  fetchMyTasks: (organizationId: string, staffId: string) => Promise<void>;
  completeTask: (taskId: string, staffId: string) => Promise<void>;
  dismissTask: (taskId: string, staffId: string) => Promise<void>;
  createTask: (task: {
    organizationId: string;
    title: string;
    description?: string;
    priority: "high" | "medium" | "low";
    assignedTo?: string;
  }) => Promise<void>;
  setStatusFilter: (filter: StatusFilter) => void;
  subscribeToRealtime: (organizationId: string) => () => void;
  resolveStaffNames: (organizationId: string) => Promise<void>;
}

function deriveCountsAndFilter(tasks: Task[], filter: StatusFilter) {
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return { filteredTasks: filtered, pendingCount };
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  filteredTasks: [],
  statusFilter: "pending",
  isLoading: false,
  error: null,
  pendingCount: 0,
  staffNames: {},

  fetchTasks: async (organizationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        set({ error: "Tasks failed to load", isLoading: false });
        return;
      }

      const tasks = (data ?? []) as Task[];
      const derived = deriveCountsAndFilter(tasks, get().statusFilter);
      set({ tasks, ...derived, isLoading: false });
    } catch {
      set({ error: "Tasks failed to load", isLoading: false });
    }
  },

  fetchMyTasks: async (organizationId: string, staffId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("assigned_to", staffId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        set({ error: "Tasks failed to load", isLoading: false });
        return;
      }

      const tasks = (data ?? []) as Task[];
      const derived = deriveCountsAndFilter(tasks, get().statusFilter);
      set({ tasks, ...derived, isLoading: false });
    } catch {
      set({ error: "Tasks failed to load", isLoading: false });
    }
  },

  completeTask: async (taskId: string, staffId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_by: staffId,
        completed_at: now,
      })
      .eq("id", taskId);

    if (error) {
      set({ error: "Failed to complete task" });
      return;
    }

    const current = get().tasks;
    const updated = current.map((t) =>
      t.id === taskId
        ? { ...t, status: "completed" as const, completed_by: staffId, completed_at: now }
        : t
    );
    const derived = deriveCountsAndFilter(updated, get().statusFilter);
    set({ tasks: updated, ...derived });
  },

  dismissTask: async (taskId: string, staffId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "dismissed",
        completed_by: staffId,
        completed_at: now,
      })
      .eq("id", taskId);

    if (error) {
      set({ error: "Failed to dismiss task" });
      return;
    }

    const current = get().tasks;
    const updated = current.map((t) =>
      t.id === taskId
        ? { ...t, status: "dismissed" as const, completed_by: staffId, completed_at: now }
        : t
    );
    const derived = deriveCountsAndFilter(updated, get().statusFilter);
    set({ tasks: updated, ...derived });
  },

  createTask: async ({ organizationId, title, description, priority, assignedTo }) => {
    const { error } = await supabase.from("tasks").insert({
      organization_id: organizationId,
      title,
      description: description ?? null,
      source_type: "manual" as const,
      source_message_id: null,
      source_student_id: null,
      priority,
      status: "pending" as const,
      assigned_to: assignedTo ?? null,
      completed_by: null,
      completed_at: null,
    });

    if (error) {
      set({ error: "Failed to create task" });
      return;
    }

    // Re-fetch to get the new task with server-generated fields
    await get().fetchTasks(organizationId);
  },

  setStatusFilter: (filter: StatusFilter) => {
    const derived = deriveCountsAndFilter(get().tasks, filter);
    set({ statusFilter: filter, ...derived });
  },

  subscribeToRealtime: (organizationId: string) => {
    const channel: RealtimeChannel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const current = get().tasks;

          if (payload.eventType === "INSERT") {
            const newTask = payload.new as Task;
            if (current.some((t) => t.id === newTask.id)) return;
            const updated = [newTask, ...current];
            const derived = deriveCountsAndFilter(updated, get().statusFilter);
            set({ tasks: updated, ...derived });
          }

          if (payload.eventType === "UPDATE") {
            const updatedTask = payload.new as Task;
            const updated = current.map((t) =>
              t.id === updatedTask.id ? updatedTask : t
            );
            const derived = deriveCountsAndFilter(updated, get().statusFilter);
            set({ tasks: updated, ...derived });
          }

          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            const updated = current.filter((t) => t.id !== deletedId);
            const derived = deriveCountsAndFilter(updated, get().statusFilter);
            set({ tasks: updated, ...derived });
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
}));

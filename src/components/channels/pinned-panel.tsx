import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Pin,
  CheckSquare,
  Square,
  Calendar,
  Trash2,
  PinOff,
  Plus,
} from "lucide-react-native";
import { useTheme } from "@/theme";
import type { ChannelTask, ChannelEvent } from "@/types/database";
import { useChannelsStore } from "@/stores/channels-store";
import AddTaskForm from "./add-task-form";
import AddEventForm from "./add-event-form";

interface PinnedPanelProps {
  tasks: ChannelTask[];
  events: ChannelEvent[];
  channelId: string;
  staffId: string;
  staffNames: Record<string, string>;
  memberIds: string[];
}

export default function PinnedPanel({
  tasks,
  events,
  channelId,
  staffId,
  staffNames,
  memberIds,
}: PinnedPanelProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    toggleTaskComplete,
    toggleTaskPin,
    deleteTask,
    toggleEventPin,
    deleteEvent,
  } = useChannelsStore();

  const [expanded, setExpanded] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const pinnedTasks = tasks
    .filter((t) => t.is_pinned)
    .sort((a, b) => {
      // Incomplete before completed
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      // Assigned to me first
      const aIsMine = a.assigned_to === staffId ? 0 : 1;
      const bIsMine = b.assigned_to === staffId ? 0 : 1;
      if (aIsMine !== bIsMine) return aIsMine - bIsMine;
      // Unassigned next
      const aUnassigned = !a.assigned_to ? 0 : 1;
      const bUnassigned = !b.assigned_to ? 0 : 1;
      if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
      return 0;
    });
  const pinnedEvents = events.filter((e) => e.is_pinned);
  const pinnedCount = pinnedTasks.length + pinnedEvents.length;

  if (pinnedCount === 0 && !showAddTask && !showAddEvent) {
    return (
      <View
        className="mx-3 mt-1 mb-1 px-4 py-2 rounded-xl flex-row items-center justify-between"
        style={[
          {
            backgroundColor: colors.cardBg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
          },
          Platform.OS === "web"
            ? ({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any)
            : {},
        ]}
      >
        <View className="flex-row items-center">
          <Pin size={14} color={colors.textMuted} />
          <Text className="text-xs ml-1.5" style={{ color: colors.textMuted }}>
            {t("channels.noPinnedItems")}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setShowAddTask(true)}
            className="px-2 py-1 rounded-lg active:opacity-70"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="text-[11px] font-medium" style={{ color: colors.accentColor }}>
              + {t("channels.addTask")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowAddEvent(true)}
            className="px-2 py-1 rounded-lg active:opacity-70"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="text-[11px] font-medium" style={{ color: colors.accentColor }}>
              + {t("channels.addEvent")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const confirmDelete = (type: "task" | "event", id: string) => {
    if (Platform.OS === "web") {
      if (type === "task") deleteTask(id);
      else deleteEvent(id);
      setActiveMenu(null);
      return;
    }
    Alert.alert(t("channels.delete"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("channels.delete"),
        style: "destructive",
        onPress: () => {
          if (type === "task") deleteTask(id);
          else deleteEvent(id);
          setActiveMenu(null);
        },
      },
    ]);
  };

  return (
    <View
      className="mx-3 mt-1 mb-1 rounded-xl overflow-hidden"
      style={[
        {
          backgroundColor: colors.cardBg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any)
          : {},
      ]}
    >
      {/* Header row */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="px-4 py-2.5 flex-row items-center justify-between active:opacity-80"
      >
        <View className="flex-row items-center">
          <Pin size={14} color={colors.accentColor} />
          <Text className="text-sm font-semibold ml-1.5" style={{ color: colors.textPrimary }}>
            {t("channels.pinnedItems")} ({pinnedCount})
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {expanded && (
            <>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setShowAddTask(true);
                }}
                className="px-2 py-1 rounded-lg active:opacity-70"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Text
                  className="text-[11px] font-medium"
                  style={{ color: colors.accentColor }}
                >
                  + {t("channels.addTask")}
                </Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setShowAddEvent(true);
                }}
                className="px-2 py-1 rounded-lg active:opacity-70"
                style={{ backgroundColor: colors.accentBg }}
              >
                <Text
                  className="text-[11px] font-medium"
                  style={{ color: colors.accentColor }}
                >
                  + {t("channels.addEvent")}
                </Text>
              </Pressable>
            </>
          )}
          {expanded ? (
            <ChevronUp size={16} color={colors.textMuted} />
          ) : (
            <ChevronDown size={16} color={colors.textMuted} />
          )}
        </View>
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <View className="px-4 pb-3">
          {/* Pinned tasks */}
          {pinnedTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => toggleTaskComplete(task.id, staffId)}
              onLongPress={() =>
                setActiveMenu(activeMenu === task.id ? null : task.id)
              }
              className="flex-row items-center py-1.5"
            >
              {task.is_completed ? (
                <CheckSquare size={18} color={colors.successText} />
              ) : (
                <Square size={18} color={colors.textMuted} />
              )}
              <Text
                className="flex-1 text-sm ml-2"
                style={[
                  { color: colors.textPrimary },
                  task.is_completed && {
                    textDecorationLine: "line-through",
                    color: colors.textMuted,
                  },
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              {task.assigned_to && (
                <Text
                  className="text-xs ml-2"
                  style={{ color: colors.accentColor }}
                >
                  {staffNames[task.assigned_to] || task.assigned_to.slice(0, 8)}
                </Text>
              )}
              {task.is_completed && task.completed_by && (
                <Text className="text-xs ml-1" style={{ color: colors.successText }}>
                  {staffNames[task.completed_by]?.charAt(0) || ""}
                </Text>
              )}

              {/* Context menu */}
              {activeMenu === task.id && (
                <View className="flex-row items-center gap-1 ml-2">
                  <Pressable
                    onPress={() => {
                      toggleTaskPin(task.id);
                      setActiveMenu(null);
                    }}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: colors.surfaceBg }}
                  >
                    <PinOff size={14} color={colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete("task", task.id)}
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: colors.errorBg }}
                  >
                    <Trash2 size={14} color={colors.errorText} />
                  </Pressable>
                </View>
              )}
            </Pressable>
          ))}

          {/* Pinned events */}
          {pinnedEvents.map((event) => {
            const eventDate = new Date(event.event_at);
            const isPast = eventDate.getTime() < Date.now();
            const formatted = eventDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Pressable
                key={event.id}
                onLongPress={() =>
                  setActiveMenu(
                    activeMenu === event.id ? null : event.id
                  )
                }
                className="flex-row items-center py-1.5"
              >
                <Calendar
                  size={18}
                  color={isPast ? colors.textMuted : colors.warningText}
                />
                <Text
                  className="flex-1 text-sm ml-2"
                  style={{
                    color: isPast ? colors.textMuted : colors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {event.title}
                </Text>
                <Text
                  className="text-xs ml-2"
                  style={{
                    color: isPast ? colors.textMuted : colors.warningText,
                  }}
                >
                  {formatted}
                </Text>

                {/* Context menu */}
                {activeMenu === event.id && (
                  <View className="flex-row items-center gap-1 ml-2">
                    <Pressable
                      onPress={() => {
                        toggleEventPin(event.id);
                        setActiveMenu(null);
                      }}
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: colors.surfaceBg }}
                    >
                      <PinOff size={14} color={colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete("event", event.id)}
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: colors.errorBg }}
                    >
                      <Trash2 size={14} color={colors.errorText} />
                    </Pressable>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Inline add task form */}
      {showAddTask && (
        <AddTaskForm
          channelId={channelId}
          staffId={staffId}
          staffNames={staffNames}
          memberIds={memberIds}
          onClose={() => setShowAddTask(false)}
        />
      )}

      {/* Inline add event form */}
      {showAddEvent && (
        <AddEventForm
          channelId={channelId}
          staffId={staffId}
          onClose={() => setShowAddEvent(false)}
        />
      )}
    </View>
  );
}

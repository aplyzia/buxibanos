import { useEffect, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useTasksStore } from "@/stores/tasks-store";
import { StatusFilterBar } from "@/components/tasks/status-filter";
import { LanguageToggle } from "@/components/common/language-toggle";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";
import type { Task } from "@/types/database";

export default function TeacherTasksScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const {
    filteredTasks,
    statusFilter,
    isLoading,
    error,
    staffNames,
    fetchMyTasks,
    completeTask,
    dismissTask,
    setStatusFilter,
    subscribeToRealtime,
    resolveStaffNames,
  } = useTasksStore();

  const staffId = profile && "id" in profile ? (profile as { id: string }).id : null;

  useEffect(() => {
    if (!organizationId || !staffId) return;
    fetchMyTasks(organizationId, staffId);
    resolveStaffNames(organizationId);
    const unsubscribe = subscribeToRealtime(organizationId);
    return unsubscribe;
  }, [organizationId, staffId]);

  useFocusEffect(
    useCallback(() => {
      if (organizationId && staffId) fetchMyTasks(organizationId, staffId);
    }, [organizationId, staffId])
  );

  const handleComplete = (taskId: string) => {
    if (staffId) completeTask(taskId, staffId);
  };

  const handleDismiss = (taskId: string) => {
    if (staffId) dismissTask(taskId, staffId);
  };

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-2 px-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            {t("tasks.title")}
          </Text>
          <View className="flex-row items-center gap-2">
            <LanguageToggle />
            <Pressable
              onPress={signOut}
              className="px-3 py-1.5 rounded-full active:opacity-70"
              style={{
                backgroundColor: colors.surfaceBg,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {t("auth.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Status filter */}
      <StatusFilterBar active={statusFilter} onChange={setStatusFilter} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
          <Text className="text-sm mt-2" style={{ color: colors.textMuted }}>
            {t("common.loading")}
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>
            {error}
          </Text>
          <Pressable
            onPress={() => organizationId && staffId && fetchMyTasks(organizationId, staffId)}
            className="mt-4 px-6 py-2 rounded-lg"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="font-medium" style={{ color: colors.textPrimary }}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          refreshing={isLoading}
          onRefresh={() => organizationId && staffId && fetchMyTasks(organizationId, staffId)}
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
              staffNames={staffNames}
              colors={colors}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-4xl mb-3">
                {statusFilter === "pending" ? "🎉" : "📋"}
              </Text>
              <Text className="text-base" style={{ color: colors.textMuted }}>
                {statusFilter === "pending"
                  ? t("tasks.noTasks")
                  : t("tasks.noTasksInFilter")}
              </Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

function TaskRow({
  task,
  onComplete,
  onDismiss,
  staffNames,
  colors,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  staffNames: Record<string, string>;
  colors: ThemeColors;
}) {
  const { t } = useTranslation();

  const priorityColors = {
    high: colors.highText,
    medium: colors.mediumText,
    low: colors.lowText,
  } as const;

  const priorityBgColors = {
    high: colors.highBg,
    medium: colors.mediumBg,
    low: colors.lowBg,
  } as const;

  return (
    <View className="mx-4 mb-3">
      <GlassCard className="p-4">
        {/* Top row: priority + source + status */}
        <View className="flex-row items-center gap-2 mb-2">
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: priorityBgColors[task.priority] }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: priorityColors[task.priority] }}
            >
              {t(`priority.${task.priority}`)}
            </Text>
          </View>
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: colors.surfaceBg }}
          >
            <Text className="text-xs" style={{ color: colors.textTertiary }}>
              {t(`taskSource.${task.source_type}`)}
            </Text>
          </View>
          {task.status !== "pending" && (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  task.status === "completed"
                    ? colors.respondedBg
                    : colors.surfaceBg,
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color:
                    task.status === "completed"
                      ? colors.respondedText
                      : colors.textTertiary,
                }}
              >
                {t(`tasks.${task.status}`)}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text
          className="text-base font-medium mb-1"
          style={{ color: colors.textPrimary }}
        >
          {task.title}
        </Text>

        {/* Description */}
        {task.description && (
          <Text
            className="text-sm mb-2"
            numberOfLines={2}
            style={{ color: colors.textTertiary }}
          >
            {task.description}
          </Text>
        )}

        {/* Completion info */}
        {task.status !== "pending" && task.completed_by && (
          <View className="mb-2">
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {t(`tasks.${task.status}`)}{" "}
              {t("tasks.completedBy")}{" "}
              {staffNames[task.completed_by] ?? task.completed_by.slice(0, 8)}
              {task.completed_at && (
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {" · "}
                  {new Date(task.completed_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(task.completed_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
            </Text>
          </View>
        )}

        {/* Bottom row: actions */}
        {task.status === "pending" && (
          <View className="flex-row items-center justify-end gap-2">
            <Pressable
              onPress={() => onDismiss(task.id)}
              className="px-3 py-1.5 rounded-lg active:opacity-80"
              style={{
                backgroundColor: colors.surfaceBg,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: colors.textTertiary }}
              >
                {t("tasks.dismiss")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onComplete(task.id)}
              className="px-4 py-1.5 rounded-lg active:opacity-80"
              style={{ backgroundColor: colors.accentBg }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: colors.textPrimary }}
              >
                {t("tasks.markComplete")}
              </Text>
            </Pressable>
          </View>
        )}
      </GlassCard>
    </View>
  );
}

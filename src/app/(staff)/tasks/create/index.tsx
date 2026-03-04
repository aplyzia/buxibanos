import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useTasksStore } from "@/stores/tasks-store";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

type Priority = "high" | "medium" | "low";

export default function CreateTaskScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const createTask = useTasksStore((s) => s.createTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim() || !organizationId) return;

    setIsCreating(true);
    setError(null);

    await createTask({
      organizationId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });

    const storeError = useTasksStore.getState().error;
    if (storeError) {
      setError(storeError);
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    router.back();
  };

  const isDisabled = isCreating || !title.trim();

  const priorities: Priority[] = ["high", "medium", "low"];
  const priorityBgColors: Record<Priority, string> = {
    high: colors.highBg,
    medium: colors.mediumBg,
    low: colors.lowBg,
  };
  const priorityTextColors: Record<Priority, string> = {
    high: colors.highText,
    medium: colors.mediumText,
    low: colors.lowText,
  };

  return (
    <GlassBackground variant="staff">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="pt-14 pb-3 px-4 flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/tasks" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text
            className="text-lg font-bold"
            style={{ color: colors.textPrimary }}
          >
            {t("tasks.createTitle")}
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Title field */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {t("tasks.titleField")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              }}
              placeholder={t("tasks.titlePlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={title}
              onChangeText={setTitle}
              editable={!isCreating}
            />
          </View>

          {/* Description field */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {t("tasks.descriptionField")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                minHeight: 100,
                color: colors.textPrimary,
              }}
              placeholder={t("tasks.descriptionPlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={description}
              onChangeText={setDescription}
              editable={!isCreating}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Priority picker */}
          <View className="mb-6">
            <Text
              className="text-sm font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {t("tasks.priorityField")}
            </Text>
            <View className="flex-row gap-2">
              {priorities.map((p) => {
                const isActive = priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    className="flex-1 py-2.5 rounded-xl items-center active:opacity-80"
                    style={{
                      backgroundColor: isActive
                        ? priorityBgColors[p]
                        : colors.surfaceBg,
                      borderWidth: 1.5,
                      borderColor: isActive
                        ? priorityTextColors[p]
                        : colors.surfaceBorder,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color: isActive
                          ? priorityTextColors[p]
                          : colors.textTertiary,
                      }}
                    >
                      {t(`priority.${p}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Error */}
          {error && (
            <GlassCard className="px-4 py-3 mb-4">
              <Text
                className="text-sm text-center"
                style={{ color: colors.errorText }}
              >
                {error}
              </Text>
            </GlassCard>
          )}

          {/* Create button */}
          <Pressable
            onPress={handleCreate}
            disabled={isDisabled}
            className={`rounded-xl py-4 items-center ${
              isDisabled ? "opacity-40" : "active:opacity-80"
            }`}
            style={{
              backgroundColor: isDisabled ? colors.surfaceBg : colors.accentBg,
              borderWidth: 1,
              borderColor: isDisabled ? colors.surfaceBg : colors.accentColor,
            }}
          >
            {isCreating ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.textPrimary} />
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("tasks.creating")}
                </Text>
              </View>
            ) : (
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {t("tasks.create")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

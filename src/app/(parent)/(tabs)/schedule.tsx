import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/common/language-toggle";
import { Class, Parent } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme, type ThemeColors } from "@/theme";

const DAY_KEYS: Record<string, string> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
};

export default function ParentScheduleScreen() {
  const { t } = useTranslation();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();

  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    if (!organizationId || !profile) return;
    setIsLoading(true);
    setError(null);

    const studentIds = (profile as Parent).student_ids ?? [];
    if (studentIds.length === 0) {
      setClasses([]);
      setIsLoading(false);
      return;
    }

    const { data: students } = await supabase
      .from("students")
      .select("class_ids")
      .in("id", studentIds);

    const classIds = (students ?? []).flatMap(
      (s: { class_ids: string[] }) => s.class_ids
    );
    const uniqueClassIds = [...new Set(classIds)];

    if (uniqueClassIds.length === 0) {
      setClasses([]);
      setIsLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("classes")
      .select("*")
      .in("id", uniqueClassIds)
      .eq("is_active", true);

    if (fetchError) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    setClasses((data ?? []) as Class[]);
    setIsLoading(false);
  }, [organizationId, profile]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return (
    <GlassBackground variant="parent">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t("schedule.title")}</Text>
          <View className="flex-row items-center gap-2">
            <LanguageToggle />
            <Pressable
              onPress={signOut}
              className="px-3 py-1.5 rounded-full active:opacity-70"
              style={{ backgroundColor: colors.surfaceBorder, borderWidth: 1, borderColor: colors.surfaceBorder }}
            >
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {t("auth.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View className="mx-4 mb-3">
              <GlassCard className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{item.name}</Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: colors.blueTintBg }}
                  >
                    <Text className="text-xs" style={{ color: colors.accentColor }}>
                      {t(`schedule.subject.${item.subject}`)}
                    </Text>
                  </View>
                </View>
                <ScheduleDisplay schedule={item.schedule} colors={colors} />
              </GlassCard>
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("schedule.noClasses")}</Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

function ScheduleDisplay({ schedule, colors }: { schedule: unknown; colors: ThemeColors }) {
  const { t } = useTranslation();

  if (!schedule || typeof schedule !== "object") {
    return <Text className="text-xs" style={{ color: colors.textMuted }}>-</Text>;
  }

  const entries = Object.entries(schedule as Record<string, string>);
  if (entries.length === 0) {
    return <Text className="text-xs" style={{ color: colors.textMuted }}>-</Text>;
  }

  return (
    <View className="gap-1">
      {entries.map(([day, time]) => {
        const dayKey = DAY_KEYS[day.toLowerCase()] ?? day;
        return (
          <View key={day} className="flex-row items-center gap-2">
            <Text className="text-sm w-10" style={{ color: colors.textTertiary }}>
              {t(`schedule.day.${dayKey}`)}
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{String(time)}</Text>
          </View>
        );
      })}
    </View>
  );
}

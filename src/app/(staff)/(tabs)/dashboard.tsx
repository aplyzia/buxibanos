import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useMessagesStore } from "@/stores/messages-store";
import { LanguageToggle } from "@/components/common/language-toggle";
import { ThemeToggle } from "@/components/common/theme-toggle";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

interface TileProps {
  level: "high" | "medium" | "low";
  count: number;
  oldestMinutes: number | null;
  colors: ThemeColors;
}

const TILE_EMOJIS = { high: "🔴", medium: "🟡", low: "🟢" } as const;

function PriorityTile({ level, count, oldestMinutes, colors }: TileProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const tileTints = {
    high: colors.highBg,
    medium: colors.mediumBg,
    low: colors.lowBg,
  } as const;

  const formatAge = (mins: number | null) => {
    if (mins === null || count === 0) return null;
    if (mins < 60) return t("dashboard.oldestMinutes", { count: mins });
    const hours = Math.floor(mins / 60);
    return t("dashboard.oldestHours", { count: hours });
  };

  const ageLabel = formatAge(oldestMinutes);

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/(staff)/(tabs)/messages", params: { priority: level } })
      }
      className="flex-1 active:opacity-80"
    >
      <GlassCard className="flex-1 p-4" tint="light">
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: tileTints[level],
            borderRadius: 16,
          }}
        />
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-lg">{TILE_EMOJIS[level]}</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
            {t(`priority.${level}`)}
          </Text>
        </View>
        <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>{count}</Text>
        {ageLabel && (
          <Text className="text-xs mt-1" style={{ color: colors.textTertiary }}>{ageLabel}</Text>
        )}
        {count === 0 && (
          <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>✓ {t("dashboard.allHandled")}</Text>
        )}
      </GlassCard>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const {
    messages,
    highPriorityCount,
    actionRequiredCount,
    fetchMessages,
    subscribeToRealtime,
  } = useMessagesStore();

  useEffect(() => {
    if (!organizationId) return;
    fetchMessages(organizationId);
    const unsubscribe = subscribeToRealtime(organizationId);
    return unsubscribe;
  }, [organizationId]);

  const unresponded = messages.filter((m) => !m.staff_responded);
  const mediumCount = unresponded.filter((m) => m.priority === "medium").length;
  const lowCount = unresponded.filter((m) => m.priority === "low").length;

  const getOldestMinutes = (priority: "high" | "medium" | "low") => {
    const relevant = unresponded
      .filter((m) => m.priority === priority)
      .map((m) => new Date(m.processed_at).getTime());
    if (relevant.length === 0) return null;
    const oldest = Math.min(...relevant);
    return Math.floor((Date.now() - oldest) / 60000);
  };

  const staffName = profile && "full_name" in profile ? profile.full_name : "";
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  return (
    <GlassBackground variant="staff">
      <View className="flex-1" style={{ paddingBottom: 80 }}>
        {/* Header */}
        <View className="px-5 pt-14 pb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm" style={{ color: colors.textTertiary }}>
              {t(`dashboard.greeting.${greetingKey}`)}
            </Text>
            <View className="flex-row items-center gap-2">
              <ThemeToggle />
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
          <Text className="text-2xl font-bold mt-0.5" style={{ color: colors.textPrimary }}>
            {staffName || "BuxibanOS"}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.textMuted }}>
            {new Date().toLocaleDateString(dateLocale, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>

          {/* Action Required — directly under date */}
          {actionRequiredCount > 0 && (
            <View
              className="px-3 py-2 rounded-lg mt-2"
              style={{ backgroundColor: colors.warningBg }}
            >
              <Text className="text-sm font-semibold" style={{ color: colors.warningText }}>
                ⚠️ {t("dashboard.actionRequired", { count: actionRequiredCount })}
              </Text>
            </View>
          )}
        </View>

        {/* 3-Tile Priority Dashboard */}
        <View className="px-4 flex-1" style={{ justifyContent: "flex-start" }}>
          <Text className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
            {t("dashboard.pendingMessages")}
          </Text>

          {/* Urgent tile — full width, shares space equally with medium/low */}
          <View className="flex-1">
            <PriorityTile
              level="high"
              count={highPriorityCount}
              oldestMinutes={getOldestMinutes("high")}
              colors={colors}
            />
          </View>

          {/* Medium + Low — side by side, same height as urgent */}
          <View className="flex-row gap-3 mt-2 flex-1">
            <PriorityTile
              level="medium"
              count={mediumCount}
              oldestMinutes={getOldestMinutes("medium")}
              colors={colors}
            />
            <PriorityTile
              level="low"
              count={lowCount}
              oldestMinutes={getOldestMinutes("low")}
              colors={colors}
            />
          </View>
        </View>

        {/* Quick links — single row of 3 */}
        <View className="px-4 mt-3 mb-2">
          <Text className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
            {t("dashboard.quickLinks")}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/(staff)/briefing")}
              className="flex-1 active:opacity-80"
            >
              <GlassCard className="px-3 py-3 items-center">
                <Text className="text-xl mb-1">☀️</Text>
                <Text className="text-xs font-medium text-center" style={{ color: colors.textPrimary }}>
                  {t("dashboard.briefing")}
                </Text>
              </GlassCard>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(staff)/announcements" as any)}
              className="flex-1 active:opacity-80"
            >
              <GlassCard className="px-3 py-3 items-center">
                <Text className="text-xl mb-1">📢</Text>
                <Text className="text-xs font-medium text-center" style={{ color: colors.textPrimary }}>
                  {t("dashboard.announce")}
                </Text>
              </GlassCard>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(staff)/attendance")}
              className="flex-1 active:opacity-80"
            >
              <GlassCard className="px-3 py-3 items-center">
                <Text className="text-xl mb-1">✅</Text>
                <Text className="text-xs font-medium text-center" style={{ color: colors.textPrimary }}>
                  {t("dashboard.attendance")}
                </Text>
              </GlassCard>
            </Pressable>
          </View>
        </View>
      </View>
    </GlassBackground>
  );
}

import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, RefreshCw, Lock, AlertCircle } from "lucide-react-native";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import { useAuthStore } from "@/stores/auth-store";
import { useBriefingStore, BriefingSection } from "@/stores/briefing-store";
import { useTierGate } from "@/hooks/use-tier-gate";

type Tab = "morning" | "weekly";

const SECTION_ICONS: Record<string, string> = {
  urgent: "🚨",
  fees: "💰",
  tasks: "✅",
  insights: "💡",
};

export default function BriefingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const role = useAuthStore((s) => s.role);

  const {
    morningBrief,
    weeklyReport,
    isLoadingMorning,
    isLoadingWeekly,
    error,
    fetchMorningBrief,
    fetchWeeklyReport,
    clearError,
  } = useBriefingStore();

  const [activeTab, setActiveTab] = useState<Tab>("morning");

  const isAdmin = role === "director" || role === "admin";
  const { allowed: tierAllowed } = useTierGate("standard");

  // Auto-fetch on mount for authorised users
  useEffect(() => {
    if (!isAdmin || !tierAllowed) return;
    fetchMorningBrief();
    fetchWeeklyReport();
  }, [isAdmin, tierAllowed]);

  const isLoading = activeTab === "morning" ? isLoadingMorning : isLoadingWeekly;
  const brief = activeTab === "morning" ? morningBrief : weeklyReport;

  function handleRefresh() {
    clearError();
    if (activeTab === "morning") fetchMorningBrief(true);
    else fetchWeeklyReport(true);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── Tier gate ────────────────────────────────────────────────────────────
  if (!tierAllowed) {
    return (
      <GlassBackground variant="staff">
        <View className="pt-14 pb-3 px-4 flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("briefing.title")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
          <Text className="text-base text-center" style={{ color: colors.textMuted }}>
            {t("briefing.tierGated")}
          </Text>
        </View>
      </GlassBackground>
    );
  }

  // ── Access denied ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <GlassBackground variant="staff">
        <View className="pt-14 pb-3 px-4 flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("briefing.title")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
          <Text className="text-base text-center" style={{ color: colors.textMuted }}>
            {t("briefing.accessDenied")}
          </Text>
        </View>
      </GlassBackground>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────────────
  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("briefing.title")}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-full active:opacity-70"
          style={{ opacity: isLoading ? 0.4 : 1 }}
        >
          <RefreshCw size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        className="flex-row mx-4 mb-3"
        style={{ backgroundColor: colors.surfaceBg, borderRadius: 10, padding: 3 }}
      >
        {(["morning", "weekly"] as Tab[]).map((tab) => {
          const label = tab === "morning" ? t("briefing.todayTab") : t("briefing.weeklyTab");
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className="flex-1 py-2 items-center rounded-lg"
              style={{ backgroundColor: active ? colors.accentBg : "transparent" }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: active ? colors.accentColor : colors.textMuted }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Loading */}
        {isLoading && (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.loaderColor} />
            <Text className="mt-4 text-sm" style={{ color: colors.textMuted }}>
              {t("briefing.generating")}
            </Text>
          </View>
        )}

        {/* Error */}
        {!isLoading && error && (
          <Pressable onPress={handleRefresh}>
            <GlassCard
              className="p-4 mb-3 flex-row items-center"
              style={{ borderColor: colors.errorBorder, backgroundColor: colors.errorBg }}
            >
              <AlertCircle size={20} color={colors.errorText} style={{ marginRight: 10 }} />
              <Text className="flex-1 text-sm" style={{ color: colors.errorText }}>
                {t("briefing.errorRetry")}
              </Text>
            </GlassCard>
          </Pressable>
        )}

        {/* Content */}
        {!isLoading && !error && brief && (
          <>
            {/* Summary card */}
            <GlassCard
              className="p-4 mb-3"
              style={{ backgroundColor: colors.insightsBg, borderColor: colors.insightsBorder }}
            >
              <Text
                className="text-xs font-semibold mb-2 uppercase tracking-wide"
                style={{ color: colors.insightsLabel }}
              >
                ☀️ {activeTab === "morning" ? t("briefing.todayTab") : t("briefing.weeklyTitle")}
              </Text>
              <Text className="text-sm leading-5" style={{ color: colors.insightsText }}>
                {brief.summary}
              </Text>
              <Text className="text-xs mt-3" style={{ color: colors.textMuted }}>
                {t("briefing.lastUpdated", { time: formatTime(brief.generatedAt) })}
              </Text>
            </GlassCard>

            {/* All clear */}
            {brief.sections.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-4xl mb-3">🎉</Text>
                <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
                  {t("briefing.allClear")}
                </Text>
              </View>
            )}

            {/* Sections */}
            {brief.sections.map((section: BriefingSection, si: number) => (
              <GlassCard key={si} className="p-4 mb-3">
                <Text className="text-sm font-semibold mb-3" style={{ color: colors.textPrimary }}>
                  {SECTION_ICONS[section.type] ?? "•"} {section.title}
                </Text>
                {section.items.map((item, ii: number) => (
                  <View
                    key={ii}
                    className="pb-3 mb-3"
                    style={{
                      borderBottomWidth: ii < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: colors.surfaceBorder,
                    }}
                  >
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {item.text}
                    </Text>
                    {item.detail ? (
                      <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                        {item.detail}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </GlassCard>
            ))}

            <View style={{ height: 32 }} />
          </>
        )}

        {/* Empty — no brief yet, not loading, no error */}
        {!isLoading && !error && !brief && (
          <View className="items-center py-20">
            <Text className="text-4xl mb-4">🌅</Text>
            <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
              {t("briefing.noData")}
            </Text>
          </View>
        )}
      </ScrollView>
    </GlassBackground>
  );
}

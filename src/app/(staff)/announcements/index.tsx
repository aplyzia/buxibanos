import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Plus, Users, User, Globe } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import {
  useAnnouncementsStore,
  AnalyticsSummary,
} from "@/stores/announcements-store";
import { Announcement } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

export default function StaffAnnouncementsListScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);

  const {
    staffAnnouncements,
    isLoadingStaff,
    analytics,
    fetchStaffAnnouncements,
    fetchAnalytics,
  } = useAnnouncementsStore();

  const [refreshing, setRefreshing] = useState(false);
  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  useEffect(() => {
    if (organizationId) {
      fetchStaffAnnouncements(organizationId);
    }
  }, [organizationId]);

  // Fetch analytics for each announcement
  useEffect(() => {
    staffAnnouncements.forEach((a) => {
      if (!analytics[a.id]) {
        fetchAnalytics(a.id);
      }
    });
  }, [staffAnnouncements]);

  const handleRefresh = async () => {
    if (!organizationId) return;
    setRefreshing(true);
    await fetchStaffAnnouncements(organizationId);
    setRefreshing(false);
  };

  const getTargetIcon = (type: string) => {
    if (type === "by_class") return <Users size={12} color={colors.textMuted} />;
    if (type === "individual") return <User size={12} color={colors.textMuted} />;
    return <Globe size={12} color={colors.textMuted} />;
  };

  const getTargetLabel = (type: string) => {
    if (type === "by_class") return t("announcements.targetByClass");
    if (type === "individual") return t("announcements.targetIndividual");
    return t("announcements.targetAll");
  };

  const renderItem = ({ item }: { item: Announcement }) => {
    const stats: AnalyticsSummary | undefined = analytics[item.id];
    const isUrgent = item.priority === "urgent";
    const isExpired =
      item.expires_at && new Date(item.expires_at) < new Date();

    return (
      <Pressable
        className="mx-4 mb-3 active:opacity-80"
        onPress={() =>
          router.push(`/(staff)/announcements/${item.id}/analytics` as any)
        }
      >
        <GlassCard
          className="p-4"
          style={
            isUrgent
              ? { borderLeftWidth: 3, borderLeftColor: "#EF4444" }
              : undefined
          }
        >
          <View className="flex-row items-start justify-between mb-1">
            <Text
              className="text-base font-semibold flex-1 mr-2"
              numberOfLines={1}
              style={{ color: colors.textPrimary }}
            >
              {item.title}
            </Text>
            <View className="flex-row items-center gap-1">
              {isUrgent && (
                <View
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "rgba(239,68,68,0.2)" }}
                >
                  <Text
                    className="text-[10px] font-bold"
                    style={{ color: "#EF4444" }}
                  >
                    {t("announcements.urgent")}
                  </Text>
                </View>
              )}
              {isExpired && (
                <View
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: colors.surfaceBg }}
                >
                  <Text
                    className="text-[10px]"
                    style={{ color: colors.textMuted }}
                  >
                    {t("announcements.expired")}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text
            className="text-sm mb-2"
            numberOfLines={1}
            style={{ color: colors.textSecondary }}
          >
            {item.body}
          </Text>

          {/* Target + date row */}
          <View className="flex-row items-center gap-3 mb-2">
            <View className="flex-row items-center gap-1">
              {getTargetIcon(item.target_type)}
              <Text
                className="text-xs"
                style={{ color: colors.textMuted }}
              >
                {getTargetLabel(item.target_type)}
              </Text>
            </View>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {new Date(item.created_at).toLocaleDateString(dateLocale)}
            </Text>
          </View>

          {/* Analytics summary */}
          {stats && (
            <View className="flex-row gap-3">
              <StatBadge
                label={t("announcements.totalSent")}
                value={stats.total}
                color={colors.textMuted}
                bgColor={colors.surfaceBg}
              />
              <StatBadge
                label={t("announcements.totalViewed")}
                value={stats.viewed}
                color={colors.accentColor}
                bgColor={colors.accentBg}
              />
              <StatBadge
                label={t("announcements.totalResponded")}
                value={stats.responded}
                color="#22C55E"
                bgColor="rgba(34,197,94,0.15)"
              />
              <StatBadge
                label={t("announcements.totalDismissed")}
                value={stats.dismissed}
                color={colors.textMuted}
                bgColor={colors.surfaceBg}
              />
            </View>
          )}
        </GlassCard>
      </Pressable>
    );
  };

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
          <Text
            className="text-lg font-bold"
            style={{ color: colors.textPrimary }}
          >
            {t("announcements.allAnnouncements")}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(staff)/announcements/create" as any)}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.accentBg }}
        >
          <Plus size={20} color={colors.accentColor} />
        </Pressable>
      </View>

      {isLoadingStaff && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : (
        <FlatList
          data={staffAnnouncements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text
                className="text-base"
                style={{ color: colors.textMuted }}
              >
                {t("announcements.noAnnouncements")}
              </Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

function StatBadge({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <View
      className="px-2 py-1 rounded-lg items-center"
      style={{ backgroundColor: bgColor }}
    >
      <Text className="text-xs font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[9px]" style={{ color, opacity: 0.8 }}>
        {label}
      </Text>
    </View>
  );
}

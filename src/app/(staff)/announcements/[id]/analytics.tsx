import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronDown, ChevronUp, FileText, ExternalLink, Play, X } from "lucide-react-native";
import { useAnnouncementsStore } from "@/stores/announcements-store";
import { AnnouncementRecipient } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

export default function AnnouncementAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  const {
    staffAnnouncements,
    analytics,
    recipientDetails,
    fetchAnalytics,
    fetchRecipientDetails,
  } = useAnnouncementsStore();

  const announcement = staffAnnouncements.find((a) => a.id === id);
  const stats = id ? analytics[id] : undefined;
  const recipients = id ? recipientDetails[id] : undefined;

  useEffect(() => {
    if (!id) return;
    fetchAnalytics(id);
    fetchRecipientDetails(id);
  }, [id]);

  if (!announcement) {
    return (
      <GlassBackground variant="staff">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      </GlassBackground>
    );
  }

  const [contentExpanded, setContentExpanded] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const responseBreakdown = stats?.response_breakdown || {};
  const responseOptions = Array.isArray(announcement.response_options)
    ? (announcement.response_options as string[])
    : [];

  interface MediaItem {
    type: "image" | "document" | "video";
    url: string;
    file_name?: string;
  }

  const mediaItems: MediaItem[] = Array.isArray(announcement.media_urls)
    ? (announcement.media_urls as unknown as MediaItem[])
    : [];

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/announcements" as any)}
          className="mr-3 p-1 rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-lg font-bold"
            numberOfLines={1}
            style={{ color: colors.textPrimary }}
          >
            {announcement.title}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {t("announcements.analytics")} ·{" "}
            {new Date(announcement.created_at).toLocaleDateString(dateLocale)}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
      >
        {/* Original announcement content */}
        <Pressable onPress={() => setContentExpanded(!contentExpanded)}>
          <GlassCard className="p-4 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                {t("announcements.originalPost")}
              </Text>
              {contentExpanded ? (
                <ChevronUp size={16} color={colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={colors.textMuted} />
              )}
            </View>
            <Text
              className="text-sm leading-6"
              numberOfLines={contentExpanded ? undefined : 3}
              style={{ color: colors.textSecondary }}
            >
              {announcement.body}
            </Text>

            {contentExpanded && (
              <>
                {/* Media attachments */}
                {mediaItems.length > 0 && (
                  <View className="mt-3 gap-2">
                    {mediaItems.map((item, idx) => {
                      if (item.type === "image") {
                        return (
                          <Pressable key={idx} onPress={() => setFullscreenImage(item.url)} className="active:opacity-80">
                            <Image
                              source={{ uri: item.url }}
                              className="rounded-xl"
                              style={{ width: "100%", height: 200 }}
                              resizeMode="cover"
                            />
                          </Pressable>
                        );
                      }
                      if (item.type === "video") {
                        return (
                          <Pressable
                            key={idx}
                            onPress={() => Linking.openURL(item.url)}
                            className="rounded-xl overflow-hidden active:opacity-80"
                            style={{ backgroundColor: colors.surfaceBg, borderWidth: 1, borderColor: colors.surfaceBorder }}
                          >
                            <View className="h-32 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
                              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                                <Play size={20} color="#FFFFFF" />
                              </View>
                            </View>
                            {item.file_name && (
                              <View className="px-3 py-2">
                                <Text className="text-xs" numberOfLines={1} style={{ color: colors.textSecondary }}>{item.file_name}</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => Linking.openURL(item.url)}
                          className="flex-row items-center px-3 py-2.5 rounded-xl active:opacity-70"
                          style={{ backgroundColor: colors.surfaceBg, borderWidth: 1, borderColor: colors.surfaceBorder }}
                        >
                          <View className="w-8 h-8 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: colors.accentBg }}>
                            <FileText size={14} color={colors.accentColor} />
                          </View>
                          <Text className="text-sm flex-1" numberOfLines={1} style={{ color: colors.textPrimary }}>
                            {item.file_name || "Document"}
                          </Text>
                          <ExternalLink size={12} color={colors.textMuted} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Response options that were set */}
                {responseOptions.length > 0 && (
                  <View className="mt-3">
                    <Text className="text-xs mb-1.5" style={{ color: colors.textMuted }}>
                      {t("announcements.responseOptions")}:
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {responseOptions.map((option) => (
                        <View key={option} className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: colors.surfaceBg, borderWidth: 1, borderColor: colors.surfaceBorder }}>
                          <Text className="text-xs" style={{ color: colors.textPrimary }}>{option}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </GlassCard>
        </Pressable>

        {/* Summary stats */}
        {stats && (
          <View className="flex-row gap-2 mb-4">
            <StatTile
              label={t("announcements.totalSent")}
              value={stats.total}
              color={colors.textPrimary}
              bgColor={colors.surfaceBg}
              borderColor={colors.surfaceBorder}
            />
            <StatTile
              label={t("announcements.totalViewed")}
              value={stats.viewed}
              color={colors.accentColor}
              bgColor={colors.accentBg}
              borderColor={colors.accentColor}
            />
            <StatTile
              label={t("announcements.totalResponded")}
              value={stats.responded}
              color="#22C55E"
              bgColor="rgba(34,197,94,0.15)"
              borderColor="rgba(34,197,94,0.3)"
            />
            <StatTile
              label={t("announcements.totalDismissed")}
              value={stats.dismissed}
              color={colors.textMuted}
              bgColor={colors.surfaceBg}
              borderColor={colors.surfaceBorder}
            />
          </View>
        )}

        {/* Pending count */}
        {stats && stats.pending > 0 && (
          <GlassCard className="px-4 py-3 mb-4">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("announcements.totalPending")}:{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                {stats.pending}
              </Text>
            </Text>
          </GlassCard>
        )}

        {/* Response breakdown */}
        {responseOptions.length > 0 && (
          <View className="mb-4">
            <Text
              className="text-sm font-semibold mb-2"
              style={{ color: colors.textPrimary }}
            >
              {t("announcements.responseBreakdown")}
            </Text>
            <GlassCard className="p-4">
              {responseOptions.map((option) => {
                const count = responseBreakdown[option] || 0;
                const total = stats?.responded || 1;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <View key={option} className="mb-3 last:mb-0">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textPrimary }}
                      >
                        {option}
                      </Text>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {count}{" "}
                        <Text
                          className="text-xs font-normal"
                          style={{ color: colors.textMuted }}
                        >
                          ({pct}%)
                        </Text>
                      </Text>
                    </View>
                    {/* Progress bar */}
                    <View
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.surfaceBg }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: colors.accentColor,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </View>
        )}

        {/* Individual responses */}
        <Text
          className="text-sm font-semibold mb-2"
          style={{ color: colors.textPrimary }}
        >
          {t("announcements.recipientList")}
        </Text>

        {!recipients ? (
          <View className="py-4 items-center">
            <ActivityIndicator size="small" color={colors.loaderColor} />
          </View>
        ) : recipients.length === 0 ? (
          <GlassCard className="px-4 py-6 items-center">
            <Text className="text-sm" style={{ color: colors.textMuted }}>
              {t("announcements.noResponses")}
            </Text>
          </GlassCard>
        ) : (
          recipients.map((r) => (
            <RecipientRow
              key={r.id}
              recipient={r}
              colors={colors}
              t={t}
              dateLocale={dateLocale}
            />
          ))
        )}
      </ScrollView>

      {/* Fullscreen image viewer */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/90">
          <Pressable
            onPress={() => setFullscreenImage(null)}
            className="absolute top-14 right-4 z-10 w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={{ width: "90%", height: "70%" }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </GlassBackground>
  );
}

function StatTile({
  label,
  value,
  color,
  bgColor,
  borderColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <View
      className="flex-1 rounded-xl py-3 items-center"
      style={{ backgroundColor: bgColor, borderWidth: 1, borderColor }}
    >
      <Text className="text-xl font-bold" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] mt-0.5" style={{ color, opacity: 0.8 }}>
        {label}
      </Text>
    </View>
  );
}

function RecipientRow({
  recipient,
  colors,
  t,
  dateLocale,
}: {
  recipient: AnnouncementRecipient & { parentName: string };
  colors: any;
  t: (key: string) => string;
  dateLocale: string;
}) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    sent: { bg: colors.surfaceBg, text: colors.textMuted },
    viewed: { bg: colors.accentBg, text: colors.accentColor },
    responded: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
    dismissed: { bg: colors.surfaceBg, text: colors.textMuted },
  };

  const sc = statusColors[recipient.status] || statusColors.sent;

  const timestamp =
    recipient.responded_at ||
    recipient.dismissed_at ||
    recipient.viewed_at ||
    recipient.created_at;

  return (
    <View
      className="flex-row items-center py-3 px-2 mb-1"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}
    >
      {/* Avatar */}
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: colors.purpleTintBg }}
      >
        <Text
          className="text-xs font-bold"
          style={{ color: colors.avatarText }}
        >
          {recipient.parentName.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      {/* Name + response */}
      <View className="flex-1">
        <Text
          className="text-sm font-medium"
          style={{ color: colors.textPrimary }}
        >
          {recipient.parentName}
        </Text>
        {recipient.response_value && (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
            {recipient.response_value}
            {recipient.free_text_value ? ` — ${recipient.free_text_value}` : ""}
          </Text>
        )}
      </View>

      {/* Status badge */}
      <View className="items-end">
        <View className="px-2 py-0.5 rounded" style={{ backgroundColor: sc.bg }}>
          <Text className="text-[10px] font-medium" style={{ color: sc.text }}>
            {t(`announcements.${recipient.status === "sent" ? "totalPending" : recipient.status}`)}
          </Text>
        </View>
        <Text className="text-[9px] mt-0.5" style={{ color: colors.textMuted }}>
          {new Date(timestamp).toLocaleDateString(dateLocale, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

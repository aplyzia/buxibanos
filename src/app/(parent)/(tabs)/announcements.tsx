import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { FileText, Film, AlertCircle } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import {
  useAnnouncementsStore,
  AnnouncementWithRecipient,
} from "@/stores/announcements-store";
import { LanguageToggle } from "@/components/common/language-toggle";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import AnnouncementDetailModal from "@/components/announcements/announcement-detail-modal";
import { useTheme } from "@/theme";

export default function ParentAnnouncementsScreen() {
  const { t, i18n } = useTranslation();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();

  const { announcements, isLoading, fetchParentAnnouncements } =
    useAnnouncementsStore();

  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementWithRecipient | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const parentId =
    profile && "id" in profile ? (profile as { id: string }).id : "";
  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  const loadData = useCallback(async () => {
    if (!organizationId || !parentId) return;
    await fetchParentAnnouncements(organizationId, parentId);
  }, [organizationId, parentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: AnnouncementWithRecipient }) => {
    const mediaItems = Array.isArray(item.media_urls)
      ? (item.media_urls as { type: string; url: string; file_name?: string }[])
      : [];
    const firstImage = mediaItems.find((m) => m.type === "image");
    const hasDocument = mediaItems.some((m) => m.type === "document");
    const hasVideo = mediaItems.some((m) => m.type === "video");
    const responseOptions = Array.isArray(item.response_options)
      ? (item.response_options as string[])
      : [];
    const status = item.recipient?.status || "sent";
    const isUnread = status === "sent";
    const isUrgent = item.priority === "urgent";

    return (
      <Pressable
        className="mx-4 mb-3 active:opacity-80"
        onPress={() => setSelectedAnnouncement(item)}
      >
        <GlassCard
          className="p-4"
          style={
            isUrgent
              ? { borderLeftWidth: 3, borderLeftColor: "#EF4444" }
              : undefined
          }
        >
          <View className="flex-row items-start">
            {/* Content */}
            <View className="flex-1 mr-3">
              <View className="flex-row items-center gap-2 mb-1">
                {isUnread && (
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors.accentColor }}
                  />
                )}
                {isUrgent && (
                  <AlertCircle size={12} color="#EF4444" />
                )}
                {status === "responded" && (
                  <Text
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "rgba(34,197,94,0.15)",
                      color: "#22C55E",
                    }}
                  >
                    {t("announcements.responded")}
                  </Text>
                )}
                {status === "dismissed" && (
                  <Text
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: colors.surfaceBg,
                      color: colors.textMuted,
                    }}
                  >
                    {t("announcements.dismissed")}
                  </Text>
                )}
              </View>

              <Text
                className="text-base font-semibold mb-1"
                style={{ color: colors.textPrimary }}
              >
                {item.title}
              </Text>
              <Text
                className="text-sm leading-5"
                numberOfLines={2}
                style={{ color: colors.textSecondary }}
              >
                {item.body}
              </Text>

              <View className="flex-row items-center mt-2 gap-3">
                <Text
                  className="text-xs"
                  style={{ color: colors.textMuted }}
                >
                  {new Date(item.created_at).toLocaleDateString(dateLocale)}
                </Text>
                {responseOptions.length > 0 && status !== "responded" && status !== "dismissed" && (
                  <Text
                    className="text-xs"
                    style={{ color: colors.accentColor }}
                  >
                    {t("announcements.respond")}
                  </Text>
                )}
                {hasDocument && (
                  <FileText size={12} color={colors.textMuted} />
                )}
                {hasVideo && (
                  <Film size={12} color={colors.textMuted} />
                )}
              </View>
            </View>

            {/* Media thumbnail */}
            {firstImage && (
              <Image
                source={{ uri: firstImage.url }}
                className="rounded-lg"
                style={{ width: 60, height: 60 }}
                resizeMode="cover"
              />
            )}
          </View>
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <GlassBackground variant="parent">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-2xl font-bold"
            style={{ color: colors.textPrimary }}
          >
            {t("announcements.title")}
          </Text>
          <View className="flex-row items-center gap-2">
            <LanguageToggle />
            <Pressable
              onPress={signOut}
              className="px-3 py-1.5 rounded-full active:opacity-70"
              style={{
                backgroundColor: colors.surfaceBorder,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                {t("auth.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
          <Text
            className="text-sm mt-2"
            style={{ color: colors.textMuted }}
          >
            {t("common.loading")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
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

      {/* Detail modal */}
      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        visible={!!selectedAnnouncement}
        onClose={() => {
          setSelectedAnnouncement(null);
          // Refresh to update local state after respond/dismiss
          loadData();
        }}
        parentId={parentId}
      />
    </GlassBackground>
  );
}

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { Plus } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useChannelsStore } from "@/stores/channels-store";
import { useUnifiedInbox } from "@/hooks/useUnifiedInbox";
import { ChannelCard } from "@/components/channels/channel-card";
import ChannelSearchBar from "@/components/channels/channel-search-bar";
import { PriorityFilterBar } from "@/components/messages/priority-filter";
import { NewConversationSheet } from "@/components/inbox/new-conversation-sheet";
import { LanguageToggle } from "@/components/common/language-toggle";
import { ThemeToggle } from "@/components/common/theme-toggle";
import GlassBackground from "@/components/common/glass-background";
import { useTheme } from "@/theme";
import type { UnifiedInboxItem } from "@/types/unified-inbox";

export default function TeacherUnifiedInboxScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const signOut = useAuthStore((s) => s.signOut);

  const channels = useChannelsStore((s) => s.channels);
  const isLoading = useChannelsStore((s) => s.isLoading);
  const staffNames = useChannelsStore((s) => s.staffNames);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const subscribeToRealtime = useChannelsStore((s) => s.subscribeToRealtime);
  const resolveStaffNames = useChannelsStore((s) => s.resolveStaffNames);

  const staffId = profile && "id" in profile ? profile.id : "";
  const staffName =
    profile && "full_name" in profile ? profile.full_name : "";

  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [showNewSheet, setShowNewSheet] = useState(false);

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  useEffect(() => {
    if (!organizationId || !staffId) return;
    resolveStaffNames(organizationId);
    const unsubscribe = subscribeToRealtime(organizationId, staffId);
    return unsubscribe;
  }, [organizationId, staffId]);

  useFocusEffect(
    useCallback(() => {
      if (organizationId && staffId) {
        fetchChannels(organizationId, staffId);
      }
    }, [organizationId, staffId])
  );

  // Unified list (channels only for teachers — no parent messages)
  const unifiedItems = useUnifiedInbox([], channels, priorityFilter);

  const renderItem = ({ item }: { item: UnifiedInboxItem }) => {
    if (item.kind === "channel") {
      return (
        <ChannelCard
          channel={item.data}
          currentStaffId={staffId}
          staffNames={staffNames}
          onPress={() =>
            router.push({
              pathname: "/(teacher)/channels/[id]",
              params: { id: item.data.id },
            })
          }
        />
      );
    }
    return null;
  };

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="px-5 pt-14 pb-2">
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
              <Text
                className="text-xs font-medium"
                style={{ color: colors.textSecondary }}
              >
                {t("auth.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
        <Text
          className="text-2xl font-bold"
          style={{ color: colors.textPrimary }}
        >
          {staffName || t("tabs.messages")}
        </Text>
        <Text className="text-sm mt-1" style={{ color: colors.textMuted }}>
          {t("tabs.messages")}
        </Text>
      </View>

      {/* Search bar */}
      <ChannelSearchBar
        onNavigateToMessage={(channelId) =>
          router.push({
            pathname: "/(teacher)/channels/[id]",
            params: { id: channelId },
          })
        }
      />

      {/* Priority filter */}
      <PriorityFilterBar
        active={priorityFilter}
        onChange={setPriorityFilter}
      />

      {/* Unified list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : (
        <FlatList
          data={unifiedItems}
          keyExtractor={(item) =>
            item.kind === "parent"
              ? `msg-${item.data.id}`
              : `ch-${item.data.id}`
          }
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text
                className="text-base"
                style={{ color: colors.textMuted }}
              >
                {t("inbox.empty")}
              </Text>
            </View>
          }
          onRefresh={() => {
            if (organizationId && staffId)
              fetchChannels(organizationId, staffId);
          }}
          refreshing={isLoading}
        />
      )}

      {/* FAB: New conversation */}
      <Pressable
        onPress={() => setShowNewSheet(true)}
        className="absolute bottom-24 right-5 w-14 h-14 rounded-full items-center justify-center active:opacity-80"
        style={{
          backgroundColor: colors.accentBg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Plus size={24} color={colors.textPrimary} />
      </Pressable>

      {/* New conversation sheet (staff only, no parent option) */}
      <NewConversationSheet
        visible={showNewSheet}
        onClose={() => setShowNewSheet(false)}
        onSelectParent={() => {}}
        onSelectStaff={() => router.push("/(teacher)/channels/create")}
        showParentOption={false}
      />
    </GlassBackground>
  );
}

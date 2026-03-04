import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useMessagesStore } from "@/stores/messages-store";
import { useChannelsStore } from "@/stores/channels-store";
import { useUnifiedInbox } from "@/hooks/useUnifiedInbox";
import { MessageCard } from "@/components/messages/message-card";
import { ChannelCard } from "@/components/channels/channel-card";
import { PriorityFilterBar } from "@/components/messages/priority-filter";
import { NewConversationSheet } from "@/components/inbox/new-conversation-sheet";
import { LanguageToggle } from "@/components/common/language-toggle";
import GlassBackground from "@/components/common/glass-background";
import { useTheme } from "@/theme";
import type { UnifiedInboxItem } from "@/types/unified-inbox";

export default function UnifiedInboxScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { priority } = useLocalSearchParams<{ priority?: string }>();

  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  const staffId = profile && "id" in profile ? profile.id : "";

  // Messages store (parent messages)
  const messages = useMessagesStore((s) => s.messages);
  const messagesLoading = useMessagesStore((s) => s.isLoading);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const subscribeMessages = useMessagesStore((s) => s.subscribeToRealtime);

  // Channels store (staff channels)
  const channels = useChannelsStore((s) => s.channels);
  const channelsLoading = useChannelsStore((s) => s.isLoading);
  const staffNames = useChannelsStore((s) => s.staffNames);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const subscribeChannels = useChannelsStore((s) => s.subscribeToRealtime);
  const resolveStaffNames = useChannelsStore((s) => s.resolveStaffNames);

  // Local state
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [showNewSheet, setShowNewSheet] = useState(false);

  // Apply URL param priority from dashboard tiles
  useEffect(() => {
    if (
      priority === "high" ||
      priority === "medium" ||
      priority === "low"
    ) {
      setPriorityFilter(priority);
    }
  }, [priority]);

  // Fetch & subscribe on mount
  useEffect(() => {
    if (!organizationId || !staffId) return;
    fetchMessages(organizationId);
    resolveStaffNames(organizationId);
    const unsubMsg = subscribeMessages(organizationId);
    const unsubCh = subscribeChannels(organizationId, staffId);
    return () => {
      unsubMsg();
      unsubCh();
    };
  }, [organizationId, staffId]);

  // Re-fetch on focus
  useFocusEffect(
    useCallback(() => {
      if (organizationId && staffId) {
        fetchMessages(organizationId);
        fetchChannels(organizationId, staffId);
      }
    }, [organizationId, staffId])
  );

  // Merge & sort
  const unifiedItems = useUnifiedInbox(messages, channels, priorityFilter);
  const isLoading = messagesLoading || channelsLoading;

  const renderItem = ({ item }: { item: UnifiedInboxItem }) => {
    if (item.kind === "parent") {
      return <MessageCard message={item.data} />;
    }
    return (
      <ChannelCard
        channel={item.data}
        currentStaffId={staffId}
        staffNames={staffNames}
        onPress={() =>
          router.push({
            pathname: "/(staff)/channels/[id]",
            params: { id: item.data.id },
          })
        }
      />
    );
  };

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-2 px-5">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-2xl font-bold"
            style={{ color: colors.textPrimary }}
          >
            {t("inbox.title")}
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

      {/* Priority filter */}
      <PriorityFilterBar
        active={priorityFilter}
        onChange={setPriorityFilter}
      />

      {/* Unified list */}
      {isLoading ? (
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
          data={unifiedItems}
          keyExtractor={(item) =>
            item.kind === "parent"
              ? `msg-${item.data.id}`
              : `ch-${item.data.id}`
          }
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
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

      {/* New conversation sheet */}
      <NewConversationSheet
        visible={showNewSheet}
        onClose={() => setShowNewSheet(false)}
        onSelectParent={() =>
          router.push("/(staff)/messages/parent-select")
        }
        onSelectStaff={() => router.push("/(staff)/channels/create")}
        showParentOption={true}
      />
    </GlassBackground>
  );
}

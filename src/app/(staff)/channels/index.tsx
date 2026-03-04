import { useEffect, useCallback } from "react";
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
import { ChevronLeft, Plus } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useChannelsStore } from "@/stores/channels-store";
import { ChannelCard } from "@/components/channels/channel-card";
import ChannelSearchBar from "@/components/channels/channel-search-bar";
import GlassBackground from "@/components/common/glass-background";
import { useTheme } from "@/theme";

export default function StaffChannelListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const {
    channels,
    isLoading,
    staffNames,
    fetchChannels,
    subscribeToRealtime,
    resolveStaffNames,
  } = useChannelsStore();

  const staffId = profile && "id" in profile ? profile.id : "";

  useEffect(() => {
    if (!organizationId || !staffId) return;
    resolveStaffNames(organizationId);
    const unsubscribe = subscribeToRealtime(organizationId, staffId);
    return unsubscribe;
  }, [organizationId, staffId]);

  useFocusEffect(
    useCallback(() => {
      if (organizationId && staffId)
        fetchChannels(organizationId, staffId);
    }, [organizationId, staffId])
  );

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 flex-row items-center">
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
          className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          className="text-xl font-bold flex-1"
          style={{ color: colors.textPrimary }}
        >
          {t("channels.internalChat")}
        </Text>
        <Pressable
          onPress={() => router.push("/(staff)/channels/create")}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          style={{
            backgroundColor: colors.accentBg,
          }}
        >
          <Plus size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Search bar */}
      <ChannelSearchBar
        onNavigateToMessage={(channelId) =>
          router.push({
            pathname: "/(staff)/channels/[id]",
            params: { id: channelId },
          })
        }
      />

      {/* Channel list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
          renderItem={({ item }) => (
            <ChannelCard
              channel={item}
              currentStaffId={staffId}
              staffNames={staffNames}
              onPress={() =>
                router.push({
                  pathname: "/(staff)/channels/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-base" style={{ color: colors.textMuted }}>
                {t("channels.noChannels")}
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
    </GlassBackground>
  );
}

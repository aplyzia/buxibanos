import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/common/language-toggle";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Message } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

export default function ParentMessagesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const organizationId = useAuthStore((s) => s.organizationId);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();

  const [threads, setThreads] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!organizationId || !session) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("organization_id", organizationId)
      .or(`sender_user_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    // Group by thread - show latest message per thread
    const allMessages = (data ?? []) as Message[];
    const threadMap = new Map<string, Message>();
    for (const msg of allMessages) {
      const threadId = msg.thread_id ?? msg.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, msg);
      }
    }
    setThreads(Array.from(threadMap.values()));
    setIsLoading(false);
  }, [organizationId, session]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";
  const currentUserId = session?.user?.id;

  return (
    <GlassBackground variant="parent">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            {t("messages.title")}
          </Text>
          <View className="flex-row items-center gap-2">
            <ThemeToggle />
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
          <Text className="text-sm mt-2" style={{ color: colors.textMuted }}>
            {t("common.loading")}
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const isSentByMe = item.sender_user_id === currentUserId;
            const otherName = isSentByMe
              ? item.receiver_name
              : item.sender_name;
            const timeLabel = getTimeLabel(item.created_at, dateLocale);

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(parent)/messages/[id]",
                    params: { id: item.id },
                  })
                }
                className="mx-3 mb-1 active:opacity-80"
              >
                <GlassCard className="px-4 py-3 flex-row items-center">
                  {/* Avatar */}
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.avatarBg }}
                  >
                    <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                      {getInitials(otherName)}
                    </Text>
                  </View>

                  {/* Content */}
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center justify-between mb-0.5">
                      <Text
                        className="text-base font-semibold flex-1 mr-2"
                        style={{ color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {otherName}
                      </Text>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>{timeLabel}</Text>
                    </View>
                    <Text className="text-sm" style={{ color: colors.textTertiary }} numberOfLines={1}>
                      {isSentByMe
                        ? `${t("messages.you")}: ${item.original_content}`
                        : item.summary ?? item.original_content}
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-base" style={{ color: colors.textMuted }}>
                {t("messages.noConversations")}
              </Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 1).toUpperCase();
}

function getTimeLabel(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 60) {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

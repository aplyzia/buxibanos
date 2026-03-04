import { View, Text, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Message } from "@/types/database";
import { useTheme } from "@/theme";

interface MessageCardProps {
  message: Message;
  threadCount?: number;
}

export function MessageCard({ message, threadCount }: MessageCardProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const timeLabel = getTimeLabel(message.processed_at, i18n.language, t);

  const priorityDotColor: Record<string, string> = {
    high: colors.highDot,
    medium: colors.mediumDot,
    low: colors.lowDot,
  };

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(staff)/messages/[id]",
          params: { id: message.id },
        })
      }
      className="mx-3 mb-1 px-4 py-3 rounded-xl active:opacity-80 flex-row items-center"
      style={[
        {
          backgroundColor: colors.cardBg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderLeftWidth: 3,
          borderLeftColor: colors.parentCardBorder,
        },
        Platform.OS === "web"
          ? {
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            } as any
          : {},
      ]}
    >
      {/* Avatar circle */}
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: colors.blueTintBg }}
      >
        <Text className="text-base font-bold" style={{ color: colors.avatarText }}>
          {getInitials(message.sender_name)}
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 mr-2">
        {/* Name row */}
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center flex-1 mr-2">
            <Text
              className="text-base font-semibold"
              numberOfLines={1}
              style={{ color: colors.textPrimary }}
            >
              {message.sender_name}
            </Text>
            <View
              className="w-2 h-2 rounded-full ml-1.5"
              style={{ backgroundColor: priorityDotColor[message.priority] }}
            />
          </View>
          <View className="flex-row items-center gap-1.5">
            {!message.staff_responded && message.action_required && (
              <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.actionBg }}>
                <Text className="text-[10px] font-medium" style={{ color: colors.actionText }}>
                  {t("messages.actionRequired")}
                </Text>
              </View>
            )}
            {message.staff_responded && (
              <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.respondedBg }}>
                <Text className="text-[10px] font-medium" style={{ color: colors.respondedText }}>
                  {t("messages.responded")}
                </Text>
              </View>
            )}
            <Text className="text-xs" style={{ color: colors.textMuted }}>{timeLabel}</Text>
          </View>
        </View>

        {/* Preview text */}
        <Text className="text-sm" numberOfLines={1} style={{ color: colors.textTertiary }}>
          {message.summary ?? message.original_content}
        </Text>

        {/* Bottom row: badges */}
        <View className="flex-row items-center mt-1 gap-1.5">
          {message.primary_student && (
            <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.badgeBg }}>
              <Text className="text-[10px]" style={{ color: colors.badgeText }}>
                {message.primary_student}
              </Text>
            </View>
          )}
          {threadCount != null && threadCount > 1 && (
            <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.threadBg }}>
              <Text className="text-[10px] font-medium" style={{ color: colors.threadText }}>
                {threadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Unread dot */}
      {!message.staff_responded && (
        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.unreadDot }} />
      )}
    </Pressable>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 1).toUpperCase();
}

function getTimeLabel(
  dateStr: string,
  language: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { count: mins });

  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });

  const locale = language === "zh-TW" ? "zh-TW" : "en-US";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

import { View, Text, Pressable, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react-native";
import { useTheme } from "@/theme";
import type { ChannelWithPreview } from "@/stores/channels-store";

interface ChannelCardProps {
  channel: ChannelWithPreview;
  currentStaffId: string;
  staffNames: Record<string, string>;
  onPress: () => void;
}

export function ChannelCard({
  channel,
  currentStaffId,
  staffNames,
  onPress,
}: ChannelCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  // For DMs, show the other person's name
  const displayName =
    channel.type === "direct"
      ? channel.memberIds
          .filter((id) => id !== currentStaffId)
          .map((id) => staffNames[id] || id.slice(0, 8))
          .join(", ") || t("channels.dm")
      : channel.name || t("channels.group");

  const initials = getInitials(displayName);
  const timeLabel = channel.lastMessageAt
    ? getTimeLabel(channel.lastMessageAt, i18n.language, t)
    : "";

  // Preview text
  let preview = "";
  if (channel.lastMessage) {
    const stickerMatch = channel.lastMessage.match(/^\[sticker:(.+)\]$/);
    if (stickerMatch) {
      preview = stickerMatch[1];
    } else {
      preview = channel.lastMessage;
    }
  }

  const priorityDotColor: Record<string, string> = {
    high: colors.highDot,
    medium: colors.mediumDot,
    low: colors.lowDot,
  };

  return (
    <Pressable
      onPress={onPress}
      className="mx-3 mb-1 px-4 py-3 rounded-xl active:opacity-80 flex-row items-center"
      style={[
        {
          backgroundColor: colors.cardBg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderLeftWidth: 3,
          borderLeftColor: colors.staffCardBorder,
        },
        Platform.OS === "web"
          ? {
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            } as any
          : {},
      ]}
    >
      {/* Avatar */}
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: colors.purpleTintBg }}
      >
        {channel.type === "group" ? (
          <Users size={20} color={colors.avatarText} />
        ) : (
          <Text
            className="text-base font-bold"
            style={{ color: colors.avatarText }}
          >
            {initials}
          </Text>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 mr-2">
        <View className="flex-row items-center justify-between mb-0.5">
          <View className="flex-row items-center flex-1 mr-2">
            <Text
              className="text-base font-semibold"
              numberOfLines={1}
              style={{ color: colors.textPrimary }}
            >
              {displayName}
            </Text>
            <View
              className="w-2 h-2 rounded-full ml-1.5"
              style={{
                backgroundColor:
                  priorityDotColor[channel.priority ?? "low"],
              }}
            />
          </View>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {timeLabel}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text
            className="text-sm flex-1 mr-2"
            numberOfLines={1}
            style={{ color: colors.textTertiary }}
          >
            {preview || " "}
          </Text>

          {/* Unread badge */}
          {channel.unreadCount > 0 && (
            <View
              className="min-w-[20px] h-5 rounded-full items-center justify-center px-1.5"
              style={{ backgroundColor: colors.accentBg }}
            >
              <Text
                className="text-[11px] font-bold"
                style={{ color: colors.textPrimary }}
              >
                {channel.unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Member count for groups */}
        {channel.type === "group" && (
          <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
            {t("channels.members", { count: channel.memberIds.length })}
          </Text>
        )}
      </View>
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

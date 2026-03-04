import { View, Text, Pressable, Share, Platform, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Reply,
  Share2,
  Undo2,
  Download,
} from "lucide-react-native";
import { ChannelMessage } from "@/types/database";
import { useChannelsStore } from "@/stores/channels-store";
import { parseMediaUrls } from "@/components/messages/media-bubble";
import { useTheme } from "@/theme";

interface MessageActionMenuProps {
  message: ChannelMessage;
  isSent: boolean;
  position: { top: number; right?: number; left?: number };
  onReply: () => void;
  onClose: () => void;
}

const UNSEND_WINDOW_MS = 30_000; // 30 seconds

export default function MessageActionMenu({
  message,
  isSent,
  position,
  onReply,
  onClose,
}: MessageActionMenuProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unsendMessage = useChannelsStore((s) => s.unsendMessage);

  const canUnsend =
    isSent &&
    Date.now() - new Date(message.created_at).getTime() < UNSEND_WINDOW_MS;

  const mediaItems = parseMediaUrls(message.media_urls);
  const hasMedia = mediaItems.length > 0;
  const messageText = message.content?.trim();

  const handleReply = () => {
    onClose();
    onReply();
  };

  const handleShare = async () => {
    onClose();
    const shareContent = messageText || (hasMedia ? mediaItems[0].url : "");
    try {
      await Share.share({
        message: shareContent,
        url: hasMedia ? mediaItems[0].url : undefined,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const handleUnsend = () => {
    onClose();
    if (Platform.OS === "web") {
      if (window.confirm(t("messageActions.unsendConfirm"))) {
        unsendMessage(message.id);
      }
    } else {
      Alert.alert("", t("messageActions.unsendConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("messageActions.unsend"),
          style: "destructive",
          onPress: () => unsendMessage(message.id),
        },
      ]);
    }
  };

  const handleSave = async () => {
    onClose();
    if (hasMedia) {
      // Open media URL for download
      const url = mediaItems[0].url;
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      }
    } else if (messageText) {
      // Copy text to clipboard
      try {
        if (Platform.OS === "web" && navigator.clipboard) {
          await navigator.clipboard.writeText(messageText);
        }
        // Show brief feedback
        if (Platform.OS !== "web") {
          Alert.alert("", t("messageActions.copied"));
        }
      } catch {
        // Clipboard failed
      }
    }
  };

  const actions = [
    { key: "reply", icon: Reply, label: t("messageActions.reply"), onPress: handleReply },
    { key: "share", icon: Share2, label: t("messageActions.share"), onPress: handleShare },
    ...(canUnsend
      ? [{ key: "unsend", icon: Undo2, label: t("messageActions.unsend"), onPress: handleUnsend, destructive: true }]
      : []),
    { key: "save", icon: Download, label: t("messageActions.save"), onPress: handleSave },
  ];

  return (
    <>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 998,
        }}
      />

      {/* Menu */}
      <View
        style={[
          {
            position: "absolute",
            top: position.top,
            zIndex: 999,
            flexDirection: "row",
            borderRadius: 14,
            paddingHorizontal: 4,
            paddingVertical: 6,
            backgroundColor: colors.cardDarkBg,
            borderWidth: 1,
            borderColor: colors.cardDarkBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
          },
          isSent ? { right: position.right ?? 12 } : { left: position.left ?? 12 },
          Platform.OS === "web"
            ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any
            : {},
        ]}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const isDestructive = "destructive" in action && action.destructive;
          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              className="items-center px-3 py-1.5 active:opacity-60"
            >
              <Icon
                size={18}
                color={isDestructive ? "#EF4444" : colors.textSecondary}
              />
              <Text
                className="text-[10px] mt-1 font-medium"
                style={{
                  color: isDestructive ? "#EF4444" : colors.textSecondary,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

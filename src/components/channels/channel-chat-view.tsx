import { forwardRef, useState, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { ChannelMessage } from "@/types/database";
import MediaBubble, {
  StickerBubble,
  parseStickerContent,
  parseMediaUrls,
} from "@/components/messages/media-bubble";
import MessageActionMenu from "@/components/channels/message-action-menu";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

interface ChannelChatViewProps {
  messages: ChannelMessage[];
  currentStaffId: string;
  staffNames: Record<string, string>;
  memberReadTimes?: Record<string, string>;
  onReply: (message: ChannelMessage) => void;
}

const ChannelChatView = forwardRef<ScrollView, ChannelChatViewProps>(
  ({ messages, currentStaffId, staffNames, memberReadTimes, onReply }, ref) => {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{
      top: number;
      right?: number;
      left?: number;
    }>({ top: 0 });

    const containerRef = useRef<View>(null);
    const bubbleRefs = useRef<Record<string, View | null>>({});

    const handleLongPress = useCallback(
      (msg: ChannelMessage, isSent: boolean) => {
        if (msg.deleted_at) return;

        const bubbleView = bubbleRefs.current[msg.id];
        const container = containerRef.current;
        if (!bubbleView || !container) {
          setMenuPosition({
            top: 100,
            ...(isSent ? { right: 12 } : { left: 12 }),
          });
          setActiveMenuId(msg.id);
          return;
        }

        bubbleView.measureLayout(
          container as any,
          (_left, top, _width, _height) => {
            setMenuPosition({
              top: Math.max(0, top - 50),
              ...(isSent ? { right: 12 } : { left: 12 }),
            });
            setActiveMenuId(msg.id);
          },
          () => {
            setMenuPosition({
              top: 100,
              ...(isSent ? { right: 12 } : { left: 12 }),
            });
            setActiveMenuId(msg.id);
          }
        );
      },
      []
    );

    const handleReply = useCallback(
      (msg: ChannelMessage) => {
        setActiveMenuId(null);
        onReply(msg);
      },
      [onReply]
    );

    // Build a lookup for reply-to messages
    const messageMap = new Map(messages.map((m) => [m.id, m]));

    return (
      <View ref={containerRef} style={{ flex: 1, position: "relative" }}>
        <ScrollView
          ref={ref}
          className="flex-1 px-3"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          onContentSizeChange={() => {
            if (ref && "current" in ref && ref.current) {
              ref.current.scrollToEnd({ animated: false });
            }
          }}
        >
          {messages.map((msg, index) => {
            const isSent = msg.sender_id === currentStaffId;
            const showDateSep = shouldShowDateSeparator(
              index > 0 ? messages[index - 1] : null,
              msg
            );

            const replyTo = msg.reply_to_id
              ? messageMap.get(msg.reply_to_id) ?? null
              : null;

            // Compute read status for sent messages
            let readByNames: string[] | undefined;
            if (isSent && memberReadTimes && !msg.deleted_at) {
              const msgTime = new Date(msg.created_at).getTime();
              readByNames = Object.entries(memberReadTimes)
                .filter(
                  ([sid, readAt]) =>
                    sid !== currentStaffId &&
                    new Date(readAt).getTime() >= msgTime
                )
                .map(([sid]) => staffNames[sid] || sid.slice(0, 8));
            }

            return (
              <View key={msg.id}>
                {showDateSep && (
                  <DateSeparator
                    date={msg.created_at}
                    dateLocale={dateLocale}
                    t={t}
                    colors={colors}
                  />
                )}
                <View
                  ref={(r) => {
                    bubbleRefs.current[msg.id] = r;
                  }}
                >
                  <ChannelBubble
                    message={msg}
                    isSent={isSent}
                    senderName={
                      staffNames[msg.sender_id] || msg.sender_id.slice(0, 8)
                    }
                    dateLocale={dateLocale}
                    colors={colors}
                    replyTo={replyTo}
                    replyToSenderName={
                      replyTo
                        ? staffNames[replyTo.sender_id] ||
                          replyTo.sender_id.slice(0, 8)
                        : undefined
                    }
                    onLongPress={() => handleLongPress(msg, isSent)}
                    readByNames={readByNames}
                    t={t}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Action menu overlay */}
        {activeMenuId && (() => {
          const activeMsg = messages.find((m) => m.id === activeMenuId);
          if (!activeMsg) return null;
          return (
            <MessageActionMenu
              message={activeMsg}
              isSent={activeMsg.sender_id === currentStaffId}
              position={menuPosition}
              onReply={() => handleReply(activeMsg)}
              onClose={() => setActiveMenuId(null)}
            />
          );
        })()}
      </View>
    );
  }
);

ChannelChatView.displayName = "ChannelChatView";
export default ChannelChatView;

/* ─── Chat bubble ─── */
function ChannelBubble({
  message,
  isSent,
  senderName,
  dateLocale,
  colors,
  replyTo,
  replyToSenderName,
  onLongPress,
  readByNames,
  t,
}: {
  message: ChannelMessage;
  isSent: boolean;
  senderName: string;
  dateLocale: string;
  colors: ThemeColors;
  replyTo: ChannelMessage | null;
  replyToSenderName?: string;
  onLongPress: () => void;
  readByNames?: string[];
  t: (key: string) => string;
}) {
  const time = new Date(message.created_at).toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Deleted (unsent) message
  if (message.deleted_at) {
    return (
      <View
        className={`mb-2 flex-row ${isSent ? "justify-end" : "justify-start"}`}
      >
        <View
          className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}
        >
          {!isSent && (
            <Text
              className="text-xs mb-0.5 ml-2"
              style={{ color: colors.chatSenderName }}
            >
              {senderName}
            </Text>
          )}
          <View
            className="px-3 py-2 rounded-2xl"
            style={{
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              borderStyle: "dashed",
            }}
          >
            <Text
              className="text-sm italic"
              style={{ color: colors.textMuted }}
            >
              {t("messageActions.unsent")}
            </Text>
          </View>
          <Text
            className="text-[10px] mt-0.5 mx-2"
            style={{ color: colors.chatTimestamp }}
          >
            {time}
          </Text>
        </View>
      </View>
    );
  }

  const stickerEmoji = parseStickerContent(message.content);
  const mediaItems = parseMediaUrls(message.media_urls);

  // Reply quote block
  const replyQuote = replyTo ? (
    <View
      className="px-2.5 py-1.5 mb-1 rounded-lg"
      style={{
        backgroundColor: isSent
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.06)",
        borderLeftWidth: 3,
        borderLeftColor: colors.accentColor,
      }}
    >
      <Text
        className="text-[10px] font-semibold mb-0.5"
        style={{ color: colors.accentColor }}
      >
        {replyToSenderName}
      </Text>
      <Text
        className="text-xs"
        numberOfLines={2}
        style={{ color: colors.textMuted }}
      >
        {replyTo.deleted_at
          ? t("messageActions.unsent")
          : replyTo.content || "[media]"}
      </Text>
    </View>
  ) : null;

  if (stickerEmoji) {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        className={`mb-2 flex-row ${isSent ? "justify-end" : "justify-start"}`}
      >
        <View
          className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}
        >
          {!isSent && (
            <Text
              className="text-xs mb-0.5 ml-2"
              style={{ color: colors.chatSenderName }}
            >
              {senderName}
            </Text>
          )}
          {replyQuote}
          <StickerBubble sticker={stickerEmoji} />
          <View className="flex-row items-center mt-0.5 mx-2 gap-1">
            <Text
              className="text-[10px]"
              style={{ color: colors.chatTimestamp }}
            >
              {time}
            </Text>
            {isSent && readByNames && readByNames.length > 0 && (
              <Text
                className="text-[10px]"
                style={{ color: colors.accentColor }}
              >
                {t("readReceipts.read")}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`mb-2 flex-row ${isSent ? "justify-end" : "justify-start"}`}
    >
      <View
        className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}
      >
        {!isSent && (
          <Text
            className="text-xs mb-0.5 ml-2"
            style={{ color: colors.chatSenderName }}
          >
            {senderName}
          </Text>
        )}

        {replyQuote}

        {mediaItems.length > 0 && (
          <MediaBubble mediaUrls={mediaItems} isSent={isSent} />
        )}

        {message.content.trim() !== "" && (
          <View
            className={`px-3 py-2 rounded-2xl ${
              isSent ? "rounded-br-sm" : "rounded-bl-sm"
            }`}
            style={[
              {
                backgroundColor: isSent
                  ? colors.sentBubbleBg
                  : colors.receivedBubbleBg,
                borderWidth: 1,
                borderColor: isSent
                  ? colors.sentBubbleBorder
                  : colors.receivedBubbleBorder,
              },
              Platform.OS === "web"
                ? {
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  } as any
                : {},
            ]}
          >
            <Text
              className="text-base leading-6"
              style={{ color: colors.chatText }}
            >
              {message.content}
            </Text>
          </View>
        )}

        <View className="flex-row items-center mt-0.5 mx-2 gap-1">
          <Text
            className="text-[10px]"
            style={{ color: colors.chatTimestamp }}
          >
            {time}
          </Text>
          {isSent && readByNames && readByNames.length > 0 && (
            <Text
              className="text-[10px]"
              style={{ color: colors.accentColor }}
            >
              {t("readReceipts.read")}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/* ─── Date separator ─── */
function DateSeparator({
  date,
  dateLocale,
  t,
  colors,
}: {
  date: string;
  dateLocale: string;
  t: (key: string) => string;
  colors: ThemeColors;
}) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  let label: string;
  if (isSameDay(d, today)) {
    label = t("messages.today");
  } else if (isSameDay(d, yesterday)) {
    label = t("messages.yesterday");
  } else {
    label = d.toLocaleDateString(dateLocale, {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <View className="items-center my-3">
      <View
        className="px-3 py-1 rounded-full"
        style={{
          backgroundColor: colors.dateSepBg,
          borderWidth: 1,
          borderColor: colors.dateSepBorder,
        }}
      >
        <Text className="text-xs" style={{ color: colors.dateSepText }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/* ─── Helpers ─── */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function shouldShowDateSeparator(
  prev: ChannelMessage | null,
  current: ChannelMessage
): boolean {
  if (!prev) return true;
  return !isSameDay(new Date(prev.created_at), new Date(current.created_at));
}

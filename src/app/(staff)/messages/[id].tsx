import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { uploadImage, uploadAudio } from "@/lib/upload-media";
import { Message } from "@/types/database";
import ChatInputBar from "@/components/messages/chat-input-bar";
import MediaBubble, {
  StickerBubble,
  parseStickerContent,
  parseMediaUrls,
} from "@/components/messages/media-bubble";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

export default function MessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const scrollRef = useRef<ScrollView>(null);

  const [rootMessage, setRootMessage] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(false);

  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  useEffect(() => {
    if (!id) return;
    fetchThread();
  }, [id]);

  const fetchThread = async () => {
    setIsLoading(true);
    setError(null);

    const { data: clickedMsg, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !clickedMsg) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    const msg = clickedMsg as Message;
    const threadId = msg.thread_id ?? msg.id;
    setRootMessage(msg);

    const { data: threadData } = await supabase
      .from("messages")
      .select("*")
      .or(`id.eq.${threadId},thread_id.eq.${threadId}`)
      .order("created_at", { ascending: true });

    setThreadMessages((threadData ?? []) as Message[]);
    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const insertMessage = async (
    content: string,
    mediaUrls: unknown[] = []
  ) => {
    if (!organizationId || !session || !profile || !rootMessage) return null;

    const staffName = "full_name" in profile ? profile.full_name : "";
    const threadId = rootMessage.thread_id ?? rootMessage.id;

    const { data: newMsg, error: insertError } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        sender_name: staffName,
        sender_type: "admin" as const,
        sender_user_id: session.user.id,
        receiver_name: rootMessage.sender_name,
        receiver_type: rootMessage.sender_type,
        primary_student: rootMessage.primary_student,
        additional_students: [],
        message_type: rootMessage.message_type,
        priority: "low" as const,
        action_required: false,
        original_content: content,
        media_urls: mediaUrls,
        staff_responded: true,
        response_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        thread_id: threadId,
      })
      .select()
      .single();

    if (insertError) {
      setError(t("messages.replyError"));
      return null;
    }

    // Mark root message as responded
    await supabase
      .from("messages")
      .update({
        staff_responded: true,
        response_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    return newMsg as Message;
  };

  const addMessageToThread = (msg: Message) => {
    setThreadMessages((prev) => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ─── Send handlers ───
  const handleSendText = async (text: string) => {
    setIsSending(true);
    const msg = await insertMessage(text);
    if (msg) addMessageToThread(msg);
    setIsSending(false);
  };

  const handleSendImage = async (uri: string) => {
    if (!organizationId) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadImage(uri, organizationId);
      const msg = await insertMessage("", [
        { type: "image", url: publicUrl },
      ]);
      if (msg) addMessageToThread(msg);
    } catch {
      setError(t("messages.replyError"));
    }
    setIsSending(false);
  };

  const handleSendSticker = async (sticker: string) => {
    setIsSending(true);
    const msg = await insertMessage(`[sticker:${sticker}]`);
    if (msg) addMessageToThread(msg);
    setIsSending(false);
  };

  const handleSendVoice = async (uri: string, durationMs: number, mimeType: string) => {
    if (!organizationId) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadAudio(uri, organizationId, mimeType);
      const msg = await insertMessage("", [
        { type: "audio", url: publicUrl, duration_ms: durationMs },
      ]);
      if (msg) addMessageToThread(msg);
    } catch {
      setError(t("messages.replyError"));
    }
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={colors.staffGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator size="large" color={colors.loaderColor} />
      </LinearGradient>
    );
  }

  if (error || !rootMessage) {
    return (
      <LinearGradient
        colors={colors.staffGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <Text className="text-base text-center" style={{ color: colors.errorText }}>
          {error ?? t("common.error")}
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/messages" as any)}
          className="mt-4 px-6 py-2 rounded-lg"
          style={{ backgroundColor: colors.accentBg }}
        >
          <Text className="font-medium" style={{ color: colors.textPrimary }}>{t("common.back")}</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const currentUserId = session?.user?.id;
  const otherPartyName =
    rootMessage.sender_user_id === currentUserId
      ? rootMessage.receiver_name
      : rootMessage.sender_name;
  const hasAiAnalysis = rootMessage.summary || rootMessage.context;

  const priorityBadgeBg =
    rootMessage.priority === "high"
      ? colors.highBg
      : rootMessage.priority === "medium"
      ? colors.mediumBg
      : colors.lowBg;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <LinearGradient
        colors={colors.staffGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          className="pt-14 pb-3 px-4 flex-row items-center z-10"
          style={[
            {
              backgroundColor: colors.headerBg,
              borderBottomWidth: 1,
              borderBottomColor: colors.headerBorder,
            },
            Platform.OS === "web"
              ? { backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" } as any
              : {},
          ]}
        >
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/messages" as any)}
            className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold" numberOfLines={1} style={{ color: colors.textPrimary }}>
              {otherPartyName}
            </Text>
            <Text className="text-xs" style={{ color: colors.accentColor }}>
              {t(`messageType.${rootMessage.message_type}`)}
              {rootMessage.primary_student
                ? ` · ${rootMessage.primary_student}`
                : ""}
            </Text>
          </View>
          {/* Priority badge */}
          <View
            className="px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: priorityBadgeBg,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
            }}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.textPrimary }}>
              {t(`priority.${rootMessage.priority}`)}
            </Text>
          </View>
        </View>

        {/* AI Insights */}
        {hasAiAnalysis && (
          <Pressable
            onPress={() => setShowAiInsights(!showAiInsights)}
            style={[
              {
                backgroundColor: colors.insightsBg,
                borderBottomWidth: 1,
                borderBottomColor: colors.insightsBorder,
                paddingHorizontal: 16,
                paddingVertical: 8,
              },
              Platform.OS === "web"
                ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any
                : {},
            ]}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold" style={{ color: colors.insightsLabel }}>
                {t("messages.aiInsights")}
              </Text>
              {showAiInsights ? (
                <ChevronUp size={16} color={colors.insightsIcon} />
              ) : (
                <ChevronDown size={16} color={colors.insightsIcon} />
              )}
            </View>
            {showAiInsights && (
              <View className="mt-2">
                {rootMessage.summary && (
                  <View className="mb-2">
                    <Text className="text-xs mb-0.5" style={{ color: colors.insightsLabel }}>
                      {t("messages.summary")}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.insightsText }}>
                      {rootMessage.summary}
                    </Text>
                  </View>
                )}
                {rootMessage.context && (
                  <View className="mb-2">
                    <Text className="text-xs mb-0.5" style={{ color: colors.insightsLabel }}>
                      {t("messages.context")}
                    </Text>
                    <Text className="text-sm" style={{ color: colors.insightsText }}>
                      {rootMessage.context}
                    </Text>
                  </View>
                )}
                {rootMessage.confidence && (
                  <Text className="text-xs" style={{ color: colors.textTertiary }}>
                    {t("messages.confidence")}:{" "}
                    {t(
                      `messages.confidence${
                        rootMessage.confidence.charAt(0).toUpperCase() +
                        rootMessage.confidence.slice(1)
                      }`
                    )}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        )}

        {/* Chat messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-3"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {threadMessages.map((msg, index) => {
            const isSent = msg.sender_user_id === currentUserId;
            const showDateSep = shouldShowDateSeparator(
              index > 0 ? threadMessages[index - 1] : null,
              msg
            );

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
                <ChatBubble
                  message={msg}
                  isSent={isSent}
                  dateLocale={dateLocale}
                  colors={colors}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* Enhanced input bar */}
        <ChatInputBar
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendSticker={handleSendSticker}
          onSendVoice={handleSendVoice}
          isSending={isSending}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

/* ─── Chat bubble component ─── */
function ChatBubble({
  message,
  isSent,
  dateLocale,
  colors,
}: {
  message: Message;
  isSent: boolean;
  dateLocale: string;
  colors: ThemeColors;
}) {
  const time = new Date(message.created_at).toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const stickerEmoji = parseStickerContent(message.original_content);
  const mediaItems = parseMediaUrls(message.media_urls);

  // Sticker message
  if (stickerEmoji) {
    return (
      <View
        className={`mb-2 flex-row ${isSent ? "justify-end" : "justify-start"}`}
      >
        <View
          className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}
        >
          {!isSent && (
            <Text className="text-xs mb-0.5 ml-2" style={{ color: colors.chatSenderName }}>
              {message.sender_name}
            </Text>
          )}
          <StickerBubble sticker={stickerEmoji} />
          <Text className="text-[10px] mt-0.5 mx-2" style={{ color: colors.chatTimestamp }}>
            {time}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`mb-2 flex-row ${isSent ? "justify-end" : "justify-start"}`}
    >
      <View className={`max-w-[80%] ${isSent ? "items-end" : "items-start"}`}>
        {!isSent && (
          <Text className="text-xs mb-0.5 ml-2" style={{ color: colors.chatSenderName }}>
            {message.sender_name}
          </Text>
        )}

        {/* Media content */}
        {mediaItems.length > 0 && (
          <MediaBubble mediaUrls={mediaItems} isSent={isSent} />
        )}

        {/* Text content */}
        {message.original_content.trim() !== "" && (
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
                ? { backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } as any
                : {},
            ]}
          >
            <Text className="text-base leading-6" style={{ color: colors.chatText }}>
              {message.original_content}
            </Text>
          </View>
        )}

        <Text className="text-[10px] mt-0.5 mx-2" style={{ color: colors.chatTimestamp }}>{time}</Text>
      </View>
    </View>
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
        <Text className="text-xs" style={{ color: colors.dateSepText }}>{label}</Text>
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
  prev: Message | null,
  current: Message
): boolean {
  if (!prev) return true;
  return !isSameDay(new Date(prev.created_at), new Date(current.created_at));
}

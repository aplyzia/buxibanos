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
import { ChevronLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { detectAttendance } from "@/lib/detect-attendance";
import { uploadImage, uploadAudio } from "@/lib/upload-media";
import { Message } from "@/types/database";
import ChatInputBar from "@/components/messages/chat-input-bar";
import MediaBubble, {
  StickerBubble,
  parseStickerContent,
  parseMediaUrls,
} from "@/components/messages/media-bubble";
import { useTheme, type ThemeColors } from "@/theme";

export default function ParentMessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const scrollRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  const [rootMessage, setRootMessage] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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

    const parentName = "full_name" in profile ? profile.full_name : "";
    const threadId = rootMessage.thread_id ?? rootMessage.id;

    const { data: newMsg, error: insertError } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        sender_name: parentName,
        sender_type: "parent" as const,
        sender_user_id: session.user.id,
        receiver_name: rootMessage.receiver_name,
        receiver_type: rootMessage.receiver_type,
        primary_student: rootMessage.primary_student,
        additional_students: [],
        message_type: rootMessage.message_type,
        priority: "low" as const,
        action_required: false,
        original_content: content,
        media_urls: mediaUrls,
        staff_responded: false,
        processed_at: new Date().toISOString(),
        thread_id: threadId,
      })
      .select()
      .single();

    if (insertError) {
      setError(t("messages.replyError"));
      return null;
    }

    return newMsg as Message;
  };

  const addMessageToThread = (msg: Message) => {
    setThreadMessages((prev) => [...prev, msg]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const runAttendanceDetection = (msg: Message) => {
    if (!msg.primary_student || !organizationId) return;
    detectAttendance(msg.original_content)
      .then(async (result) => {
        if (!result.detected || !result.status) return;

        const { data: student } = await supabase
          .from("students")
          .select("id")
          .eq("organization_id", organizationId!)
          .eq("full_name", msg.primary_student!)
          .eq("enrollment_status", "active")
          .single();

        const studentId = student?.id;
        if (!studentId) return;

        const taipeiDate = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Taipei",
        });

        await supabase.from("attendance").upsert(
          {
            organization_id: organizationId!,
            student_id: studentId,
            class_id: "00000000-0000-0000-0000-000000000000",
            date: taipeiDate,
            status: result.status,
            recorded_by: studentId,
            parent_notified: true,
            notes: `AI detected: ${result.reasoning}`,
            source: "auto_message" as const,
            source_message_id: msg.id,
          },
          { onConflict: "student_id,class_id,date" }
        );

        await supabase
          .from("messages")
          .update({
            message_type: "attendance",
            summary:
              result.status === "absent"
                ? "家長通知：學生今天缺席"
                : "家長通知：學生今天會遲到",
            confidence: result.confidence,
            context: result.reasoning,
          })
          .eq("id", msg.id);
      })
      .catch(() => {});
  };

  // ─── Send handlers ───
  const handleSendText = async (text: string) => {
    setIsSending(true);
    const msg = await insertMessage(text);
    if (msg) {
      addMessageToThread(msg);
      runAttendanceDetection(msg);
    }
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
        colors={["#0C4A6E", "#155E75", "#1E40AF", "#3730A3"] as const}
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
        colors={["#0C4A6E", "#155E75", "#1E40AF", "#3730A3"] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <Text className="text-base text-center" style={{ color: colors.errorText }}>
          {error ?? t("common.error")}
        </Text>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(parent)/messages" as any)}
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

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#0C4A6E", "#155E75", "#1E40AF", "#3730A3"] as const}
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
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(parent)/messages" as any)}
            className="mr-2 w-11 h-11 items-center justify-center rounded-full active:bg-white/20"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold" style={{ color: colors.textPrimary }} numberOfLines={1}>
              {otherPartyName}
            </Text>
            {rootMessage.primary_student && (
              <Text className="text-xs" style={{ color: colors.accentColor, opacity: 0.7 }}>
                {rootMessage.primary_student}
              </Text>
            )}
          </View>
        </View>

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

  // Sticker message — no bubble background
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

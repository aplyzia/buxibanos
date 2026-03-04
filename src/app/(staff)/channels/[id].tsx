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
import { ChevronLeft, Users } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth-store";
import { useChannelsStore } from "@/stores/channels-store";
import { uploadImage, uploadAudio, uploadDocument } from "@/lib/upload-media";
import ChatInputBar from "@/components/messages/chat-input-bar";
import ChannelChatView from "@/components/channels/channel-chat-view";
import PinnedPanel from "@/components/channels/pinned-panel";
import MemberManagementSheet from "@/components/channels/member-management-sheet";
import type { ChannelMessage } from "@/types/database";
import { useTheme } from "@/theme";

export default function StaffChannelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const scrollRef = useRef<ScrollView>(null);

  const {
    channelMessages,
    isLoadingMessages,
    staffNames,
    channels,
    channelTasks,
    channelEvents,
    channelMemberReadTimes,
    fetchChannelMessages,
    fetchChannelItems,
    fetchChannelMemberReads,
    sendMessage,
    markChannelRead,
    updateChannelPriority,
  } = useChannelsStore();

  const staffId = profile && "id" in profile ? profile.id : "";
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    message: ChannelMessage;
    senderName: string;
  } | null>(null);
  const [showMemberSheet, setShowMemberSheet] = useState(false);

  const channel = channels.find((ch) => ch.id === id);

  useEffect(() => {
    if (!id || !staffId) return;
    fetchChannelMessages(id);
    fetchChannelItems(id);
    fetchChannelMemberReads(id);
    markChannelRead(id, staffId);
  }, [id, staffId]);

  const displayName =
    channel?.type === "direct"
      ? channel.memberIds
          .filter((mid) => mid !== staffId)
          .map((mid) => staffNames[mid] || mid.slice(0, 8))
          .join(", ")
      : channel?.name || t("channels.group");

  const memberCount = channel?.memberIds.length ?? 0;

  const handleSendText = async (text: string) => {
    if (!id) return;
    const replyToId = replyingTo?.message.id;
    setReplyingTo(null);
    setIsSending(true);
    await sendMessage(id, staffId, text, undefined, replyToId);
    setIsSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSendImage = async (uri: string) => {
    if (!id || !organizationId) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadImage(uri, organizationId);
      await sendMessage(id, staffId, "", [
        { type: "image", url: publicUrl },
      ]);
    } catch {
      // Handle error
    }
    setIsSending(false);
  };

  const handleSendSticker = async (sticker: string) => {
    if (!id) return;
    setIsSending(true);
    await sendMessage(id, staffId, `[sticker:${sticker}]`);
    setIsSending(false);
  };

  const handleSendVoice = async (
    uri: string,
    durationMs: number,
    mimeType: string
  ) => {
    if (!id || !organizationId) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadAudio(uri, organizationId, mimeType);
      await sendMessage(id, staffId, "", [
        { type: "audio", url: publicUrl, duration_ms: durationMs },
      ]);
    } catch {
      // Handle error
    }
    setIsSending(false);
  };

  const handleSendDocument = async (
    uri: string,
    fileName: string,
    mimeType: string
  ) => {
    if (!id || !organizationId) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadDocument(uri, organizationId, fileName, mimeType);
      await sendMessage(id, staffId, "", [
        { type: "document", url: publicUrl, file_name: fileName },
      ]);
    } catch {
      // Handle error
    }
    setIsSending(false);
  };

  if (isLoadingMessages) {
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
              ? {
                  backdropFilter: "blur(30px)",
                  WebkitBackdropFilter: "blur(30px)",
                } as any
              : {},
          ]}
        >
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/channels" as any)}
            className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-lg font-bold"
              numberOfLines={1}
              style={{ color: colors.textPrimary }}
            >
              {displayName}
            </Text>
            {channel?.type === "group" && (
              <Text className="text-xs" style={{ color: colors.accentColor }}>
                {t("channels.members", { count: memberCount })}
              </Text>
            )}
          </View>
          {/* Priority badge (tap to cycle) */}
          {channel && (
            <Pressable
              onPress={() => {
                const cycle = { low: "medium", medium: "high", high: "low" } as const;
                const next = cycle[channel.priority ?? "low"];
                updateChannelPriority(channel.id, next);
              }}
              className="px-2.5 py-1 rounded-full mr-2"
              style={{
                backgroundColor:
                  channel.priority === "high"
                    ? colors.highBg
                    : channel.priority === "medium"
                    ? colors.mediumBg
                    : colors.lowBg,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color:
                    channel.priority === "high"
                      ? colors.highText
                      : channel.priority === "medium"
                      ? colors.mediumText
                      : colors.lowText,
                }}
              >
                {t(`priority.${channel.priority ?? "low"}`)}
              </Text>
            </Pressable>
          )}
          {channel?.type === "group" && (
            <Pressable
              onPress={() => setShowMemberSheet(true)}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
              style={{ backgroundColor: colors.surfaceBg }}
            >
              <Users size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Pinned panel */}
        <PinnedPanel
          tasks={channelTasks}
          events={channelEvents}
          channelId={id!}
          staffId={staffId}
          staffNames={staffNames}
          memberIds={channel?.memberIds ?? []}
        />

        {/* Chat messages */}
        <ChannelChatView
          ref={scrollRef}
          messages={channelMessages}
          currentStaffId={staffId}
          staffNames={staffNames}
          memberReadTimes={channelMemberReadTimes}
          onReply={(msg) =>
            setReplyingTo({
              message: msg,
              senderName:
                staffNames[msg.sender_id] || msg.sender_id.slice(0, 8),
            })
          }
        />

        {/* Input bar */}
        <ChatInputBar
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSendSticker={handleSendSticker}
          onSendVoice={handleSendVoice}
          onSendDocument={handleSendDocument}
          isSending={isSending}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
        {/* Member management sheet */}
        {channel?.type === "group" && (
          <MemberManagementSheet
            visible={showMemberSheet}
            onClose={() => setShowMemberSheet(false)}
            channelId={id!}
            currentStaffId={staffId}
            memberIds={channel.memberIds}
            createdBy={channel.created_by}
            staffNames={staffNames}
            onLeave={() => router.back()}
          />
        )}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Image,
  Linking,
  Platform,
} from "react-native";
import { X, FileText, ExternalLink, Play, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import {
  AnnouncementWithRecipient,
  useAnnouncementsStore,
} from "@/stores/announcements-store";

interface AnnouncementDetailModalProps {
  announcement: AnnouncementWithRecipient | null;
  visible: boolean;
  onClose: () => void;
  parentId: string;
}

interface MediaItem {
  type: "image" | "document" | "video";
  url: string;
  file_name?: string;
}

export default function AnnouncementDetailModal({
  announcement,
  visible,
  onClose,
  parentId,
}: AnnouncementDetailModalProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const markViewed = useAnnouncementsStore((s) => s.markViewed);
  const respondToAnnouncement = useAnnouncementsStore(
    (s) => s.respondToAnnouncement
  );
  const dismissAnnouncement = useAnnouncementsStore(
    (s) => s.dismissAnnouncement
  );

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";

  // Mark as viewed when modal opens
  useEffect(() => {
    if (visible && announcement && announcement.recipient?.status === "sent") {
      markViewed(announcement.id, parentId);
    }
  }, [visible, announcement?.id]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedOption(null);
      setFreeText("");
      setFullscreenImage(null);
    }
  }, [visible]);

  if (!announcement) return null;

  const mediaItems: MediaItem[] = Array.isArray(announcement.media_urls)
    ? (announcement.media_urls as unknown as MediaItem[])
    : [];

  const responseOptions: string[] = Array.isArray(announcement.response_options)
    ? (announcement.response_options as string[])
    : [];

  const hasResponded = announcement.recipient?.status === "responded";
  const isDismissed = announcement.recipient?.status === "dismissed";
  const respondedValue = announcement.recipient?.response_value;

  const handleRespond = async () => {
    if (!selectedOption) return;
    await respondToAnnouncement(
      announcement.id,
      parentId,
      selectedOption,
      freeText.trim() || undefined
    );
    onClose();
  };

  const handleDismiss = async () => {
    await dismissAnnouncement(announcement.id, parentId);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <View
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <Pressable className="flex-1" onPress={onClose} />
          <View
            className="rounded-t-3xl px-5 pt-5 pb-8"
            style={{
              backgroundColor: colors.cardDarkBg,
              borderTopWidth: 1,
              borderTopColor: colors.cardDarkBorder,
              maxHeight: "85%",
            }}
          >
            {/* Header */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 mr-3">
                {announcement.priority === "urgent" && (
                  <View
                    className="self-start px-2 py-0.5 rounded-full mb-1.5"
                    style={{ backgroundColor: "rgba(239,68,68,0.2)" }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: "#EF4444" }}
                    >
                      {t("announcements.urgent")}
                    </Text>
                  </View>
                )}
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {announcement.title}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textMuted }}
                >
                  {new Date(announcement.created_at).toLocaleDateString(
                    dateLocale,
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: colors.surfaceBg }}
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Body */}
              <Text
                className="text-sm leading-6 mb-4"
                style={{ color: colors.textSecondary }}
              >
                {announcement.body}
              </Text>

              {/* Media */}
              {mediaItems.length > 0 && (
                <View className="mb-4 gap-2">
                  {mediaItems.map((item, idx) => (
                    <MediaItemView
                      key={idx}
                      item={item}
                      colors={colors}
                      onImagePress={(url) => setFullscreenImage(url)}
                    />
                  ))}
                </View>
              )}

              {/* Response section */}
              {responseOptions.length > 0 && (
                <View className="mt-2">
                  {hasResponded ? (
                    // Already responded view
                    <View
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: colors.surfaceBg,
                        borderWidth: 1,
                        borderColor: colors.surfaceBorder,
                      }}
                    >
                      <View className="flex-row items-center gap-2 mb-1">
                        <Check size={14} color={colors.accentColor} />
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.accentColor }}
                        >
                          {t("announcements.responded")}
                        </Text>
                      </View>
                      <Text
                        className="text-sm"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("announcements.alreadyResponded", {
                          value: respondedValue,
                        })}
                      </Text>
                      {announcement.recipient?.free_text_value && (
                        <Text
                          className="text-xs mt-1"
                          style={{ color: colors.textMuted }}
                        >
                          {announcement.recipient.free_text_value}
                        </Text>
                      )}
                    </View>
                  ) : isDismissed ? (
                    // Dismissed view
                    <View
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: colors.surfaceBg,
                        borderWidth: 1,
                        borderColor: colors.surfaceBorder,
                      }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: colors.textMuted }}
                      >
                        {t("announcements.dismissed")}
                      </Text>
                    </View>
                  ) : (
                    // Response options
                    <View>
                      <Text
                        className="text-sm font-semibold mb-3"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("announcements.responsePrompt")}
                      </Text>
                      <View className="gap-2">
                        {responseOptions.map((option) => {
                          const isSelected = selectedOption === option;
                          return (
                            <Pressable
                              key={option}
                              onPress={() => setSelectedOption(option)}
                              className="px-4 py-3 rounded-xl active:opacity-70"
                              style={{
                                backgroundColor: isSelected
                                  ? colors.accentBg
                                  : colors.surfaceBg,
                                borderWidth: 1,
                                borderColor: isSelected
                                  ? colors.accentColor
                                  : colors.surfaceBorder,
                              }}
                            >
                              <Text
                                className="text-sm font-medium"
                                style={{
                                  color: isSelected
                                    ? colors.accentColor
                                    : colors.textPrimary,
                                }}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Free text input */}
                      {announcement.allow_free_text && (
                        <TextInput
                          className="mt-3 px-4 py-3 rounded-xl text-sm"
                          style={{
                            backgroundColor: colors.inputBg,
                            borderWidth: 1,
                            borderColor: colors.inputBorder,
                            color: colors.textPrimary,
                          }}
                          placeholder={t("announcements.freeTextPlaceholder")}
                          placeholderTextColor={colors.placeholderColor}
                          value={freeText}
                          onChangeText={setFreeText}
                          multiline
                          numberOfLines={2}
                          textAlignVertical="top"
                        />
                      )}

                      {/* Submit response button */}
                      {selectedOption && (
                        <Pressable
                          onPress={handleRespond}
                          className="mt-3 py-3 rounded-xl items-center active:opacity-70"
                          style={{
                            backgroundColor: colors.accentBg,
                            borderWidth: 1,
                            borderColor: colors.accentColor,
                          }}
                        >
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: colors.accentColor }}
                          >
                            {t("announcements.respond")}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Dismiss button — only shown if not already responded/dismissed */}
              {!hasResponded && !isDismissed && (
                <Pressable
                  onPress={handleDismiss}
                  className="mt-4 py-3 rounded-xl items-center active:opacity-70"
                  style={{
                    backgroundColor: colors.surfaceBg,
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: colors.textMuted }}
                  >
                    {t("announcements.dismiss")}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fullscreen image viewer */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/90">
          <Pressable
            onPress={() => setFullscreenImage(null)}
            className="absolute top-14 right-4 z-10 w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={{ width: "90%", height: "70%" }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

/* ─── Media Item Renderer ─── */
function MediaItemView({
  item,
  colors,
  onImagePress,
}: {
  item: MediaItem;
  colors: any;
  onImagePress: (url: string) => void;
}) {
  if (item.type === "image") {
    return (
      <Pressable onPress={() => onImagePress(item.url)} className="active:opacity-80">
        <Image
          source={{ uri: item.url }}
          className="rounded-xl"
          style={{ width: "100%", height: 200 }}
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  if (item.type === "video") {
    return (
      <Pressable
        onPress={() => Linking.openURL(item.url)}
        className="rounded-xl overflow-hidden active:opacity-80"
        style={{
          backgroundColor: colors.surfaceBg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        }}
      >
        <View
          className="h-40 items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        >
          <View
            className="w-14 h-14 rounded-full items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <Play size={24} color="#FFFFFF" />
          </View>
        </View>
        {item.file_name && (
          <View className="px-3 py-2">
            <Text
              className="text-xs"
              numberOfLines={1}
              style={{ color: colors.textSecondary }}
            >
              {item.file_name}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }

  // Document
  return (
    <Pressable
      onPress={() => Linking.openURL(item.url)}
      className="flex-row items-center px-4 py-3 rounded-xl active:opacity-70"
      style={{
        backgroundColor: colors.surfaceBg,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
    >
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: colors.accentBg }}
      >
        <FileText size={18} color={colors.accentColor} />
      </View>
      <Text
        className="text-sm flex-1"
        numberOfLines={1}
        style={{ color: colors.textPrimary }}
      >
        {item.file_name || "Document"}
      </Text>
      <ExternalLink size={14} color={colors.textMuted} />
    </Pressable>
  );
}

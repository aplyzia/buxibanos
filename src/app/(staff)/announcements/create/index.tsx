import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ImagePlus,
  FileText,
  Film,
  X,
  Plus,
  Check,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useAuthStore } from "@/stores/auth-store";
import { useAnnouncementsStore } from "@/stores/announcements-store";
import { useTierGate } from "@/hooks/use-tier-gate";
import { uploadImage, uploadDocument, uploadVideo } from "@/lib/upload-media";
import { supabase } from "@/lib/supabase";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

interface MediaAttachment {
  uri: string;
  type: "image" | "document" | "video";
  fileName: string;
  mimeType: string;
}

export default function CreateAnnouncementScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const createAnnouncement = useAnnouncementsStore((s) => s.createAnnouncement);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>(
    []
  );
  const [targetType, setTargetType] = useState<
    "all" | "by_class" | "individual"
  >("all");
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [targetParentIds, setTargetParentIds] = useState<string[]>([]);
  const [responseEnabled, setResponseEnabled] = useState(false);
  const [responseOptions, setResponseOptions] = useState<string[]>(["", ""]);
  const [allowFreeText, setAllowFreeText] = useState(false);

  const [aiPolish, setAiPolish] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { allowed: isPremium } = useTierGate("premium");

  // Data for target pickers
  const [availableClasses, setAvailableClasses] = useState<
    { id: string; name: string; subject: string }[]
  >([]);
  const [availableParents, setAvailableParents] = useState<
    { id: string; full_name: string }[]
  >([]);
  const [parentSearch, setParentSearch] = useState("");

  // Fetch classes and parents for targeting
  useEffect(() => {
    if (!organizationId) return;

    supabase
      .from("classes")
      .select("id, name, subject")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .then(({ data }) => setAvailableClasses((data as any) ?? []));

    supabase
      .from("parents")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .order("full_name")
      .then(({ data }) => setAvailableParents((data as any) ?? []));
  }, [organizationId]);

  const staffId =
    profile && "id" in profile ? (profile as { id: string }).id : null;

  const filteredParents = parentSearch.trim()
    ? availableParents.filter((p) =>
        p.full_name.toLowerCase().includes(parentSearch.toLowerCase())
      )
    : availableParents;

  // ─── Media Pickers ───
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: "image",
          fileName: asset.fileName || "image.jpg",
          mimeType: asset.mimeType || "image/jpeg",
        },
      ]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setMediaAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: "document",
          fileName: asset.name || "document",
          mimeType: asset.mimeType || "application/octet-stream",
        },
      ]);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          type: "video",
          fileName: asset.fileName || "video.mp4",
          mimeType: asset.mimeType || "video/mp4",
        },
      ]);
    }
  };

  const removeMedia = (index: number) => {
    setMediaAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Response Options ───
  const addResponseOption = () => {
    if (responseOptions.length >= 4) return;
    setResponseOptions((prev) => [...prev, ""]);
  };

  const updateResponseOption = (index: number, value: string) => {
    setResponseOptions((prev) =>
      prev.map((opt, i) => (i === index ? value : opt))
    );
  };

  const removeResponseOption = (index: number) => {
    if (responseOptions.length <= 2) return;
    setResponseOptions((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Target toggles ───
  const toggleClassId = (classId: string) => {
    setTargetClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleParentId = (parentId: string) => {
    setTargetParentIds((prev) =>
      prev.includes(parentId)
        ? prev.filter((id) => id !== parentId)
        : [...prev, parentId]
    );
  };

  // ─── Publish ───
  const handlePublish = async () => {
    if (!title.trim() || !body.trim() || !organizationId || !staffId) return;

    setIsPublishing(true);
    setError(null);

    try {
      // Upload all media
      const uploadedMedia = await Promise.all(
        mediaAttachments.map(async (m) => {
          let url: string;
          if (m.type === "image") {
            url = await uploadImage(m.uri, organizationId);
          } else if (m.type === "video") {
            url = await uploadVideo(m.uri, organizationId, m.fileName, m.mimeType);
          } else {
            url = await uploadDocument(m.uri, organizationId, m.fileName, m.mimeType);
          }
          return { type: m.type, url, file_name: m.fileName };
        })
      );

      // Filter out empty response options
      const validOptions = responseEnabled
        ? responseOptions.filter((o) => o.trim())
        : null;

      const id = await createAnnouncement({
        organizationId,
        title: title.trim(),
        body: body.trim(),
        createdBy: staffId,
        priority,
        mediaUrls: uploadedMedia,
        targetType,
        targetClassIds: targetType === "by_class" ? targetClassIds : [],
        targetParentIds: targetType === "individual" ? targetParentIds : [],
        responseOptions: validOptions && validOptions.length >= 2 ? validOptions : null,
        allowFreeText: responseEnabled ? allowFreeText : false,
      });

      if (id) {
        router.replace("/(staff)/announcements" as any);
      } else {
        setError(t("announcements.publishError"));
      }
    } catch {
      setError(t("announcements.publishError"));
    }

    setIsPublishing(false);
  };

  const isDisabled = isPublishing || !title.trim() || !body.trim();

  return (
    <GlassBackground variant="staff">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="pt-14 pb-3 px-4 flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/announcements" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text
            className="text-lg font-bold"
            style={{ color: colors.textPrimary }}
          >
            {t("announcements.create")}
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-4 pt-2"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Title field */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {t("announcements.titleField")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              }}
              placeholder={t("announcements.titlePlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={title}
              onChangeText={setTitle}
              editable={!isPublishing}
            />
          </View>

          {/* Body field */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              {t("announcements.bodyField")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                minHeight: 120,
                color: colors.textPrimary,
              }}
              placeholder={t("announcements.bodyPlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={body}
              onChangeText={setBody}
              editable={!isPublishing}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* AI Polish — Premium only */}
          {isPremium && (
            <View className="mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("announcements.aiPolish")}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                    {t("announcements.aiPolishHint")}
                  </Text>
                </View>
                <Switch
                  value={aiPolish}
                  onValueChange={setAiPolish}
                  trackColor={{ false: colors.surfaceBorder, true: colors.accentColor }}
                />
              </View>
            </View>
          )}

          {/* Priority toggle */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("announcements.priority")}
            </Text>
            <View className="flex-row gap-2">
              {(["normal", "urgent"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  className="flex-1 py-2.5 rounded-xl items-center active:opacity-70"
                  style={{
                    backgroundColor:
                      priority === p ? (p === "urgent" ? "rgba(239,68,68,0.2)" : colors.accentBg) : colors.surfaceBg,
                    borderWidth: 1,
                    borderColor:
                      priority === p ? (p === "urgent" ? "#EF4444" : colors.accentColor) : colors.surfaceBorder,
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color:
                        priority === p ? (p === "urgent" ? "#EF4444" : colors.accentColor) : colors.textSecondary,
                    }}
                  >
                    {t(`announcements.priority${p === "normal" ? "Normal" : "Urgent"}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Media attachments */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("announcements.mediaSection")}
            </Text>
            <View className="flex-row gap-2 mb-2">
              <Pressable
                onPress={pickImage}
                className="flex-1 py-3 rounded-xl items-center flex-row justify-center gap-1.5 active:opacity-70"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                <ImagePlus size={14} color={colors.textSecondary} />
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("announcements.addImage")}
                </Text>
              </Pressable>
              <Pressable
                onPress={pickDocument}
                className="flex-1 py-3 rounded-xl items-center flex-row justify-center gap-1.5 active:opacity-70"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                <FileText size={14} color={colors.textSecondary} />
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("announcements.addDocument")}
                </Text>
              </Pressable>
              <Pressable
                onPress={pickVideo}
                className="flex-1 py-3 rounded-xl items-center flex-row justify-center gap-1.5 active:opacity-70"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                <Film size={14} color={colors.textSecondary} />
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("announcements.addVideo")}
                </Text>
              </Pressable>
            </View>
            {/* Attached media list */}
            {mediaAttachments.map((m, idx) => (
              <View
                key={idx}
                className="flex-row items-center px-3 py-2 mb-1 rounded-lg"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                {m.type === "image" ? (
                  <Image
                    source={{ uri: m.uri }}
                    className="w-8 h-8 rounded mr-2"
                  />
                ) : m.type === "video" ? (
                  <Film size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                ) : (
                  <FileText size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                )}
                <Text
                  className="text-xs flex-1"
                  numberOfLines={1}
                  style={{ color: colors.textPrimary }}
                >
                  {m.fileName}
                </Text>
                <Pressable onPress={() => removeMedia(idx)} className="p-1">
                  <X size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>

          {/* Target audience */}
          <View className="mb-4">
            <Text
              className="text-sm font-medium mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("announcements.targetAudience")}
            </Text>
            <View className="flex-row gap-2 mb-2">
              {(["all", "by_class", "individual"] as const).map((tt) => (
                <Pressable
                  key={tt}
                  onPress={() => setTargetType(tt)}
                  className="flex-1 py-2.5 rounded-xl items-center active:opacity-70"
                  style={{
                    backgroundColor:
                      targetType === tt ? colors.accentBg : colors.surfaceBg,
                    borderWidth: 1,
                    borderColor:
                      targetType === tt
                        ? colors.accentColor
                        : colors.surfaceBorder,
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color:
                        targetType === tt
                          ? colors.accentColor
                          : colors.textSecondary,
                    }}
                  >
                    {t(
                      `announcements.target${
                        tt === "all"
                          ? "All"
                          : tt === "by_class"
                          ? "ByClass"
                          : "Individual"
                      }`
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Class selector */}
            {targetType === "by_class" && (
              <View
                className="rounded-xl p-3"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                <Text
                  className="text-xs font-medium mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("announcements.selectClasses")}
                  {targetClassIds.length > 0 &&
                    ` (${t("announcements.selectedCount", { count: targetClassIds.length })})`}
                </Text>
                {availableClasses.map((cls) => {
                  const isSelected = targetClassIds.includes(cls.id);
                  return (
                    <Pressable
                      key={cls.id}
                      onPress={() => toggleClassId(cls.id)}
                      className="flex-row items-center py-2 px-2"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surfaceBorder,
                      }}
                    >
                      <View
                        className="w-5 h-5 rounded mr-2.5 items-center justify-center"
                        style={{
                          backgroundColor: isSelected
                            ? colors.accentColor
                            : "transparent",
                          borderWidth: isSelected ? 0 : 1.5,
                          borderColor: colors.textMuted,
                        }}
                      >
                        {isSelected && (
                          <Check size={12} color="#FFFFFF" />
                        )}
                      </View>
                      <Text
                        className="text-sm flex-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {cls.name}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textMuted }}
                      >
                        {cls.subject}
                      </Text>
                    </Pressable>
                  );
                })}
                {availableClasses.length === 0 && (
                  <Text
                    className="text-sm py-2 text-center"
                    style={{ color: colors.textMuted }}
                  >
                    {t("common.loading")}
                  </Text>
                )}
              </View>
            )}

            {/* Parent selector */}
            {targetType === "individual" && (
              <View
                className="rounded-xl p-3"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                <TextInput
                  className="text-sm px-3 py-2 rounded-lg mb-2"
                  placeholder={t("announcements.searchParents")}
                  placeholderTextColor={colors.placeholderColor}
                  value={parentSearch}
                  onChangeText={setParentSearch}
                  style={{
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                  }}
                />
                {targetParentIds.length > 0 && (
                  <Text
                    className="text-xs mb-2"
                    style={{ color: colors.accentColor }}
                  >
                    {t("announcements.selectedCount", {
                      count: targetParentIds.length,
                    })}
                  </Text>
                )}
                <ScrollView style={{ maxHeight: 200 }}>
                  {filteredParents.map((p) => {
                    const isSelected = targetParentIds.includes(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => toggleParentId(p.id)}
                        className="flex-row items-center py-2 px-2"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: colors.surfaceBorder,
                        }}
                      >
                        <View
                          className="w-5 h-5 rounded mr-2.5 items-center justify-center"
                          style={{
                            backgroundColor: isSelected
                              ? colors.accentColor
                              : "transparent",
                            borderWidth: isSelected ? 0 : 1.5,
                            borderColor: colors.textMuted,
                          }}
                        >
                          {isSelected && (
                            <Check size={12} color="#FFFFFF" />
                          )}
                        </View>
                        <Text
                          className="text-sm flex-1"
                          style={{ color: colors.textPrimary }}
                        >
                          {p.full_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Response options */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                {t("announcements.responseSection")}
              </Text>
              <Switch
                value={responseEnabled}
                onValueChange={setResponseEnabled}
                trackColor={{
                  false: colors.surfaceBorder,
                  true: colors.accentColor,
                }}
              />
            </View>

            {responseEnabled && (
              <View
                className="rounded-xl p-3"
                style={{
                  backgroundColor: colors.surfaceBg,
                  borderWidth: 1,
                  borderColor: colors.surfaceBorder,
                }}
              >
                {responseOptions.map((opt, idx) => (
                  <View
                    key={idx}
                    className="flex-row items-center mb-2 gap-2"
                  >
                    <TextInput
                      className="flex-1 text-sm px-3 py-2 rounded-lg"
                      style={{
                        color: colors.textPrimary,
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                      }}
                      placeholder={t("announcements.optionPlaceholder", {
                        number: idx + 1,
                      })}
                      placeholderTextColor={colors.placeholderColor}
                      value={opt}
                      onChangeText={(v) => updateResponseOption(idx, v)}
                    />
                    {responseOptions.length > 2 && (
                      <Pressable
                        onPress={() => removeResponseOption(idx)}
                        className="p-1"
                      >
                        <X size={14} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                ))}
                {responseOptions.length < 4 && (
                  <Pressable
                    onPress={addResponseOption}
                    className="flex-row items-center justify-center gap-1 py-2 active:opacity-70"
                  >
                    <Plus size={14} color={colors.accentColor} />
                    <Text
                      className="text-xs"
                      style={{ color: colors.accentColor }}
                    >
                      {t("announcements.addOption")}
                    </Text>
                  </Pressable>
                )}

                {/* Free text toggle */}
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-white/10">
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("announcements.freeTextField")}
                  </Text>
                  <Switch
                    value={allowFreeText}
                    onValueChange={setAllowFreeText}
                    trackColor={{
                      false: colors.surfaceBorder,
                      true: colors.accentColor,
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Error */}
          {error && (
            <GlassCard className="px-4 py-3 mb-4">
              <Text
                className="text-sm text-center"
                style={{ color: colors.errorText }}
              >
                {error}
              </Text>
            </GlassCard>
          )}

          {/* Publish button */}
          <Pressable
            onPress={handlePublish}
            disabled={isDisabled}
            className={`rounded-xl py-4 items-center ${
              isDisabled ? "opacity-40" : "active:opacity-80"
            }`}
            style={{
              backgroundColor: isDisabled ? colors.surfaceBg : colors.accentBg,
              borderWidth: 1,
              borderColor: isDisabled ? colors.surfaceBg : colors.accentColor,
            }}
          >
            {isPublishing ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.textPrimary} />
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("announcements.publishing")}
                </Text>
              </View>
            ) : (
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {t("announcements.publish")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

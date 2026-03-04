import { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme";
import { useChannelsStore } from "@/stores/channels-store";

interface AddEventFormProps {
  channelId: string;
  staffId: string;
  onClose: () => void;
}

export default function AddEventForm({
  channelId,
  staffId,
  onClose,
}: AddEventFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { createEvent } = useChannelsStore();

  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build ISO string from date + time inputs
  const getEventAt = (): string | null => {
    if (!dateStr) return null;
    try {
      const time = timeStr || "12:00";
      const d = new Date(`${dateStr}T${time}`);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  };

  const canSubmit = title.trim() && getEventAt();

  const handleSubmit = async () => {
    const eventAt = getEventAt();
    if (!title.trim() || !eventAt || isSubmitting) return;
    setIsSubmitting(true);
    await createEvent(channelId, title.trim(), eventAt, staffId);
    setIsSubmitting(false);
    onClose();
  };

  // Default date to today
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <View
      className="px-4 pb-3 pt-1"
      style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}
    >
      {/* Title input */}
      <View className="flex-row items-center mb-2">
        <TextInput
          className="flex-1 text-sm px-3 py-2 rounded-lg"
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            color: colors.textPrimary,
          }}
          placeholder={t("channels.eventTitle")}
          placeholderTextColor={colors.placeholderColor}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <Pressable onPress={onClose} className="ml-2 p-1.5 active:opacity-70">
          <X size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Date & time row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 gap-2">
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {t("channels.eventDate")}:
          </Text>
          {Platform.OS === "web" ? (
            <>
              <input
                type="date"
                value={dateStr || todayStr}
                onChange={(e: any) => setDateStr(e.target.value)}
                style={{
                  backgroundColor: "transparent",
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: 8,
                  padding: "4px 8px",
                  color: colors.textPrimary,
                  fontSize: 12,
                }}
              />
              <input
                type="time"
                value={timeStr || "12:00"}
                onChange={(e: any) => setTimeStr(e.target.value)}
                style={{
                  backgroundColor: "transparent",
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: 8,
                  padding: "4px 8px",
                  color: colors.textPrimary,
                  fontSize: 12,
                }}
              />
            </>
          ) : (
            <>
              <TextInput
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                  minWidth: 100,
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholderColor}
                value={dateStr || todayStr}
                onChangeText={setDateStr}
                keyboardType="default"
              />
              <TextInput
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                  minWidth: 60,
                }}
                placeholder="HH:MM"
                placeholderTextColor={colors.placeholderColor}
                value={timeStr || "12:00"}
                onChangeText={setTimeStr}
                keyboardType="default"
              />
            </>
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="px-4 py-1.5 rounded-lg active:opacity-70 ml-2"
          style={{
            backgroundColor: canSubmit ? colors.accentBg : colors.surfaceBg,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{
              color: canSubmit ? colors.accentColor : colors.textMuted,
            }}
          >
            {t("channels.add")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

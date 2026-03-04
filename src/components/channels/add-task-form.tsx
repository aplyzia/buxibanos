import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { X, ChevronDown } from "lucide-react-native";
import { useTheme } from "@/theme";
import { useChannelsStore } from "@/stores/channels-store";

interface AddTaskFormProps {
  channelId: string;
  staffId: string;
  staffNames: Record<string, string>;
  memberIds: string[];
  onClose: () => void;
}

export default function AddTaskForm({
  channelId,
  staffId,
  staffNames,
  memberIds,
  onClose,
}: AddTaskFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { createTask } = useChannelsStore();

  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await createTask(channelId, title.trim(), staffId, assignedTo ?? undefined);
    setIsSubmitting(false);
    onClose();
  };

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
          placeholder={t("channels.taskTitle")}
          placeholderTextColor={colors.placeholderColor}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <Pressable onPress={onClose} className="ml-2 p-1.5 active:opacity-70">
          <X size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Assign to picker */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setShowPicker(!showPicker)}
          className="flex-row items-center px-3 py-1.5 rounded-lg"
          style={{
            backgroundColor: colors.surfaceBg,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <Text className="text-xs mr-1" style={{ color: colors.textSecondary }}>
            {t("channels.assignTo")}:{" "}
          </Text>
          <Text className="text-xs font-medium" style={{ color: colors.accentColor }}>
            {assignedTo
              ? staffNames[assignedTo] || assignedTo.slice(0, 8)
              : t("channels.unassigned")}
          </Text>
          <ChevronDown size={12} color={colors.textMuted} className="ml-1" />
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={!title.trim() || isSubmitting}
          className="px-4 py-1.5 rounded-lg active:opacity-70"
          style={{
            backgroundColor: title.trim() ? colors.accentBg : colors.surfaceBg,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{
              color: title.trim() ? colors.accentColor : colors.textMuted,
            }}
          >
            {t("channels.add")}
          </Text>
        </Pressable>
      </View>

      {/* Member picker dropdown */}
      {showPicker && (
        <ScrollView
          className="mt-2 rounded-lg max-h-32"
          style={{
            backgroundColor: colors.surfaceBg,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <Pressable
            onPress={() => {
              setAssignedTo(null);
              setShowPicker(false);
            }}
            className="px-3 py-2"
          >
            <Text
              className="text-sm"
              style={{
                color: !assignedTo ? colors.accentColor : colors.textSecondary,
              }}
            >
              {t("channels.unassigned")}
            </Text>
          </Pressable>
          {memberIds.map((mid) => (
            <Pressable
              key={mid}
              onPress={() => {
                setAssignedTo(mid);
                setShowPicker(false);
              }}
              className="px-3 py-2"
              style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}
            >
              <Text
                className="text-sm"
                style={{
                  color:
                    assignedTo === mid ? colors.accentColor : colors.textPrimary,
                }}
              >
                {staffNames[mid] || mid.slice(0, 8)}
                {mid === staffId ? ` (${t("channels.you")})` : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

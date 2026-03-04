import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Sparkles, FileText, X } from "lucide-react-native";
import { useTheme } from "@/theme";

interface SttVersionPickerProps {
  rawText: string;
  polishedText: string | null; // null = still loading
  onSelect: (text: string) => void;
  onCancel: () => void;
}

export default function SttVersionPicker({
  rawText,
  polishedText,
  onSelect,
  onCancel,
}: SttVersionPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      className="px-4 py-3 gap-2.5"
      style={[
        {
          backgroundColor: colors.overlayBg,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceBorder,
        },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any)
          : {},
      ]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
          {t("messages.sttPickVersion")}
        </Text>
        <Pressable
          onPress={onCancel}
          className="w-7 h-7 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surfaceBg }}
        >
          <X size={14} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Original option */}
      <Pressable
        onPress={() => onSelect(rawText)}
        className="rounded-xl px-3.5 py-2.5 active:opacity-80"
        style={{
          backgroundColor: colors.cardBg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <FileText size={14} color={colors.textTertiary} />
          <Text className="text-xs font-medium" style={{ color: colors.textTertiary }}>
            {t("messages.sttOriginal")}
          </Text>
        </View>
        <Text className="text-sm leading-5" style={{ color: colors.textPrimary }}>
          {rawText}
        </Text>
      </Pressable>

      {/* Polished option */}
      <Pressable
        onPress={() => polishedText && onSelect(polishedText)}
        disabled={!polishedText}
        className="rounded-xl px-3.5 py-2.5 active:opacity-80"
        style={{
          backgroundColor: colors.accentBg,
          borderWidth: 1,
          borderColor: polishedText ? colors.accentColor : colors.cardBorder,
          opacity: polishedText ? 1 : 0.7,
        }}
      >
        <View className="flex-row items-center gap-2 mb-1">
          <Sparkles size={14} color={colors.accentColor} />
          <Text className="text-xs font-medium" style={{ color: colors.accentColor }}>
            {polishedText ? t("messages.sttPolished") : t("messages.sttPolishing")}
          </Text>
        </View>
        {polishedText ? (
          <Text className="text-sm leading-5" style={{ color: colors.textPrimary }}>
            {polishedText}
          </Text>
        ) : (
          <View className="flex-row items-center gap-2 py-1">
            <ActivityIndicator size="small" color={colors.accentColor} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

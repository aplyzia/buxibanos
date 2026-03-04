import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";

interface StickerPickerProps {
  onSelect: (sticker: string) => void;
  onClose: () => void;
}

const STICKER_CATEGORIES = [
  {
    key: "emotions",
    stickers: ["😊", "😂", "🥰", "😢", "😤", "😱", "🤔", "😴"],
  },
  {
    key: "reactions",
    stickers: ["👍", "👎", "❤️", "🎉", "🙏", "💪", "👏", "🤝"],
  },
  {
    key: "school",
    stickers: ["📚", "✏️", "🎓", "📝", "🏫", "⏰", "✅", "⭐"],
  },
];

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.overlayBg,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceBorder,
        },
        Platform.OS === "web"
          ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any
          : {},
      ]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}>
        <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
          {t("messages.stickers")}
        </Text>
        <Pressable
          onPress={onClose}
          className="w-8 h-8 items-center justify-center rounded-full active:opacity-70"
        >
          <Text className="text-lg" style={{ color: colors.textMuted }}>✕</Text>
        </Pressable>
      </View>

      {/* Sticker grid */}
      <ScrollView className="max-h-[200px]" showsVerticalScrollIndicator={false}>
        {STICKER_CATEGORIES.map((category) => (
          <View key={category.key} className="px-3 py-2">
            <View className="flex-row flex-wrap">
              {category.stickers.map((sticker) => (
                <Pressable
                  key={sticker}
                  onPress={() => onSelect(sticker)}
                  className="w-[12.5%] aspect-square items-center justify-center rounded-lg"
                  style={{ }}
                >
                  <Text className="text-3xl">{sticker}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

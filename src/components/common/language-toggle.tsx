import { Pressable, Text, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const isChinese = i18n.language === "zh-TW";

  const toggle = () => {
    i18n.changeLanguage(isChinese ? "en" : "zh-TW");
  };

  const label = isChinese ? "English" : "\u4E2D\u6587";

  const webProps =
    Platform.OS === "web"
      ? { dataSet: { notranslate: "" }, lang: isChinese ? "en" : "zh-TW" }
      : {};

  return (
    <Pressable
      onPress={toggle}
      className="px-3 py-1.5 rounded-full active:opacity-70"
      style={{
        backgroundColor: colors.surfaceBg,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
      {...webProps}
    >
      <Text className="text-xs font-medium notranslate" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

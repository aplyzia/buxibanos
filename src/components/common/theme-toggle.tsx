import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme";

export function ThemeToggle() {
  const { mode, toggle, colors } = useTheme();

  return (
    <Pressable
      onPress={toggle}
      className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
      style={{
        backgroundColor: colors.surfaceBg,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
    >
      <Text className="text-base">{mode === "dark" ? "☀️" : "🌙"}</Text>
    </Pressable>
  );
}

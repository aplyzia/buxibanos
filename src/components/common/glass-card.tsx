import { View, Platform, ViewStyle } from "react-native";
import { useTheme } from "@/theme";

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  tint?: "light" | "dark";
  style?: ViewStyle;
}

export default function GlassCard({ children, className = "", tint = "light", style }: GlassCardProps) {
  const { colors } = useTheme();

  const bgColor = tint === "light" ? colors.cardBg : colors.cardDarkBg;
  const borderColor = tint === "light" ? colors.cardBorder : colors.cardDarkBorder;

  return (
    <View
      className={`rounded-2xl overflow-hidden ${className}`}
      style={[
        {
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor: borderColor,
        },
        Platform.OS === "web"
          ? {
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            } as any
          : {},
        style,
      ]}
    >
      {children}
    </View>
  );
}

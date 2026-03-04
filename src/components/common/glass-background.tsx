import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme";

type Variant = "staff" | "parent" | "auth";

interface GlassBackgroundProps {
  variant: Variant;
  children: React.ReactNode;
}

export default function GlassBackground({ variant, children }: GlassBackgroundProps) {
  const { colors } = useTheme();

  const gradientMap: Record<Variant, string[]> = {
    staff: colors.staffGradient,
    parent: colors.parentGradient,
    auth: colors.authGradient,
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={gradientMap[variant] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}

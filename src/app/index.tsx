import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/theme";

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <LinearGradient
          colors={colors.staffGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ActivityIndicator size="large" color={colors.loaderColor} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (role === "parent") {
    return <Redirect href="/(parent)/(tabs)/messages" />;
  }

  if (role === "teacher") {
    return <Redirect href="/(teacher)/(tabs)/chats" />;
  }

  return <Redirect href="/(staff)/(tabs)/dashboard" />;
}

import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import CreateChannelForm from "@/components/channels/create-channel-form";
import { useTheme } from "@/theme";

export default function StaffCreateChannelScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);

  const staffId = profile && "id" in profile ? profile.id : "";

  if (!organizationId || !staffId) return null;

  return (
    <View className="flex-1">
      <View
        className="absolute top-14 left-4 z-10"
        style={{ pointerEvents: "box-none" }}
      >
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/channels" as any)}
          className="w-11 h-11 items-center justify-center rounded-full active:opacity-70"
          style={{
            backgroundColor: colors.surfaceBg,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <CreateChannelForm
        organizationId={organizationId}
        currentStaffId={staffId}
        onCreated={(channelId) => {
          router.replace({
            pathname: "/(staff)/channels/[id]",
            params: { id: channelId },
          });
        }}
      />
    </View>
  );
}

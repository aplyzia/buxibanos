import { useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import CreateChannelForm from "@/components/channels/create-channel-form";
import { useTheme } from "@/theme";

export default function TeacherCreateChannelScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);

  const staffId = profile && "id" in profile ? profile.id : "";

  if (!organizationId || !staffId) return null;

  return (
    <View className="flex-1">
      {/* Back button overlay */}
      <View
        className="absolute top-14 left-4 z-10"
        style={{ pointerEvents: "box-none" }}
      >
        <Pressable
          onPress={() => router.back()}
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
            pathname: "/(teacher)/channels/[id]",
            params: { id: channelId },
          });
        }}
      />
    </View>
  );
}

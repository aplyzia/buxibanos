/**
 * Teacher Settings Screen
 *
 * Profile info (read-only), notification preferences, theme, language, sign-out.
 */

import { useState } from "react";
import { View, Text, Pressable, Alert, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  User,
  Bell,
  Palette,
  Globe,
  LogOut,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/common/language-toggle";
import { ThemeToggle } from "@/components/common/theme-toggle";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

type NotifPref = "all" | "urgent_only" | "urgent_and_digest" | "digest_only";

const NOTIF_OPTIONS: NotifPref[] = [
  "all",
  "urgent_only",
  "urgent_and_digest",
  "digest_only",
];

export default function TeacherSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  const staffName = profile && "full_name" in profile ? profile.full_name : "";
  const staffId = profile && "id" in profile ? profile.id : "";
  const currentPref =
    profile && "notification_pref" in profile
      ? (profile.notification_pref as NotifPref)
      : "all";

  const [notifPref, setNotifPref] = useState<NotifPref>(currentPref);
  const [isSaving, setIsSaving] = useState(false);

  const handleNotifChange = async (pref: NotifPref) => {
    if (pref === notifPref || !staffId) return;
    setNotifPref(pref);
    setIsSaving(true);

    await supabase
      .from("staff")
      .update({ notification_pref: pref })
      .eq("id", staffId);

    setIsSaving(false);
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      signOut();
      return;
    }
    Alert.alert(t("settings.signOutConfirmTitle"), t("settings.signOutConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.signOut"),
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(teacher)/(tabs)/chats" as any)
          }
          className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          className="text-lg font-bold"
          style={{ color: colors.textPrimary }}
        >
          {t("settings.title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 80 }}>
        {/* ── Profile ── */}
        <SectionLabel
          icon={<User size={15} color={colors.accentColor} />}
          label={t("settings.profile")}
          colors={colors}
        />
        <GlassCard className="p-4 mb-5">
          <InfoRow
            label={t("settings.name")}
            value={staffName}
            colors={colors}
          />
          <InfoRow
            label={t("settings.role")}
            value={t("settings.roleTeacher")}
            colors={colors}
          />
          <InfoRow
            label={t("settings.email")}
            value={session?.user?.email ?? "-"}
            colors={colors}
          />
        </GlassCard>

        {/* ── Notifications ── */}
        <SectionLabel
          icon={<Bell size={15} color={colors.accentColor} />}
          label={t("settings.notifications")}
          colors={colors}
        />
        <GlassCard className="p-4 mb-5">
          <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
            {t("settings.notifHint")}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {NOTIF_OPTIONS.map((opt) => {
              const active = notifPref === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => handleNotifChange(opt)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg"
                  style={
                    active
                      ? {
                          backgroundColor: colors.accentBg,
                          borderWidth: 1,
                          borderColor: colors.accentColor,
                        }
                      : {
                          backgroundColor: colors.overlayBg,
                          borderWidth: 1,
                          borderColor: colors.surfaceBorder,
                        }
                  }
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: active
                        ? colors.textPrimary
                        : colors.textSecondary,
                    }}
                  >
                    {t(`settings.notif_${opt}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* ── Appearance ── */}
        <SectionLabel
          icon={<Palette size={15} color={colors.accentColor} />}
          label={t("settings.appearance")}
          colors={colors}
        />
        <GlassCard className="p-4 mb-2">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm"
              style={{ color: colors.textPrimary }}
            >
              {t("settings.theme")}
            </Text>
            <ThemeToggle />
          </View>
        </GlassCard>
        <GlassCard className="p-4 mb-5">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm"
              style={{ color: colors.textPrimary }}
            >
              {t("settings.language")}
            </Text>
            <LanguageToggle />
          </View>
        </GlassCard>

        {/* ── Sign Out ── */}
        <Pressable
          onPress={handleSignOut}
          className="mt-4 py-3 rounded-xl items-center active:opacity-70"
          style={{
            backgroundColor: "rgba(239,68,68,0.12)",
            borderWidth: 1,
            borderColor: "rgba(239,68,68,0.3)",
          }}
        >
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <LogOut size={16} color="#ef4444" />
            <Text className="text-sm font-semibold" style={{ color: "#ef4444" }}>
              {t("auth.signOut")}
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </GlassBackground>
  );
}

function SectionLabel({
  icon,
  label,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  colors: { textPrimary: string };
}) {
  return (
    <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
      {icon}
      <Text
        className="text-sm font-semibold"
        style={{ color: colors.textPrimary }}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { textMuted: string; textPrimary: string };
}) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-xs" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}

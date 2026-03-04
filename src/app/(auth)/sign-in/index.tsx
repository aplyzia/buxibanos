import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/stores/auth-store";
import { SCHOOL_NAME } from "@/constants";
import { LanguageToggle } from "@/components/common/language-toggle";
import { ThemeToggle } from "@/components/common/theme-toggle";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import { LineButton } from "@/components/auth/line-button";
import { useLineAuth } from "@/hooks/use-line-auth";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; hint?: string }>();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const { signInWithLine, isLoading: lineLoading, error: lineError, clearError: clearLineError } = useLineAuth();

  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (params.email) setEmail(params.email);
  }, [params.email]);

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) return;
    signIn(email.trim(), password);
  };

  const isDisabled = isLoading || !email.trim() || !password.trim();

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Gradient background */}
      <LinearGradient
        colors={colors.authGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Controls */}
      <View className="absolute top-14 right-6 z-10 flex-row items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </View>

      <View className="flex-1 justify-center px-6">
        {/* School branding */}
        <View className="items-center mb-10">
          <Text className="text-5xl mb-4">🏫</Text>
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            {SCHOOL_NAME}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.textTertiary }}>BuxibanOS</Text>
        </View>

        {/* Glass card form */}
        <GlassCard className="p-6">
          {/* Email field */}
          <View className="mb-4">
            <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              {t("auth.email")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              }}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isLoading}
            />
          </View>

          {/* Password field */}
          <View className="mb-6">
            <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
              {t("auth.password")}
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3.5 text-base"
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              }}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.placeholderColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              editable={!isLoading}
              onSubmitEditing={handleSignIn}
            />
          </View>

          {/* Already-registered hint */}
          {params.hint === "already_registered" && (
            <View
              className="rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBg }}
            >
              <Text className="text-sm text-center" style={{ color: colors.successText }}>
                {t("auth.alreadyRegisteredHint")}
              </Text>
            </View>
          )}

          {/* Error message */}
          {error && (
            <View
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                backgroundColor: colors.errorBg,
                borderWidth: 1,
                borderColor: colors.errorBorder,
              }}
            >
              <Text className="text-sm text-center" style={{ color: colors.errorText }}>{error}</Text>
            </View>
          )}

          {/* Sign-in button */}
          <Pressable
            onPress={handleSignIn}
            disabled={isDisabled}
            style={{ overflow: "hidden", borderRadius: 12 }}
          >
            {isDisabled ? (
              <View className="py-4 items-center" style={{ backgroundColor: colors.signInDisabledBg }}>
                {isLoading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                    <Text className="text-base font-semibold" style={{ color: colors.textTertiary }}>
                      {t("auth.signingIn")}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-base font-semibold" style={{ color: colors.textMuted }}>
                    {t("auth.signIn")}
                  </Text>
                )}
              </View>
            ) : (
              <LinearGradient
                colors={colors.signInGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-4 items-center"
              >
                <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {t("auth.signIn")}
                </Text>
              </LinearGradient>
            )}
          </Pressable>

          {/* Invite code link */}
          <Pressable
            onPress={() => router.push("/(auth)/invite" as any)}
            className="mt-4 items-center active:opacity-60"
          >
            <Text className="text-sm" style={{ color: colors.accentColor }}>
              {t("auth.haveInviteCode")}
            </Text>
          </Pressable>

          {/* Divider */}
          <View className="flex-row items-center my-4 gap-3">
            <View className="flex-1 h-px" style={{ backgroundColor: colors.surfaceBorder }} />
            <Text className="text-xs" style={{ color: colors.textMuted }}>{t("auth.lineOrDivider")}</Text>
            <View className="flex-1 h-px" style={{ backgroundColor: colors.surfaceBorder }} />
          </View>

          {/* LINE sign-in error */}
          {lineError && (
            <View className="rounded-xl px-4 py-3 mb-3"
              style={{ backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder }}>
              <Text className="text-sm text-center" style={{ color: colors.errorText }}>{lineError}</Text>
            </View>
          )}

          {/* LINE sign-in button */}
          <LineButton
            onPress={() => { clearLineError(); signInWithLine(); }}
            loading={lineLoading}
            label={t("auth.signInWithLine")}
          />
        </GlassCard>
      </View>
    </KeyboardAvoidingView>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, CheckCircle } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";
import { SCHOOL_NAME } from "@/constants";
import { LanguageToggle } from "@/components/common/language-toggle";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import { LineButton } from "@/components/auth/line-button";
import { useLineAuth } from "@/hooks/use-line-auth";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

type Step = "code" | "password" | "done";

interface ParentInfo {
  parent_name: string;
  email: string;
  student_names: string[];
  already_registered: boolean;
}

export default function InviteScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const { signInWithLine, isLoading: lineLoading, error: lineError, clearError: clearLineError } = useLineAuth();

  const [step, setStep] = useState<Step>("code");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    if (!inviteCode.trim()) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("redeem-invite", {
      body: { invite_code: inviteCode.trim(), action: "lookup" },
    });

    setIsLoading(false);

    if (fnError || data?.error) {
      setError(data?.error ?? t("auth.inviteInvalid"));
      return;
    }

    if (data.already_registered) {
      // Already registered — send to sign-in with email pre-filled
      router.replace({ pathname: "/(auth)/sign-in", params: { email: data.email, hint: "already_registered" } } as any);
      return;
    }

    setParentInfo(data);
    setStep("password");
  }

  async function handleRegister() {
    if (!password || password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("redeem-invite", {
      body: { invite_code: inviteCode.trim(), password, action: "register" },
    });

    setIsLoading(false);

    if (fnError || data?.error) {
      setError(data?.error ?? t("common.error"));
      return;
    }

    // Set session in Supabase client — this triggers onAuthStateChange in auth-store
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    setStep("done");
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={colors.authGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View className="absolute top-14 right-6 z-10">
        <LanguageToggle />
      </View>

      <Pressable
        onPress={() => (step === "password" ? setStep("code") : router.back())}
        className="absolute top-14 left-5 z-10 p-1 active:opacity-70"
      >
        <ChevronLeft size={24} color={colors.textPrimary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View className="items-center mb-8">
          <Text className="text-4xl mb-3">🏫</Text>
          <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>{SCHOOL_NAME}</Text>
          <Text className="text-sm mt-1" style={{ color: colors.textTertiary }}>
            {t("auth.inviteTitle")}
          </Text>
        </View>

        <GlassCard className="p-6">
          {/* ── Step: Enter code ── */}
          {step === "code" && (
            <>
              <Text className="text-base font-semibold mb-1" style={{ color: colors.textPrimary }}>
                {t("auth.inviteCodeLabel")}
              </Text>
              <Text className="text-sm mb-4" style={{ color: colors.textMuted }}>
                {t("auth.inviteCodeHint")}
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3.5 text-base text-center tracking-widest mb-4"
                style={{
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: error ? colors.errorBorder : colors.inputBorder,
                  color: colors.textPrimary,
                  letterSpacing: 4,
                  fontSize: 20,
                  fontWeight: "700",
                }}
                placeholder="ABC-12345"
                placeholderTextColor={colors.placeholderColor}
                value={inviteCode}
                onChangeText={(v) => { setInviteCode(v.toUpperCase()); setError(null); }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
                onSubmitEditing={handleLookup}
              />
              {error && (
                <View className="rounded-xl px-4 py-3 mb-4"
                  style={{ backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder }}>
                  <Text className="text-sm text-center" style={{ color: colors.errorText }}>{error}</Text>
                </View>
              )}
              <Pressable
                onPress={handleLookup}
                disabled={!inviteCode.trim() || isLoading}
                style={{ overflow: "hidden", borderRadius: 12, opacity: !inviteCode.trim() || isLoading ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={colors.signInGradient as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  className="py-4 items-center"
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{t("auth.inviteContinue")}</Text>
                  }
                </LinearGradient>
              </Pressable>
            </>
          )}

          {/* ── Step: Set password ── */}
          {step === "password" && parentInfo && (
            <>
              <View className="items-center mb-4 p-3 rounded-xl" style={{ backgroundColor: colors.successBg }}>
                <Text className="text-sm font-semibold" style={{ color: colors.successText }}>
                  {t("auth.welcomeParent", { name: parentInfo.parent_name })}
                </Text>
                {parentInfo.student_names.length > 0 && (
                  <Text className="text-xs mt-1" style={{ color: colors.successText }}>
                    {parentInfo.student_names.join(", ")}
                  </Text>
                )}
              </View>

              <Text className="text-sm mb-4" style={{ color: colors.textMuted }}>
                {t("auth.setPasswordHint")}
              </Text>

              <View className="mb-3">
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
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!isLoading}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                  {t("auth.confirmPassword")}
                </Text>
                <TextInput
                  className="rounded-xl px-4 py-3.5 text-base"
                  style={{
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: error ? colors.errorBorder : colors.inputBorder,
                    color: colors.textPrimary,
                  }}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  placeholderTextColor={colors.placeholderColor}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
                  secureTextEntry
                  editable={!isLoading}
                  onSubmitEditing={handleRegister}
                />
              </View>

              {error && (
                <View className="rounded-xl px-4 py-3 mb-4"
                  style={{ backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder }}>
                  <Text className="text-sm text-center" style={{ color: colors.errorText }}>{error}</Text>
                </View>
              )}

              <Pressable
                onPress={handleRegister}
                disabled={!password || !confirmPassword || isLoading}
                style={{ overflow: "hidden", borderRadius: 12, opacity: !password || !confirmPassword || isLoading ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={colors.signInGradient as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  className="py-4 items-center"
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{t("auth.createAccount")}</Text>
                  }
                </LinearGradient>
              </Pressable>

              {/* ── LINE alternative ── */}
              <View className="flex-row items-center my-4 gap-3">
                <View className="flex-1 h-px" style={{ backgroundColor: colors.surfaceBorder }} />
                <Text className="text-xs" style={{ color: colors.textMuted }}>{t("auth.lineOrDivider")}</Text>
                <View className="flex-1 h-px" style={{ backgroundColor: colors.surfaceBorder }} />
              </View>

              {lineError && (
                <View className="rounded-xl px-4 py-3 mb-3"
                  style={{ backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder }}>
                  <Text className="text-sm text-center" style={{ color: colors.errorText }}>{lineError}</Text>
                </View>
              )}

              <LineButton
                onPress={() => { clearLineError(); signInWithLine(inviteCode); }}
                loading={lineLoading}
                disabled={isLoading}
                label={t("auth.continueWithLine")}
              />
            </>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <View className="items-center py-4">
              <CheckCircle size={48} color={colors.successText} style={{ marginBottom: 16 }} />
              <Text className="text-lg font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
                {t("auth.accountReady")}
              </Text>
              <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
                {t("auth.accountReadyHint")}
              </Text>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

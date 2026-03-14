/**
 * Emergency Call Screen (WF6)
 *
 * Shown when staff joins a LiveKit emergency room, either by tapping
 * the "Join Emergency Call" button in the message thread or by tapping
 * an incoming emergency push notification.
 *
 * Audio / video requires a native EAS build with @livekit/react-native.
 * The UI is fully functional; only the actual WebRTC track is stubbed.
 */

import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { PhoneOff, AlertTriangle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme";

type CallStatus = "connecting" | "connected" | "ended";

const EMERGENCY_RED = "#ef4444";
const EMERGENCY_RED_DIM = "rgba(239,68,68,0.18)";
const EMERGENCY_RED_BORDER = "rgba(239,68,68,0.35)";

export default function EmergencyCallScreen() {
  const { roomName, token, callerName, studentName } =
    useLocalSearchParams<{
      roomName: string;
      token: string;
      callerName: string;
      studentName: string;
    }>();

  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [status, setStatus] = useState<CallStatus>("connecting");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate WebRTC connecting (real audio needs @livekit/react-native + EAS build)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setStatus("connected");
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (status === "ended" && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleHangUp = () => {
    setStatus("ended");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 1500);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const statusText =
    status === "connecting"
      ? t("emergency.connecting")
      : status === "connected"
      ? formatDuration(duration)
      : t("emergency.ended");

  const statusColor =
    status === "connecting"
      ? colors.textSecondary
      : status === "connected"
      ? "#22c55e"
      : colors.errorText;

  return (
    <LinearGradient
      colors={colors.staffGradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* Emergency top banner */}
      <View
        className="pt-14 pb-3 px-4 items-center"
        style={{
          backgroundColor: EMERGENCY_RED_DIM,
          borderBottomWidth: 1,
          borderBottomColor: EMERGENCY_RED_BORDER,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <AlertTriangle size={18} color={EMERGENCY_RED} />
          <Text className="text-base font-bold" style={{ color: EMERGENCY_RED }}>
            {t("emergency.callTitle")}
          </Text>
        </View>
      </View>

      {/* Main call info */}
      <View className="flex-1 items-center justify-center px-8">
        {/* Pulsing avatar */}
        <View
          className="w-32 h-32 rounded-full items-center justify-center mb-6"
          style={{
            backgroundColor: EMERGENCY_RED_DIM,
            borderWidth: 3,
            borderColor: EMERGENCY_RED_BORDER,
          }}
        >
          <Text style={{ fontSize: 58 }}>🚨</Text>
        </View>

        {/* Caller name */}
        <Text
          className="text-2xl font-bold mb-1 text-center"
          style={{ color: colors.textPrimary }}
        >
          {callerName ?? t("emergency.unknownCaller")}
        </Text>

        {/* Student */}
        {studentName ? (
          <Text
            className="text-base mb-5 text-center"
            style={{ color: colors.textSecondary }}
          >
            {t("emergency.studentLabel")}: {studentName}
          </Text>
        ) : (
          <View className="mb-5" />
        )}

        {/* Call status / timer */}
        {status === "connecting" ? (
          <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={{ color: statusColor }}>{statusText}</Text>
          </View>
        ) : (
          <Text
            className="text-xl font-mono mb-1"
            style={{ color: statusColor }}
          >
            {statusText}
          </Text>
        )}

        {/* Room name */}
        <Text
          className="text-xs mt-2"
          style={{ color: colors.textTertiary }}
          numberOfLines={1}
        >
          {roomName}
        </Text>
      </View>

      {/* Hang-up button */}
      <View className="pb-16 items-center">
        {status !== "ended" && (
          <Pressable
            onPress={handleHangUp}
            className="w-20 h-20 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: EMERGENCY_RED }}
          >
            <PhoneOff size={32} color="#fff" />
          </Pressable>
        )}
        <Text
          className="text-xs mt-4 text-center"
          style={{ color: colors.textTertiary }}
        >
          {t("emergency.voipNotice")}
        </Text>
      </View>
    </LinearGradient>
  );
}

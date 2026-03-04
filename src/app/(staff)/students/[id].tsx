import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Student, Message, Attendance, FeeRecord } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const [student, setStudent] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);

    const [studentRes, messagesRes, attendanceRes, feesRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).single(),
      supabase
        .from("messages")
        .select("*")
        .eq("primary_student", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("attendance")
        .select("*")
        .eq("student_id", id)
        .order("date", { ascending: false })
        .limit(30),
      supabase
        .from("fee_records")
        .select("*")
        .eq("student_id", id)
        .order("due_date", { ascending: false }),
    ]);

    if (studentRes.error || !studentRes.data) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    setStudent(studentRes.data as Student);
    setMessages((messagesRes.data ?? []) as Message[]);
    setAttendance((attendanceRes.data ?? []) as Attendance[]);
    setFees((feesRes.data ?? []) as FeeRecord[]);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <GlassBackground variant="staff">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      </GlassBackground>
    );
  }

  if (error || !student) {
    return (
      <GlassBackground variant="staff">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>{error ?? t("common.error")}</Text>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mt-4 px-6 py-2 rounded-lg active:opacity-80"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="font-medium" style={{ color: colors.textPrimary }}>{t("common.back")}</Text>
          </Pressable>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)} className="mr-3 p-1 rounded-full active:opacity-70">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>{t("students.profile")}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Student info card */}
        <GlassCard className="mx-4 mt-4 p-4">
          <Text className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>{student.full_name}</Text>
          <InfoRow label={t("students.grade")} value={student.grade_level} colors={colors} />
          <InfoRow label={t("students.status")} value={student.enrollment_status} colors={colors} />
          <InfoRow label={t("students.enrollmentDate")} value={student.enrollment_date} colors={colors} />
          {student.notes && <InfoRow label={t("students.notes")} value={student.notes} colors={colors} />}
        </GlassCard>

        {/* Recent messages */}
        <SectionHeader title={t("students.recentMessages")} count={messages.length} colors={colors} />
        {messages.length === 0 ? (
          <EmptySection text={t("messages.noMessages")} colors={colors} />
        ) : (
          messages.map((msg) => {
            const priorityBg =
              msg.priority === "high"
                ? colors.highBg
                : msg.priority === "medium"
                ? colors.mediumBg
                : colors.surfaceBg;

            return (
              <GlassCard key={msg.id} className="mx-4 mb-2 p-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    {new Date(msg.created_at).toLocaleDateString(i18n.language === "zh-TW" ? "zh-TW" : "en-US")}
                  </Text>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: priorityBg }}
                  >
                    <Text className="text-xs" style={{ color: colors.textSecondary }}>{t(`priority.${msg.priority}`)}</Text>
                  </View>
                </View>
                <Text className="text-sm" numberOfLines={2} style={{ color: colors.textSecondary }}>
                  {msg.summary ?? msg.original_content}
                </Text>
              </GlassCard>
            );
          })
        )}

        {/* Attendance */}
        <SectionHeader title={t("students.attendanceRecord")} count={attendance.length} colors={colors} />
        {attendance.length === 0 ? (
          <EmptySection text={t("common.noData")} colors={colors} />
        ) : (
          <GlassCard className="mx-4 p-3">
            {attendance.slice(0, 10).map((a) => (
              <View
                key={a.id}
                className="flex-row items-center justify-between py-2"
                style={{ borderBottomWidth: 1, borderBottomColor: colors.surfaceBg }}
              >
                <Text className="text-sm" style={{ color: colors.textSecondary }}>{a.date}</Text>
                <AttendanceBadge status={a.status} colors={colors} />
              </View>
            ))}
          </GlassCard>
        )}

        {/* Fee records */}
        <SectionHeader title={t("students.feeRecords")} count={fees.length} colors={colors} />
        {fees.length === 0 ? (
          <EmptySection text={t("fees.noRecords")} colors={colors} />
        ) : (
          fees.map((fee) => (
            <GlassCard key={fee.id} className="mx-4 mb-2 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>{fee.period}</Text>
                <FeeBadge status={fee.status} colors={colors} />
              </View>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs" style={{ color: colors.textMuted }}>NT$ {fee.amount_ntd.toLocaleString()}</Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>{t("fees.dueDate")}: {fee.due_date}</Text>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </GlassBackground>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View className="flex-row items-center py-1">
      <Text className="text-sm w-20" style={{ color: colors.textMuted }}>{label}</Text>
      <Text className="text-sm flex-1" style={{ color: colors.textSecondary }}>{value}</Text>
    </View>
  );
}

function SectionHeader({ title, count, colors }: { title: string; count: number; colors: ThemeColors }) {
  return (
    <View className="flex-row items-center justify-between px-4 mt-5 mb-2">
      <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.textTertiary }}>{title}</Text>
      <Text className="text-xs" style={{ color: colors.textMuted }}>{count}</Text>
    </View>
  );
}

function EmptySection({ text, colors }: { text: string; colors: ThemeColors }) {
  return (
    <GlassCard className="mx-4 p-4 items-center">
      <Text className="text-sm" style={{ color: colors.textMuted }}>{text}</Text>
    </GlassCard>
  );
}

function AttendanceBadge({ status, colors }: { status: string; colors: ThemeColors }) {
  const { t } = useTranslation();
  const styles: Record<string, { bg: string; text: string }> = {
    present: { bg: colors.greenTintBg, text: colors.successText },
    absent: { bg: colors.errorBg, text: colors.errorText },
    tardy: { bg: colors.yellowTintBg, text: colors.mediumText },
    excused: { bg: colors.blueTintBg, text: colors.accentColor },
  };
  const s = styles[status] ?? { bg: colors.surfaceBg, text: colors.textSecondary };
  return (
    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg }}>
      <Text className="text-xs font-medium" style={{ color: s.text }}>{t(`attendance.${status}`)}</Text>
    </View>
  );
}

function FeeBadge({ status, colors }: { status: string; colors: ThemeColors }) {
  const { t } = useTranslation();
  const styles: Record<string, { bg: string; text: string }> = {
    overdue: { bg: colors.errorBg, text: colors.errorText },
    pending: { bg: colors.yellowTintBg, text: colors.mediumText },
    paid: { bg: colors.greenTintBg, text: colors.successText },
    waived: { bg: colors.surfaceBg, text: colors.textSecondary },
  };
  const s = styles[status] ?? { bg: colors.surfaceBg, text: colors.textSecondary };
  return (
    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg }}>
      <Text className="text-xs font-medium" style={{ color: s.text }}>{t(`fees.${status}`)}</Text>
    </View>
  );
}

/**
 * Student Detail Screen — admin/director only
 *
 * Sections: Profile, Parent(s), Attendance (30 days), Fees, Recent Messages
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  User,
  Users,
  CalendarCheck,
  DollarSign,
  MessageSquare,
  AlertTriangle,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useTierGate } from "@/hooks/use-tier-gate";
import { supabase } from "@/lib/supabase";
import { Student, Attendance, FeeRecord, Message, Parent, Staff } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const { allowed: hasPatternFlags } = useTierGate("standard");

  const [student, setStudent] = useState<Student | null>(null);
  const [teacher, setTeacher] = useState<Staff | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateLocale = i18n.language === "zh-TW" ? "zh-TW" : "en-US";
  const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const fetchAll = useCallback(async () => {
    if (!id || !organizationId) return;
    setIsLoading(true);
    setError(null);

    // Step 1: fetch student (need full_name for message query)
    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single();

    if (studentErr || !studentRow) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    const s = studentRow as Student;
    setStudent(s);

    // Step 2: parallel fetch all related data
    const [teacherRes, parentsRes, attendanceRes, feesRes, messagesRes] =
      await Promise.all([
        s.assigned_teacher_id
          ? supabase
              .from("staff")
              .select("*")
              .eq("id", s.assigned_teacher_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("parents")
          .select("*")
          .eq("organization_id", organizationId)
          .contains("student_ids", [id]),
        supabase
          .from("attendance")
          .select("*")
          .eq("student_id", id)
          .gte("date", since30Days)
          .order("date", { ascending: false }),
        supabase
          .from("fee_records")
          .select("*")
          .eq("student_id", id)
          .order("due_date", { ascending: false }),
        // primary_student is the student's NAME, not UUID
        supabase
          .from("messages")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("primary_student", s.full_name)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    setTeacher((teacherRes.data as Staff) ?? null);
    setParents((parentsRes.data ?? []) as Parent[]);
    setAttendance((attendanceRes.data ?? []) as Attendance[]);
    setFees((feesRes.data ?? []) as FeeRecord[]);
    setMessages((messagesRes.data ?? []) as Message[]);
    setIsLoading(false);
  }, [id, organizationId, since30Days]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
          <Text className="text-base text-center" style={{ color: colors.errorText }}>
            {error ?? t("common.error")}
          </Text>
          <Pressable
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(staff)/students" as any)
            }
            className="mt-4 px-6 py-2 rounded-lg"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="font-medium" style={{ color: colors.textPrimary }}>
              {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </GlassBackground>
    );
  }

  // Attendance stats
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const tardyCount = attendance.filter((a) => a.status === "tardy").length;
  const attendanceRate =
    attendance.length > 0
      ? Math.round((presentCount / attendance.length) * 100)
      : 0;

  // Fee stats
  const overdueFees = fees.filter((f) => f.status === "overdue");
  const pendingFees = fees.filter((f) => f.status === "pending");
  const paidFees = fees.filter((f) => f.status === "paid");
  const overdueTotal = overdueFees.reduce((s, f) => s + f.amount_ntd, 0);
  const pendingTotal = pendingFees.reduce((s, f) => s + f.amount_ntd, 0);

  const enrollmentStatusKey =
    student.enrollment_status === "active"
      ? "statusActive"
      : student.enrollment_status === "paused"
      ? "statusPaused"
      : "statusWithdrawn";

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(staff)/students" as any)
          }
          className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-lg font-bold"
            numberOfLines={1}
            style={{ color: colors.textPrimary }}
          >
            {student.full_name}
          </Text>
          {student.display_name &&
            student.display_name !== student.full_name && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {student.display_name}
              </Text>
            )}
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{
            backgroundColor:
              student.enrollment_status === "active"
                ? colors.lowBg
                : student.enrollment_status === "paused"
                ? colors.mediumBg
                : colors.highBg,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {t(`students.${enrollmentStatusKey}`)}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      >
        {/* ── Profile ── */}
        <SectionHeader
          icon={<User size={16} color={colors.accentColor} />}
          title={t("students.profile")}
          colors={colors}
        />
        <GlassCard className="p-4 mb-4">
          <InfoRow
            label={t("students.grade")}
            value={student.grade_level}
            colors={colors}
          />
          <InfoRow
            label={t("students.teacher")}
            value={teacher?.full_name ?? "-"}
            colors={colors}
          />
          <InfoRow
            label={t("students.enrollmentDate")}
            value={new Date(student.enrollment_date).toLocaleDateString(
              dateLocale
            )}
            colors={colors}
          />
          {student.notes ? (
            <InfoRow
              label={t("students.notes")}
              value={student.notes}
              colors={colors}
            />
          ) : null}
        </GlassCard>

        {/* ── Parents ── */}
        <SectionHeader
          icon={<Users size={16} color={colors.accentColor} />}
          title={t("students.parent")}
          colors={colors}
        />
        {parents.length > 0 ? (
          parents.map((p) => (
            <GlassCard key={p.id} className="p-4 mb-2">
              <Text
                className="text-base font-medium mb-1"
                style={{ color: colors.textPrimary }}
              >
                {p.full_name}
              </Text>
              {p.phone ? (
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("students.phone")}: {p.phone}
                </Text>
              ) : null}
              {p.email ? (
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("students.email")}: {p.email}
                </Text>
              ) : null}
            </GlassCard>
          ))
        ) : (
          <GlassCard className="p-4 mb-2">
            <Text
              className="text-sm text-center"
              style={{ color: colors.textMuted }}
            >
              {t("students.noParent")}
            </Text>
          </GlassCard>
        )}
        <View className="mb-2" />

        {/* ── Attendance (30 days) ── */}
        <SectionHeader
          icon={<CalendarCheck size={16} color={colors.accentColor} />}
          title={t("students.attendanceRecord")}
          subtitle={t("students.last30days")}
          colors={colors}
        />

        {/* Pattern flag: 3+ absences warning (Standard+) */}
        {hasPatternFlags && absentCount >= 3 && (
          <GlassCard className="p-3 mb-2" style={{ borderLeftWidth: 4, borderLeftColor: colors.highDot }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <AlertTriangle size={14} color={colors.errorText} />
              <Text className="text-xs font-semibold" style={{ color: colors.errorText }}>
                {t("students.attendanceAlert", { count: absentCount })}
              </Text>
            </View>
            <Text className="text-xs mt-1 ml-5" style={{ color: colors.textSecondary }}>
              {t("students.attendanceAlertHint")}
            </Text>
          </GlassCard>
        )}

        {attendance.length > 0 ? (
          <GlassCard className="p-4 mb-4">
            <View className="flex-row justify-between mb-3">
              <StatChip
                label={t("attendance.present")}
                value={presentCount}
                dotColor={colors.lowDot}
                colors={colors}
              />
              <StatChip
                label={t("attendance.absent")}
                value={absentCount}
                dotColor={colors.highDot}
                colors={colors}
              />
              <StatChip
                label={t("attendance.tardy")}
                value={tardyCount}
                dotColor={colors.mediumDot}
                colors={colors}
              />
            </View>
            <Text
              className="text-xs mb-1"
              style={{ color: colors.textSecondary }}
            >
              {t("students.attendanceRate")}: {attendanceRate}%
            </Text>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.surfaceBorder,
              }}
            >
              <View
                style={{
                  width: `${attendanceRate}%`,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accentColor,
                }}
              />
            </View>
          </GlassCard>
        ) : (
          <GlassCard className="p-4 mb-4">
            <Text
              className="text-sm text-center"
              style={{ color: colors.textMuted }}
            >
              {t("students.noAttendance")}
            </Text>
          </GlassCard>
        )}

        {/* ── Fees ── */}
        <SectionHeader
          icon={<DollarSign size={16} color={colors.accentColor} />}
          title={t("students.feeRecords")}
          colors={colors}
        />
        {fees.length > 0 ? (
          <>
            <GlassCard className="p-4 mb-2">
              <View className="flex-row justify-between mb-2">
                <StatChip
                  label={t("fees.overdue")}
                  value={overdueFees.length}
                  dotColor={colors.highDot}
                  colors={colors}
                />
                <StatChip
                  label={t("fees.pending")}
                  value={pendingFees.length}
                  dotColor={colors.mediumDot}
                  colors={colors}
                />
                <StatChip
                  label={t("fees.paid")}
                  value={paidFees.length}
                  dotColor={colors.lowDot}
                  colors={colors}
                />
              </View>
              {(overdueTotal > 0 || pendingTotal > 0) && (
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  {overdueTotal > 0
                    ? `${t("fees.overdue")}: NT$ ${overdueTotal.toLocaleString()}`
                    : ""}
                  {overdueTotal > 0 && pendingTotal > 0 ? "  ·  " : ""}
                  {pendingTotal > 0
                    ? `${t("fees.pending")}: NT$ ${pendingTotal.toLocaleString()}`
                    : ""}
                </Text>
              )}
            </GlassCard>
            {/* Individual fee records */}
            {fees.slice(0, 5).map((fee) => (
              <GlassCard key={fee.id} className="p-3 mb-2">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.textPrimary }}
                  >
                    {fee.period}
                  </Text>
                  <FeeBadge status={fee.status} colors={colors} />
                </View>
                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    NT$ {fee.amount_ntd.toLocaleString()}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    {t("fees.dueDate")}:{" "}
                    {new Date(fee.due_date).toLocaleDateString(dateLocale, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </>
        ) : (
          <GlassCard className="p-4 mb-4">
            <Text
              className="text-sm text-center"
              style={{ color: colors.textMuted }}
            >
              {t("students.noFees")}
            </Text>
          </GlassCard>
        )}
        <View className="mb-2" />

        {/* ── Recent Messages ── */}
        <SectionHeader
          icon={<MessageSquare size={16} color={colors.accentColor} />}
          title={t("students.recentMessages")}
          colors={colors}
        />
        {messages.length > 0 ? (
          messages.map((msg) => (
            <Pressable
              key={msg.id}
              onPress={() =>
                router.push({
                  pathname: "/(staff)/messages/[id]",
                  params: { id: msg.id },
                })
              }
              className="mb-2 active:opacity-80"
            >
              <GlassCard className="p-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    className="text-sm font-medium flex-1 mr-2"
                    numberOfLines={1}
                    style={{ color: colors.textPrimary }}
                  >
                    {msg.sender_name}
                  </Text>
                  <PriorityDot priority={msg.priority} colors={colors} />
                </View>
                <Text
                  className="text-xs"
                  numberOfLines={2}
                  style={{ color: colors.textSecondary }}
                >
                  {msg.summary ?? msg.original_content}
                </Text>
                <Text
                  className="text-[10px] mt-1"
                  style={{ color: colors.textMuted }}
                >
                  {new Date(msg.created_at).toLocaleDateString(dateLocale, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(msg.created_at).toLocaleTimeString(dateLocale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </GlassCard>
            </Pressable>
          ))
        ) : (
          <GlassCard className="p-4">
            <Text
              className="text-sm text-center"
              style={{ color: colors.textMuted }}
            >
              {t("students.noRecentMessages")}
            </Text>
          </GlassCard>
        )}
      </ScrollView>
    </GlassBackground>
  );
}

// ── Helper components ──

function SectionHeader({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  colors: ThemeColors;
}) {
  return (
    <View className="flex-row items-center mb-2 mt-1" style={{ gap: 6 }}>
      {icon}
      <Text
        className="text-sm font-semibold"
        style={{ color: colors.textPrimary }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          · {subtitle}
        </Text>
      )}
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
  colors: ThemeColors;
}) {
  return (
    <View className="flex-row items-start justify-between py-1.5">
      <Text className="text-xs w-28" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <Text
        className="text-sm flex-1 text-right"
        style={{ color: colors.textPrimary }}
      >
        {value}
      </Text>
    </View>
  );
}

function StatChip({
  label,
  value,
  dotColor,
  colors,
}: {
  label: string;
  value: number;
  dotColor: string;
  colors: ThemeColors;
}) {
  return (
    <View className="items-center">
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <View
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <Text
          className="text-lg font-bold"
          style={{ color: colors.textPrimary }}
        >
          {value}
        </Text>
      </View>
      <Text className="text-[10px]" style={{ color: colors.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

function PriorityDot({
  priority,
  colors,
}: {
  priority: "high" | "medium" | "low";
  colors: ThemeColors;
}) {
  const bg =
    priority === "high"
      ? colors.highDot
      : priority === "medium"
      ? colors.mediumDot
      : colors.lowDot;
  return (
    <View
      className="w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: bg }}
    />
  );
}

function FeeBadge({
  status,
  colors,
}: {
  status: string;
  colors: ThemeColors;
}) {
  const { t } = useTranslation();
  const styles: Record<string, { bg: string; text: string }> = {
    overdue: { bg: colors.errorBg, text: colors.errorText },
    pending: { bg: colors.yellowTintBg, text: colors.mediumText },
    paid: { bg: colors.greenTintBg, text: colors.successText },
    waived: { bg: colors.surfaceBg, text: colors.textSecondary },
  };
  const s = styles[status] ?? {
    bg: colors.surfaceBg,
    text: colors.textSecondary,
  };
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg }}
    >
      <Text className="text-xs font-medium" style={{ color: s.text }}>
        {t(`fees.${status}`)}
      </Text>
    </View>
  );
}

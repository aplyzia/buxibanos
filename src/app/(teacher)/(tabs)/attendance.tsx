/**
 * Teacher Attendance Tab
 *
 * Marks attendance for students assigned to this teacher (assigned_teacher_id = profile.id).
 * Same logic as staff attendance but scoped to the teacher's class.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Check, Bot } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { Student, Attendance } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme";

type AttendanceStatus = "present" | "absent" | "tardy";
type RecordSource = "manual" | "auto_message";

interface StudentAttendance {
  student: Student;
  status: AttendanceStatus;
  source: RecordSource;
  sourceMessageId: string | null;
  persisted: boolean;
  dirty: boolean;
}

export default function TeacherAttendanceScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);

  const staffId = profile && "id" in profile ? profile.id : "";

  const [rows, setRows] = useState<StudentAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchStudents = useCallback(async () => {
    if (!organizationId || !staffId) return;
    setIsLoading(true);
    setError(null);

    const [studentsRes, attendanceRes] = await Promise.all([
      supabase
        .from("students")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("enrollment_status", "active")
        .eq("assigned_teacher_id", staffId)
        .order("full_name", { ascending: true }),
      supabase
        .from("attendance")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("date", today),
    ]);

    if (studentsRes.error) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    const students = (studentsRes.data ?? []) as Student[];
    const existing = (attendanceRes.data ?? []) as Attendance[];

    const attendanceMap = new Map<string, Attendance>();
    for (const rec of existing) {
      attendanceMap.set(rec.student_id, rec);
    }

    setRows(
      students.map((s) => {
        const rec = attendanceMap.get(s.id);
        if (rec) {
          return {
            student: s,
            status: rec.status as AttendanceStatus,
            source: (rec.source ?? "manual") as RecordSource,
            sourceMessageId: rec.source_message_id ?? null,
            persisted: true,
            dirty: false,
          };
        }
        return {
          student: s,
          status: "present" as AttendanceStatus,
          source: "manual" as RecordSource,
          sourceMessageId: null,
          persisted: false,
          dirty: false,
        };
      })
    );
    setIsLoading(false);
  }, [organizationId, staffId, today]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Realtime: auto-detected attendance for any of this teacher's students
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel("teacher-attendance-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const newRec = payload.new as Attendance;
          if (newRec.date !== today) return;
          if (newRec.source !== "auto_message") return;

          setRows((prev) =>
            prev.map((row) => {
              if (row.student.id !== newRec.student_id) return row;
              if (row.dirty) return row;
              return {
                ...row,
                status: newRec.status as AttendanceStatus,
                source: "auto_message",
                sourceMessageId: newRec.source_message_id ?? null,
                persisted: true,
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, today]);

  const toggleStatus = (studentId: string, newStatus: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.student.id !== studentId) return row;
        const effectiveStatus = row.status === newStatus ? "present" : newStatus;
        return {
          ...row,
          status: effectiveStatus,
          source: "manual",
          dirty: true,
        };
      })
    );
  };

  const saveAll = async () => {
    if (!organizationId || !staffId) return;
    setIsSaving(true);
    setError(null);

    const records = rows.map((row) => ({
      organization_id: organizationId,
      student_id: row.student.id,
      class_id: "00000000-0000-0000-0000-000000000000",
      date: today,
      status: row.status,
      recorded_by: staffId,
      parent_notified: false,
      source:
        row.source === "auto_message" && !row.dirty ? "auto_message" : "manual",
      source_message_id: row.sourceMessageId,
    }));

    const { error: upsertError } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "student_id,class_id,date" });

    if (upsertError) {
      setError(t("attendance.saveError"));
    } else {
      setRows((prev) =>
        prev.map((r) => ({ ...r, persisted: true, dirty: false }))
      );
    }
    setIsSaving(false);
  };

  const presentCount = rows.filter((r) => r.status === "present").length;
  const absentCount = rows.filter((r) => r.status === "absent").length;
  const tardyCount = rows.filter((r) => r.status === "tardy").length;

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <View className="flex-1">
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("attendance.title")}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>{today}</Text>
        </View>
        <Pressable
          onPress={saveAll}
          disabled={isSaving || rows.length === 0}
          className={`px-4 py-2 rounded-lg ${
            isSaving || rows.length === 0 ? "opacity-40" : "active:opacity-80"
          }`}
          style={{
            backgroundColor: isSaving ? colors.surfaceBg : colors.accentBg,
            borderWidth: 1,
            borderColor: isSaving ? colors.surfaceBg : colors.accentColor,
          }}
        >
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {isSaving ? t("common.loading") : t("attendance.saveAll")}
          </Text>
        </Pressable>
      </View>

      {/* Summary bar */}
      <View
        className="px-4 py-2 flex-row items-center gap-4"
        style={{
          backgroundColor: colors.overlayBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceBg,
        }}
      >
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.lowDot }} />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {presentCount} {t("attendance.present")}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.highDot }} />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {absentCount} {t("attendance.absent")}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.mediumDot }} />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {tardyCount} {t("attendance.tardy")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>
            {error}
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
            {t("attendance.noStudentsAssigned")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.student.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <AttendanceRow
              row={item}
              onToggle={(status) => toggleStatus(item.student.id, status)}
              colors={colors}
            />
          )}
        />
      )}
    </GlassBackground>
  );
}

function AttendanceRow({
  row,
  onToggle,
  colors,
}: {
  row: StudentAttendance;
  onToggle: (status: AttendanceStatus) => void;
  colors: ThemeColors;
}) {
  const { t } = useTranslation();
  const isAutoMarked = row.source === "auto_message" && !row.dirty;
  const isPresent = row.status === "present";

  const borderColorStyle = isPresent
    ? colors.lowDot
    : row.status === "absent"
    ? colors.highDot
    : colors.mediumDot;

  return (
    <View className="mx-4 mb-2 overflow-hidden rounded-2xl">
      {isAutoMarked && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.purpleTintBg,
            borderRadius: 16,
            zIndex: 0,
          }}
        />
      )}
      <GlassCard
        className="p-3 flex-row items-center"
        style={{ borderLeftWidth: 4, borderLeftColor: borderColorStyle }}
      >
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base font-medium" style={{ color: colors.textPrimary }}>
              {row.student.full_name}
            </Text>
            {isAutoMarked && (
              <View
                className="px-1.5 py-0.5 rounded flex-row items-center gap-0.5"
                style={{ backgroundColor: colors.purpleTintBg }}
              >
                <Bot size={10} color={colors.insightsIcon} />
                <Text className="text-[10px] font-medium" style={{ color: colors.insightsLabel }}>
                  {t("attendance.autoDetected")}
                </Text>
              </View>
            )}
            {row.persisted && !row.dirty && isPresent && (
              <Check size={14} color={colors.successText} />
            )}
          </View>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {row.student.grade_level}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onToggle("absent")}
            className="px-3.5 py-2 rounded-lg"
            style={
              row.status === "absent"
                ? { backgroundColor: colors.highDot }
                : {
                    backgroundColor: colors.overlayBg,
                    borderWidth: 1,
                    borderColor: colors.highBg,
                  }
            }
          >
            <Text
              className="text-xs font-semibold"
              style={{
                color: row.status === "absent" ? colors.textPrimary : colors.errorText,
              }}
            >
              {t("attendance.absent")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onToggle("tardy")}
            className="px-3.5 py-2 rounded-lg"
            style={
              row.status === "tardy"
                ? { backgroundColor: colors.mediumDot }
                : {
                    backgroundColor: colors.overlayBg,
                    borderWidth: 1,
                    borderColor: colors.mediumBg,
                  }
            }
          >
            <Text
              className="text-xs font-semibold"
              style={{
                color: row.status === "tardy" ? colors.textPrimary : colors.mediumText,
              }}
            >
              {t("attendance.tardy")}
            </Text>
          </Pressable>
        </View>
      </GlassCard>
    </View>
  );
}

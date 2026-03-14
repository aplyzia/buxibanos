import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Search, AlertTriangle } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useTierGate } from "@/hooks/use-tier-gate";
import { supabase } from "@/lib/supabase";
import { Student, Attendance } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

export default function StudentListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const organizationId = useAuthStore((s) => s.organizationId);

  const { allowed: hasPatternFlags } = useTierGate("standard");

  const [students, setStudents] = useState<Student[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [absenceCounts, setAbsenceCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const fetchStudents = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    const queries: Promise<any>[] = [
      supabase
        .from("students")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("enrollment_status", "active")
        .order("full_name", { ascending: true }),
      supabase
        .from("staff")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
    ];

    // Fetch absence counts for pattern flags (Standard+)
    if (hasPatternFlags) {
      queries.push(
        supabase
          .from("attendance")
          .select("student_id, status")
          .eq("organization_id", organizationId)
          .eq("status", "absent")
          .gte("date", since30Days)
      );
    }

    const results = await Promise.all(queries);
    const studentsRes = results[0];
    const staffRes = results[1];
    const absenceRes = results[2];

    if (studentsRes.error) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    // Build teacher name map
    const nameMap: Record<string, string> = {};
    for (const s of staffRes.data ?? []) {
      nameMap[s.id] = s.full_name;
    }
    setTeacherNames(nameMap);

    // Build absence count map
    if (absenceRes?.data) {
      const counts: Record<string, number> = {};
      for (const a of absenceRes.data as Attendance[]) {
        counts[a.student_id] = (counts[a.student_id] ?? 0) + 1;
      }
      setAbsenceCounts(counts);
    }

    setStudents((studentsRes.data ?? []) as Student[]);
    setIsLoading(false);
  }, [organizationId, hasPatternFlags, since30Days]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = searchQuery.trim()
    ? students.filter((s) =>
        s.full_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : students;

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-5">
        <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
          {t("students.title")}
        </Text>
      </View>

      {/* Search bar */}
      <View className="px-4 py-3">
        <View
          className="flex-row items-center rounded-xl px-3"
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <Search size={18} color={colors.iconDefault} />
          <TextInput
            className="flex-1 px-3 py-3 text-base"
            style={{ color: colors.textPrimary }}
            placeholder={t("students.searchPlaceholder")}
            placeholderTextColor={colors.placeholderColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
          <Text className="text-sm mt-2" style={{ color: colors.textMuted }}>{t("common.loading")}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>{error}</Text>
          <Pressable
            onPress={fetchStudents}
            className="mt-4 px-6 py-2 rounded-lg active:opacity-80"
            style={{ backgroundColor: colors.accentBg }}
          >
            <Text className="font-medium" style={{ color: colors.textPrimary }}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/(staff)/students/[id]", params: { id: item.id } })
              }
              className="mx-4 mb-2 active:opacity-80"
            >
              <GlassCard className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Text className="text-base font-medium" style={{ color: colors.textPrimary }}>
                      {item.full_name}
                    </Text>
                    {hasPatternFlags && (absenceCounts[item.id] ?? 0) >= 3 && (
                      <View
                        className="flex-row items-center px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: colors.highBg, gap: 2 }}
                      >
                        <AlertTriangle size={10} color={colors.errorText} />
                        <Text className="text-[10px] font-semibold" style={{ color: colors.errorText }}>
                          {absenceCounts[item.id]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-3 mt-1">
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {t("students.grade")}: {item.grade_level}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {t("students.teacher")}: {teacherNames[item.assigned_teacher_id] ?? "-"}
                    </Text>
                  </View>
                </View>
                <Text className="text-lg" style={{ color: colors.textMuted }}>&rsaquo;</Text>
              </GlassCard>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("students.noStudents")}</Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

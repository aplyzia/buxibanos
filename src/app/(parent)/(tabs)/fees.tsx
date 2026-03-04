import { useEffect, useState, useCallback } from "react";
import { View, Text, SectionList, Pressable, ActivityIndicator, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/common/language-toggle";
import { FeeRecord, Parent } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import { FileText } from "lucide-react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

interface FeeWithStudent extends FeeRecord {
  student_name?: string;
}

interface FeeSection {
  title: string;
  data: FeeWithStudent[];
}

export default function ParentFeesScreen() {
  const { t } = useTranslation();
  const organizationId = useAuthStore((s) => s.organizationId);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();

  const [sections, setSections] = useState<FeeSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!organizationId || !profile) return;
    setIsLoading(true);
    setError(null);

    const studentIds = (profile as Parent).student_ids ?? [];
    if (studentIds.length === 0) {
      setSections([]);
      setIsLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("fee_records")
      .select("*, students(full_name)")
      .in("student_id", studentIds)
      .order("due_date", { ascending: true });

    if (fetchError) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    const records = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as FeeRecord),
      student_name: (r.students as { full_name: string } | null)?.full_name ?? "",
    })) as FeeWithStudent[];

    const byStudent = new Map<string, FeeWithStudent[]>();
    for (const r of records) {
      const name = r.student_name || r.student_id;
      if (!byStudent.has(name)) byStudent.set(name, []);
      byStudent.get(name)!.push(r);
    }

    const result: FeeSection[] = [];
    for (const [name, fees] of byStudent) {
      result.push({ title: name, data: fees });
    }

    setSections(result);
    setIsLoading(false);
  }, [organizationId, profile]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  async function openInvoice(feeId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const invoiceUrl = `${SUPABASE_URL}/functions/v1/generate-invoice?token=${session.access_token}&fee_record_id=${feeId}`;
    await Linking.openURL(invoiceUrl);
  }

  const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    overdue: { bg: colors.highBg, text: colors.highText },
    pending: { bg: colors.mediumBg, text: colors.mediumText },
    paid: { bg: colors.lowBg, text: colors.lowText },
    waived: { bg: colors.badgeBg, text: colors.badgeText },
  };

  return (
    <GlassBackground variant="parent">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t("fees.title")}</Text>
          <View className="flex-row items-center gap-2">
            <LanguageToggle />
            <Pressable
              onPress={signOut}
              className="px-3 py-1.5 rounded-full active:opacity-70"
              style={{ backgroundColor: colors.surfaceBorder, borderWidth: 1, borderColor: colors.surfaceBorder }}
            >
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {t("auth.signOut")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base text-center" style={{ color: colors.errorText }}>{error}</Text>
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base" style={{ color: colors.textMuted }}>{t("fees.noRecords")}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderSectionHeader={({ section }) => (
            <View className="px-4 pt-5 pb-2">
              <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.waived;
            const isOverdue = item.status === "overdue";
            return (
              <View className="mx-4 mb-2">
                <GlassCard className="p-3" tint={isOverdue ? "dark" : "light"}>
                  {isOverdue && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: colors.errorBg,
                        borderRadius: 16,
                      }}
                    />
                  )}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>{item.period}</Text>
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                      <Text className="text-xs font-medium" style={{ color: statusStyle.text }}>
                        {t(`fees.${item.status}`)}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between mt-1">
                    <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                      NT$ {item.amount_ntd.toLocaleString()}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {t("fees.dueDate")}: {item.due_date}
                    </Text>
                  </View>

                  {item.status === "paid" && (
                    <Pressable
                      onPress={() => openInvoice(item.id)}
                      className="flex-row items-center gap-1 mt-2 pt-2 active:opacity-60"
                      style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}
                    >
                      <FileText size={13} color={colors.accentColor} />
                      <Text className="text-xs font-medium" style={{ color: colors.accentColor }}>
                        {t("fees.downloadInvoice")}
                      </Text>
                    </Pressable>
                  )}
                </GlassCard>
              </View>
            );
          }}
        />
      )}
    </GlassBackground>
  );
}

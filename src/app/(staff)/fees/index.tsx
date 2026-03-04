import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, CheckCircle, RotateCcw, Banknote, Building2, X } from "lucide-react-native";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { FeeRecord } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

interface FeeWithStudent extends FeeRecord {
  student_name?: string;
}

interface FeeSection {
  title: string;
  titleColor: string;
  data: FeeWithStudent[];
}

export default function FeesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);

  const [sections, setSections] = useState<FeeSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<FeeWithStudent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchFees = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("fee_records")
      .select("*, students(full_name)")
      .eq("organization_id", organizationId)
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

    buildSections(records);
    setIsLoading(false);
  }, [organizationId, colors]);

  function buildSections(records: FeeWithStudent[]) {
    const overdue = records.filter((r) => r.status === "overdue");
    const pending = records.filter((r) => r.status === "pending");
    const paid = records.filter((r) => r.status === "paid");

    const sectionColorMap: Record<string, string> = {
      overdue: colors.errorText,
      pending: colors.mediumText,
      paid: colors.successText,
    };

    const result: FeeSection[] = [];
    if (overdue.length > 0)
      result.push({ title: t("fees.overdue"), titleColor: sectionColorMap.overdue, data: overdue });
    if (pending.length > 0)
      result.push({ title: t("fees.pending"), titleColor: sectionColorMap.pending, data: pending });
    if (paid.length > 0)
      result.push({ title: t("fees.paid"), titleColor: sectionColorMap.paid, data: paid });

    setSections(result);
  }

  async function markAsPaid(record: FeeWithStudent, method: "cash" | "bank_transfer") {
    setIsSaving(true);
    const { error } = await supabase
      .from("fee_records")
      .update({
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0],
        payment_method: method,
      })
      .eq("id", record.id);

    setIsSaving(false);
    setPendingRecord(null);

    if (error) {
      Alert.alert(t("common.error"), t("fees.markError"));
      return;
    }

    // Update local state
    setSections((prev) =>
      prev
        .map((section) => ({
          ...section,
          data: section.data.map((r) =>
            r.id === record.id
              ? { ...r, status: "paid" as const, paid_date: new Date().toISOString().split("T")[0], payment_method: method }
              : r
          ),
        }))
        .map((section) => ({
          ...section,
          data: section.data.filter((r) =>
            section.title === t("fees.paid") ? true : r.id !== record.id
          ),
        }))
        .filter((s) => s.data.length > 0)
    );
    // Refresh to get correct sections
    fetchFees();
  }

  async function markAsUnpaid(record: FeeWithStudent) {
    const { error } = await supabase
      .from("fee_records")
      .update({ status: "pending", paid_date: null, payment_method: null })
      .eq("id", record.id);

    if (error) {
      Alert.alert(t("common.error"), t("fees.markError"));
      return;
    }
    fetchFees();
  }

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center">
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
          className="mr-3 p-1 rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
          {t("fees.title")}
        </Text>
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
            <View className="px-4 pt-4 pb-2">
              <Text className="text-sm font-semibold" style={{ color: section.titleColor }}>
                {section.title} ({section.data.length})
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <GlassCard
              className="mx-4 mb-2 p-3"
              style={
                item.status === "overdue"
                  ? { borderLeftWidth: 2, borderLeftColor: colors.errorText }
                  : undefined
              }
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium flex-1 mr-2" style={{ color: colors.textPrimary }}>
                  {item.student_name}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  NT$ {item.amount_ntd.toLocaleString()}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-xs" style={{ color: colors.textMuted }}>{item.period}</Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {t("fees.dueDate")}: {item.due_date}
                </Text>
              </View>

              {/* Action row */}
              {item.status === "paid" ? (
                <View className="flex-row items-center justify-between mt-2 pt-2"
                  style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}>
                  <View className="flex-row items-center gap-1">
                    <CheckCircle size={13} color={colors.successText} />
                    <Text className="text-xs" style={{ color: colors.successText }}>
                      {item.payment_method === "cash" ? t("fees.cash") : t("fees.bankTransfer")}
                      {item.paid_date ? `  ·  ${item.paid_date}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => markAsUnpaid(item)}
                    className="flex-row items-center gap-1 px-2 py-1 rounded active:opacity-60"
                    style={{ backgroundColor: colors.surfaceBg }}
                  >
                    <RotateCcw size={12} color={colors.textMuted} />
                    <Text className="text-xs" style={{ color: colors.textMuted }}>{t("fees.undo")}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setPendingRecord(item)}
                  className="mt-2 pt-2 flex-row items-center justify-center rounded-lg py-2 active:opacity-70"
                  style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder, backgroundColor: colors.successBg }}
                >
                  <CheckCircle size={14} color={colors.successText} style={{ marginRight: 6 }} />
                  <Text className="text-sm font-semibold" style={{ color: colors.successText }}>
                    {t("fees.markPaid")}
                  </Text>
                </Pressable>
              )}
            </GlassCard>
          )}
        />
      )}

      {/* Payment method modal */}
      <Modal
        visible={!!pendingRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRecord(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="rounded-t-2xl p-5" style={{ backgroundColor: colors.headerBg }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                {t("fees.confirmPayment")}
              </Text>
              <Pressable onPress={() => setPendingRecord(null)} className="p-1 active:opacity-60">
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {pendingRecord && (
              <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                {pendingRecord.student_name} — NT$ {pendingRecord.amount_ntd.toLocaleString()} · {pendingRecord.period}
              </Text>
            )}

            <Text className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: colors.textMuted }}>
              {t("fees.paymentMethod")}
            </Text>

            <View className="flex-row gap-3 mb-2">
              <Pressable
                onPress={() => pendingRecord && markAsPaid(pendingRecord, "cash")}
                disabled={isSaving}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-4 active:opacity-70"
                style={{ backgroundColor: colors.accentBg, opacity: isSaving ? 0.5 : 1 }}
              >
                <Banknote size={18} color={colors.accentColor} />
                <Text className="text-sm font-semibold" style={{ color: colors.accentColor }}>
                  {t("fees.cash")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => pendingRecord && markAsPaid(pendingRecord, "bank_transfer")}
                disabled={isSaving}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-4 active:opacity-70"
                style={{ backgroundColor: colors.accentBg, opacity: isSaving ? 0.5 : 1 }}
              >
                <Building2 size={18} color={colors.accentColor} />
                <Text className="text-sm font-semibold" style={{ color: colors.accentColor }}>
                  {t("fees.bankTransfer")}
                </Text>
              </Pressable>
            </View>

            {isSaving && (
              <View className="items-center mt-2">
                <ActivityIndicator size="small" color={colors.loaderColor} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </GlassBackground>
  );
}

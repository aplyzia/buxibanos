import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Lock } from "lucide-react-native";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";
import { useAuthStore } from "@/stores/auth-store";
import { useTierGate } from "@/hooks/use-tier-gate";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface MessageStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  responded: number;
  avgResponseMin: number | null;
}

interface AttendanceStats {
  present: number;
  absent: number;
  tardy: number;
  excused: number;
  total: number;
}

interface FeeStats {
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

interface BroadcastStat {
  id: string;
  title: string;
  total: number;
  viewed: number;
  responded: number;
}

interface AnalyticsData {
  messages: MessageStats;
  attendance: AttendanceStats;
  fees: FeeStats;
  broadcasts: BroadcastStat[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function since7Days(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function since7DaysDate(): string {
  return since7Days().slice(0, 10);
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.surfaceBorder,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.min(value, 100)}%`,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text
      className="text-xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: colors.textMuted }}
    >
      {label}
    </Text>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const organizationId = useAuthStore((s) => s.organizationId);
  const { allowed: isPremium } = useTierGate("premium");

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!organizationId || !isPremium) {
      setIsLoading(false);
      return;
    }
    loadAnalytics(organizationId);
  }, [organizationId, isPremium]);

  async function loadAnalytics(orgId: string) {
    setIsLoading(true);
    try {
      const [messagesRes, attendanceRes, feesRes, broadcastsRes] = await Promise.all([
        supabase
          .from("messages")
          .select("priority, staff_responded, processed_at, response_at")
          .eq("organization_id", orgId)
          .gte("processed_at", since7Days()),

        supabase
          .from("attendance")
          .select("status")
          .eq("organization_id", orgId)
          .gte("date", since7DaysDate()),

        supabase
          .from("fee_records")
          .select("status, amount_ntd")
          .eq("organization_id", orgId),

        supabase
          .from("announcements")
          .select("id, title, created_at, announcement_recipients(status)")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      // ── Messages ──
      const msgs = messagesRes.data ?? [];
      const highMsgs = msgs.filter((m) => m.priority === "high");
      const respondedMsgs = msgs.filter((m) => m.staff_responded);
      const responseTimes = respondedMsgs
        .filter((m) => m.response_at && m.processed_at)
        .map((m) => (new Date(m.response_at!).getTime() - new Date(m.processed_at).getTime()) / 60000);
      const avgMin =
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

      const messages: MessageStats = {
        total: msgs.length,
        high: highMsgs.length,
        medium: msgs.filter((m) => m.priority === "medium").length,
        low: msgs.filter((m) => m.priority === "low").length,
        responded: respondedMsgs.length,
        avgResponseMin: avgMin,
      };

      // ── Attendance ──
      const att = attendanceRes.data ?? [];
      const attendance: AttendanceStats = {
        present: att.filter((a) => a.status === "present").length,
        absent: att.filter((a) => a.status === "absent").length,
        tardy: att.filter((a) => a.status === "tardy").length,
        excused: att.filter((a) => a.status === "excused").length,
        total: att.length,
      };

      // ── Fees ──
      const feeRows = feesRes.data ?? [];
      const sumAmount = (status: string) =>
        feeRows
          .filter((f) => f.status === status)
          .reduce((acc, f) => acc + (f.amount_ntd ?? 0), 0);
      const fees: FeeStats = {
        paidCount: feeRows.filter((f) => f.status === "paid").length,
        pendingCount: feeRows.filter((f) => f.status === "pending").length,
        overdueCount: feeRows.filter((f) => f.status === "overdue").length,
        paidAmount: sumAmount("paid"),
        pendingAmount: sumAmount("pending"),
        overdueAmount: sumAmount("overdue"),
      };

      // ── Broadcasts ──
      const bRows = (broadcastsRes.data ?? []) as any[];
      const broadcasts: BroadcastStat[] = bRows.map((b) => {
        const recipients: { status: string }[] = b.announcement_recipients ?? [];
        const total = recipients.length;
        const viewed = recipients.filter(
          (r) => r.status === "viewed" || r.status === "responded" || r.status === "dismissed"
        ).length;
        const responded = recipients.filter((r) => r.status === "responded").length;
        return { id: b.id, title: b.title, total, viewed, responded };
      });

      setData({ messages, attendance, fees, broadcasts });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Tier gate ──
  if (!isPremium) {
    return (
      <GlassBackground variant="staff">
        <View className="pt-14 pb-3 px-4 flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("analytics.title")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
          <Text className="text-base text-center" style={{ color: colors.textMuted }}>
            {t("analytics.tierGated")}
          </Text>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/dashboard" as any)}
            className="mr-3 p-1 rounded-full active:opacity-70"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>
            {t("analytics.title")}
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: colors.accentBg }}
        >
          <Text className="text-xs font-medium" style={{ color: colors.accentColor }}>
            {t("analytics.last7days")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
          <Text className="mt-4 text-sm" style={{ color: colors.textMuted }}>
            {t("analytics.loading")}
          </Text>
        </View>
      ) : !data ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-sm text-center" style={{ color: colors.textMuted }}>
            {t("analytics.noData")}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* ── Messages ── */}
          <View className="mt-2 mb-4">
            <SectionHeader label={t("analytics.messagesSection")} />
            <GlassCard className="p-4">
              {/* Stat row */}
              <View className="flex-row justify-between mb-4">
                {(
                  [
                    { label: t("analytics.total"), value: data.messages.total, color: colors.textPrimary },
                    { label: t("analytics.high"), value: data.messages.high, color: "#EF4444" },
                    { label: t("analytics.medium"), value: data.messages.medium, color: "#F59E0B" },
                    { label: t("analytics.low"), value: data.messages.low, color: "#22C55E" },
                  ] as const
                ).map(({ label, value, color }) => (
                  <View key={label} className="items-center flex-1">
                    <Text className="text-2xl font-bold" style={{ color }}>
                      {value}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Response rate */}
              <View className="mb-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {t("analytics.responseRate")}
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: colors.accentColor }}>
                    {pct(data.messages.responded, data.messages.total)}%
                  </Text>
                </View>
                <ProgressBar value={pct(data.messages.responded, data.messages.total)} color={colors.accentColor} />
              </View>

              {/* Avg response time */}
              {data.messages.avgResponseMin !== null && (
                <View className="flex-row justify-between items-center pt-3"
                  style={{ borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}
                >
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {t("analytics.avgResponseTime")}
                  </Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                    {t("analytics.minutes", { count: data.messages.avgResponseMin })}
                  </Text>
                </View>
              )}
            </GlassCard>
          </View>

          {/* ── Attendance ── */}
          <View className="mb-4">
            <SectionHeader label={t("analytics.attendanceSection")} />
            <GlassCard className="p-4">
              {/* 3-stat row */}
              <View className="flex-row justify-around mb-4">
                {(
                  [
                    { label: t("analytics.present"), value: pct(data.attendance.present, data.attendance.total), color: "#22C55E" },
                    { label: t("analytics.absent"), value: pct(data.attendance.absent, data.attendance.total), color: "#EF4444" },
                    { label: t("analytics.tardy"), value: pct(data.attendance.tardy, data.attendance.total), color: "#F59E0B" },
                  ] as const
                ).map(({ label, value, color }) => (
                  <View key={label} className="items-center">
                    <Text className="text-2xl font-bold" style={{ color }}>
                      {value}%
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Attendance rate bar */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {t("analytics.attendanceRate")}
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>
                    {pct(data.attendance.present, data.attendance.total)}%
                  </Text>
                </View>
                <ProgressBar value={pct(data.attendance.present, data.attendance.total)} color="#22C55E" />
              </View>

              {data.attendance.total === 0 && (
                <Text className="text-xs text-center mt-2" style={{ color: colors.textMuted }}>
                  {t("analytics.noData")}
                </Text>
              )}
            </GlassCard>
          </View>

          {/* ── Fees ── */}
          <View className="mb-4">
            <SectionHeader label={t("analytics.feesSection")} />
            <GlassCard className="p-4">
              {/* 3-stat row */}
              <View className="flex-row justify-around mb-4">
                {(
                  [
                    { label: t("analytics.paid"), value: data.fees.paidCount, color: "#22C55E" },
                    { label: t("analytics.pending"), value: data.fees.pendingCount, color: "#F59E0B" },
                    { label: t("analytics.overdue"), value: data.fees.overdueCount, color: "#EF4444" },
                  ] as const
                ).map(({ label, value, color }) => (
                  <View key={label} className="items-center">
                    <Text className="text-2xl font-bold" style={{ color }}>
                      {value}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Collection rate */}
              {(() => {
                const total = data.fees.paidCount + data.fees.pendingCount + data.fees.overdueCount;
                const rate = pct(data.fees.paidCount, total);
                const outstanding = data.fees.pendingAmount + data.fees.overdueAmount;
                return (
                  <>
                    <View className="mb-3">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>
                          {t("analytics.collectionRate")}
                        </Text>
                        <Text className="text-xs font-semibold" style={{ color: "#22C55E" }}>
                          {rate}%
                        </Text>
                      </View>
                      <ProgressBar value={rate} color="#22C55E" />
                    </View>
                    {outstanding > 0 && (
                      <Text className="text-xs text-center pt-2"
                        style={{ color: colors.textMuted, borderTopWidth: 1, borderTopColor: colors.surfaceBorder }}
                      >
                        {t("analytics.outstanding", { amount: outstanding.toLocaleString() })}
                      </Text>
                    )}
                  </>
                );
              })()}
            </GlassCard>
          </View>

          {/* ── Recent Broadcasts ── */}
          <View className="mb-4">
            <SectionHeader label={t("analytics.broadcastsSection")} />
            {data.broadcasts.length === 0 ? (
              <GlassCard className="p-4 items-center">
                <Text className="text-sm" style={{ color: colors.textMuted }}>
                  {t("analytics.noData")}
                </Text>
              </GlassCard>
            ) : (
              data.broadcasts.map((b) => {
                const viewRate = pct(b.viewed, b.total);
                const responseRate = pct(b.responded, b.total);
                return (
                  <GlassCard key={b.id} className="p-4 mb-2">
                    <Text
                      className="text-sm font-semibold mb-3"
                      numberOfLines={1}
                      style={{ color: colors.textPrimary }}
                    >
                      {b.title}
                    </Text>
                    <View className="flex-row gap-4">
                      <View className="flex-1">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-xs" style={{ color: colors.textSecondary }}>
                            {t("analytics.views")}
                          </Text>
                          <Text className="text-xs font-semibold" style={{ color: colors.accentColor }}>
                            {viewRate}%
                          </Text>
                        </View>
                        <ProgressBar value={viewRate} color={colors.accentColor} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-xs" style={{ color: colors.textSecondary }}>
                            {t("analytics.responses")}
                          </Text>
                          <Text className="text-xs font-semibold" style={{ color: "#A78BFA" }}>
                            {responseRate}%
                          </Text>
                        </View>
                        <ProgressBar value={responseRate} color="#A78BFA" />
                      </View>
                    </View>
                    {b.total === 0 && (
                      <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                        {t("analytics.noData")}
                      </Text>
                    )}
                  </GlassCard>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </GlassBackground>
  );
}

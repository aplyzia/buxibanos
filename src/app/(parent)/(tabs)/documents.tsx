import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { LanguageToggle } from "@/components/common/language-toggle";
import { Document } from "@/types/database";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";
import { useTheme } from "@/theme";

export default function ParentDocumentsScreen() {
  const { t } = useTranslation();
  const organizationId = useAuthStore((s) => s.organizationId);
  const signOut = useAuthStore((s) => s.signOut);
  const { colors } = useTheme();

  const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
    handout: { bg: colors.blueTintBg, text: colors.accentColor },
    policy: { bg: colors.purpleTintBg, text: colors.textSecondary },
    form: { bg: colors.greenTintBg, text: colors.successText },
    report: { bg: colors.orangeTintBg, text: colors.textSecondary },
    other: { bg: colors.surfaceBg, text: colors.textTertiary },
  };

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(t("common.error"));
      setIsLoading(false);
      return;
    }

    setDocuments((data ?? []) as Document[]);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openDocument = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <GlassBackground variant="parent">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t("documents.title")}</Text>
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
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.other;
            return (
              <Pressable
                onPress={() => openDocument(item.file_url)}
                className="mx-4 mb-3 active:opacity-80"
              >
                <GlassCard className="p-4">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: catStyle.bg }}
                    >
                      <Text className="text-xs font-medium" style={{ color: catStyle.text }}>
                        {t(`documents.category.${item.category}`)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-base font-semibold mb-1" style={{ color: colors.textPrimary }}>
                    {item.title}
                  </Text>
                  {item.summary && (
                    <Text className="text-sm" style={{ color: colors.textTertiary }} numberOfLines={2}>
                      {item.summary}
                    </Text>
                  )}
                </GlassCard>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-base" style={{ color: colors.textMuted }}>{t("documents.noDocuments")}</Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

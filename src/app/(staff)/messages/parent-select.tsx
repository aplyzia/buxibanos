import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/theme";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";

interface ParentItem {
  id: string;
  full_name: string;
  phone: string | null;
  supabase_user_id: string | null;
  student_ids: string[];
}

export default function ParentSelectScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const session = useAuthStore((s) => s.session);

  const staffName =
    profile && "full_name" in profile ? profile.full_name : "Staff";

  const [parents, setParents] = useState<ParentItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    fetchParents();
  }, []);

  const fetchParents = async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from("parents")
      .select("id, full_name, phone, supabase_user_id, student_ids")
      .eq("organization_id", organizationId)
      .order("full_name");

    setParents((data ?? []) as ParentItem[]);
    setIsLoading(false);
  };

  const filtered = search
    ? parents.filter((p) =>
        p.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : parents;

  const handleSelect = async (parent: ParentItem) => {
    if (isSelecting || !organizationId || !session) return;
    setIsSelecting(true);

    // Check for existing thread from this parent
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("sender_name", parent.full_name)
      .is("thread_id", null)
      .order("processed_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      router.replace({
        pathname: "/(staff)/messages/[id]",
        params: { id: existing[0].id },
      });
      return;
    }

    // Create new outbound message to this parent
    const { data: newMsg } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        sender_name: staffName,
        sender_type: "admin" as const,
        sender_user_id: session.user.id,
        receiver_name: parent.full_name,
        receiver_type: "parent" as const,
        primary_student: null,
        additional_students: [],
        message_type: "general" as const,
        priority: "low" as const,
        action_required: false,
        original_content: "",
        media_urls: [],
        staff_responded: true,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (newMsg) {
      router.replace({
        pathname: "/(staff)/messages/[id]",
        params: { id: newMsg.id },
      });
    } else {
      setIsSelecting(false);
    }
  };

  return (
    <GlassBackground variant="staff">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 flex-row items-center">
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(staff)/messages" as any)}
          className="mr-2 w-11 h-11 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          className="text-xl font-bold flex-1"
          style={{ color: colors.textPrimary }}
        >
          {t("inbox.selectParent")}
        </Text>
      </View>

      {/* Search */}
      <View className="px-4 mb-3">
        <TextInput
          className="rounded-xl px-4 py-3 text-base"
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            color: colors.textPrimary,
          }}
          placeholder={t("inbox.searchParent")}
          placeholderTextColor={colors.placeholderColor}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Parent list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.loaderColor} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              disabled={isSelecting}
              className="mx-4 mb-1"
            >
              <GlassCard className="px-4 py-3 flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: colors.blueTintBg }}
                >
                  <Text
                    className="text-sm font-bold"
                    style={{ color: colors.avatarText }}
                  >
                    {item.full_name.slice(0, 1)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-base font-medium"
                    style={{ color: colors.textPrimary }}
                  >
                    {item.full_name}
                  </Text>
                  {item.phone && (
                    <Text
                      className="text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      {item.phone}
                    </Text>
                  )}
                </View>
              </GlassCard>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text
                className="text-base"
                style={{ color: colors.textMuted }}
              >
                {t("inbox.noParents")}
              </Text>
            </View>
          }
        />
      )}
    </GlassBackground>
  );
}

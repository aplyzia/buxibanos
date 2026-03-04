import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useChannelsStore } from "@/stores/channels-store";
import { useTheme } from "@/theme";
import GlassBackground from "@/components/common/glass-background";
import GlassCard from "@/components/common/glass-card";

interface CreateChannelFormProps {
  organizationId: string;
  currentStaffId: string;
  onCreated: (channelId: string) => void;
}

interface StaffItem {
  id: string;
  full_name: string;
  role: string;
}

export default function CreateChannelForm({
  organizationId,
  currentStaffId,
  onCreated,
}: CreateChannelFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const createChannel = useChannelsStore((s) => s.createChannel);

  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, full_name, role")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .neq("id", currentStaffId)
      .order("full_name");

    setStaffList((data ?? []) as StaffItem[]);
    setIsLoading(false);
  };

  const filtered = search
    ? staffList.filter((s) =>
        s.full_name.toLowerCase().includes(search.toLowerCase())
      )
    : staffList;

  const toggleSelect = (id: string) => {
    if (mode === "direct") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const canCreate =
    selectedIds.length > 0 && (mode === "direct" || groupName.trim());

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);

    try {
      const channelId = await createChannel({
        organizationId,
        createdBy: currentStaffId,
        type: mode,
        name: mode === "group" ? groupName.trim() : undefined,
        memberIds: selectedIds,
      });

      setIsCreating(false);

      if (channelId) {
        onCreated(channelId);
      } else {
        const msg = t("channels.createFailed");
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert(t("common.error"), msg);
        }
      }
    } catch (e) {
      setIsCreating(false);
      const msg = t("channels.createFailed");
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert(t("common.error"), msg);
      }
    }
  };

  return (
    <GlassBackground variant="staff">
      <View className="flex-1 pt-14 px-4">
        {/* Mode toggle */}
        <View className="flex-row gap-2 mb-4">
          <Pressable
            onPress={() => {
              setMode("direct");
              setSelectedIds([]);
            }}
            className="flex-1 py-2.5 rounded-xl items-center"
            style={{
              backgroundColor:
                mode === "direct" ? colors.accentBg : colors.surfaceBg,
              borderWidth: 1,
              borderColor:
                mode === "direct" ? colors.accentColor : colors.surfaceBorder,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{
                color:
                  mode === "direct" ? colors.textPrimary : colors.textSecondary,
              }}
            >
              {t("channels.newDm")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("group");
              setSelectedIds([]);
            }}
            className="flex-1 py-2.5 rounded-xl items-center"
            style={{
              backgroundColor:
                mode === "group" ? colors.accentBg : colors.surfaceBg,
              borderWidth: 1,
              borderColor:
                mode === "group" ? colors.accentColor : colors.surfaceBorder,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{
                color:
                  mode === "group" ? colors.textPrimary : colors.textSecondary,
              }}
            >
              {t("channels.newGroup")}
            </Text>
          </Pressable>
        </View>

        {/* Group name input */}
        {mode === "group" && (
          <TextInput
            className="rounded-xl px-4 py-3 text-base mb-3"
            style={{
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              color: colors.textPrimary,
            }}
            placeholder={t("channels.groupNamePlaceholder")}
            placeholderTextColor={colors.placeholderColor}
            value={groupName}
            onChangeText={setGroupName}
          />
        )}

        {/* Search */}
        <TextInput
          className="rounded-xl px-4 py-3 text-base mb-3"
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            color: colors.textPrimary,
          }}
          placeholder={t("channels.searchStaff")}
          placeholderTextColor={colors.placeholderColor}
          value={search}
          onChangeText={setSearch}
        />

        {/* Staff list */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.loaderColor} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => toggleSelect(item.id)}
                  className="mb-1"
                >
                  <GlassCard className="px-4 py-3 flex-row items-center">
                    {/* Avatar */}
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: colors.avatarBg }}
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
                      <Text
                        className="text-xs capitalize"
                        style={{ color: colors.textMuted }}
                      >
                        {item.role.replace("_", " ")}
                      </Text>
                    </View>
                    {/* Checkbox */}
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: isSelected
                          ? colors.accentBg
                          : "transparent",
                        borderWidth: isSelected ? 0 : 2,
                        borderColor: colors.surfaceBorder,
                      }}
                    >
                      {isSelected && (
                        <Check size={14} color={colors.textPrimary} />
                      )}
                    </View>
                  </GlassCard>
                </Pressable>
              );
            }}
          />
        )}

        {/* Create button */}
        <View className="absolute bottom-8 left-4 right-4">
          <Pressable
            onPress={handleCreate}
            disabled={!canCreate || isCreating}
            className="py-3.5 rounded-xl items-center active:opacity-80"
            style={{
              backgroundColor: canCreate ? colors.accentBg : colors.surfaceBg,
            }}
          >
            <Text
              className="text-base font-semibold"
              style={{
                color: canCreate ? colors.textPrimary : colors.textMuted,
              }}
            >
              {isCreating ? t("channels.creating") : t("channels.create")}
            </Text>
          </Pressable>
        </View>
      </View>
    </GlassBackground>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { X, UserPlus, UserMinus, Crown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useChannelsStore } from "@/stores/channels-store";
import { useTheme } from "@/theme";

interface MemberManagementSheetProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  currentStaffId: string;
  memberIds: string[];
  createdBy: string;
  staffNames: Record<string, string>;
  onLeave?: () => void;
}

export default function MemberManagementSheet({
  visible,
  onClose,
  channelId,
  currentStaffId,
  memberIds,
  createdBy,
  staffNames,
  onLeave,
}: MemberManagementSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const addChannelMember = useChannelsStore((s) => s.addChannelMember);
  const removeChannelMember = useChannelsStore((s) => s.removeChannelMember);

  const [showAddPicker, setShowAddPicker] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const isCreator = currentStaffId === createdBy;

  // All known staff who are NOT already members
  const allStaff = Object.entries(staffNames);
  const nonMembers = allStaff.filter(
    ([id]) => !memberIds.includes(id)
  );
  const filteredNonMembers = addSearch.trim()
    ? nonMembers.filter(([, name]) =>
        name.toLowerCase().includes(addSearch.toLowerCase())
      )
    : nonMembers;

  const handleRemove = (staffId: string) => {
    const name = staffNames[staffId] || staffId.slice(0, 8);

    if (Platform.OS === "web") {
      if (window.confirm(t("memberManagement.removeConfirm", { name }))) {
        removeChannelMember(channelId, staffId);
      }
    } else {
      Alert.alert("", t("memberManagement.removeConfirm", { name }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("memberManagement.removeMember"),
          style: "destructive",
          onPress: () => removeChannelMember(channelId, staffId),
        },
      ]);
    }
  };

  const handleLeave = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("memberManagement.leaveConfirm"))) {
        removeChannelMember(channelId, currentStaffId);
        onClose();
        onLeave?.();
      }
    } else {
      Alert.alert("", t("memberManagement.leaveConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("memberManagement.leaveGroup"),
          style: "destructive",
          onPress: () => {
            removeChannelMember(channelId, currentStaffId);
            onClose();
            onLeave?.();
          },
        },
      ]);
    }
  };

  const handleAdd = (staffId: string) => {
    addChannelMember(channelId, staffId);
    setShowAddPicker(false);
    setAddSearch("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="rounded-t-3xl px-4 pt-4 pb-8"
          style={{
            backgroundColor: colors.cardDarkBg,
            borderTopWidth: 1,
            borderTopColor: colors.cardDarkBorder,
            maxHeight: "70%",
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text
              className="text-lg font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("memberManagement.members")} ({memberIds.length})
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowAddPicker(true)}
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: colors.accentBg }}
              >
                <UserPlus size={16} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
                style={{ backgroundColor: colors.surfaceBg }}
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Add member picker */}
          {showAddPicker && (
            <View
              className="mb-3 rounded-xl p-3"
              style={{
                backgroundColor: colors.surfaceBg,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <TextInput
                className="text-sm px-3 py-2 rounded-lg mb-2"
                placeholder={t("channels.searchStaff")}
                placeholderTextColor={colors.placeholderColor}
                value={addSearch}
                onChangeText={setAddSearch}
                style={{
                  color: colors.textPrimary,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                }}
              />
              {filteredNonMembers.length === 0 ? (
                <Text
                  className="text-sm py-2 text-center"
                  style={{ color: colors.textMuted }}
                >
                  {t("memberManagement.noOtherStaff")}
                </Text>
              ) : (
                <FlatList
                  data={filteredNonMembers}
                  keyExtractor={([id]) => id}
                  style={{ maxHeight: 150 }}
                  renderItem={({ item: [id, name] }) => (
                    <Pressable
                      onPress={() => handleAdd(id)}
                      className="py-2.5 px-2 flex-row items-center active:opacity-70"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surfaceBorder,
                      }}
                    >
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                        style={{ backgroundColor: colors.purpleTintBg }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{ color: colors.avatarText }}
                        >
                          {name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        className="text-sm flex-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {name}
                      </Text>
                      <UserPlus size={14} color={colors.accentColor} />
                    </Pressable>
                  )}
                />
              )}
              <Pressable
                onPress={() => {
                  setShowAddPicker(false);
                  setAddSearch("");
                }}
                className="mt-2 py-1.5 items-center"
              >
                <Text
                  className="text-xs"
                  style={{ color: colors.textMuted }}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Member list */}
          <FlatList
            data={memberIds}
            keyExtractor={(item) => item}
            renderItem={({ item: memberId }) => {
              const name = staffNames[memberId] || memberId.slice(0, 8);
              const isSelf = memberId === currentStaffId;
              const isMemberCreator = memberId === createdBy;

              return (
                <View
                  className="py-3 px-2 flex-row items-center"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceBorder,
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.purpleTintBg }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ color: colors.avatarText }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {name}
                      {isSelf ? ` (${t("channels.you")})` : ""}
                    </Text>
                    {isMemberCreator && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Crown size={10} color={colors.accentColor} />
                        <Text
                          className="text-[10px]"
                          style={{ color: colors.accentColor }}
                        >
                          {t("memberManagement.admin")}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Remove button — only visible to creator, not for self */}
                  {isCreator && !isSelf && (
                    <Pressable
                      onPress={() => handleRemove(memberId)}
                      className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
                      style={{ backgroundColor: "rgba(239,68,68,0.15)" }}
                    >
                      <UserMinus size={14} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          {/* Leave group button */}
          {!isCreator && (
            <Pressable
              onPress={handleLeave}
              className="mt-4 py-3 rounded-xl items-center active:opacity-70"
              style={{
                backgroundColor: "rgba(239,68,68,0.1)",
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.3)",
              }}
            >
              <Text className="text-sm font-medium" style={{ color: "#EF4444" }}>
                {t("memberManagement.leaveGroup")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

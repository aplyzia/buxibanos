import { View, Text, Pressable, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { MessageSquare, Users, X } from "lucide-react-native";
import { useTheme } from "@/theme";

interface NewConversationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectParent: () => void;
  onSelectStaff: () => void;
  showParentOption?: boolean;
}

export function NewConversationSheet({
  visible,
  onClose,
  onSelectParent,
  onSelectStaff,
  showParentOption = true,
}: NewConversationSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <Pressable
          className="rounded-t-2xl px-5 pt-5 pb-10"
          style={{ backgroundColor: colors.headerBg }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <Text
              className="text-lg font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("inbox.newConversation")}
            </Text>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surfaceBg }}
            >
              <X size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Parent option */}
          {showParentOption && (
            <Pressable
              onPress={() => {
                onClose();
                onSelectParent();
              }}
              className="flex-row items-center py-4 px-4 rounded-xl mb-3 active:opacity-80"
              style={{
                backgroundColor: colors.blueTintBg,
                borderWidth: 1,
                borderColor: colors.parentCardBorder,
              }}
            >
              <MessageSquare size={22} color={colors.textPrimary} />
              <View className="ml-3 flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("inbox.newParent")}
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  {t("inbox.newParentHint")}
                </Text>
              </View>
            </Pressable>
          )}

          {/* Staff option */}
          <Pressable
            onPress={() => {
              onClose();
              onSelectStaff();
            }}
            className="flex-row items-center py-4 px-4 rounded-xl active:opacity-80"
            style={{
              backgroundColor: colors.purpleTintBg,
              borderWidth: 1,
              borderColor: colors.staffCardBorder,
            }}
          >
            <Users size={22} color={colors.textPrimary} />
            <View className="ml-3 flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {t("inbox.newStaff")}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.textMuted }}
              >
                {t("inbox.newStaffHint")}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

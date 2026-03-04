import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";

type StatusFilter = "pending" | "completed" | "all";

interface StatusFilterBarProps {
  active: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}

const FILTERS: StatusFilter[] = ["pending", "completed", "all"];

export function StatusFilterBar({ active, onChange }: StatusFilterBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const getLabel = (filter: StatusFilter) => {
    if (filter === "all") return t("tasks.filterAll");
    return t(`tasks.${filter}`);
  };

  return (
    <View className="flex-row gap-2 px-4 py-3">
      {FILTERS.map((filter) => {
        const isActive = active === filter;
        return (
          <Pressable
            key={filter}
            onPress={() => onChange(filter)}
            className="px-4 py-2 rounded-full active:opacity-80"
            style={{
              backgroundColor: isActive ? colors.accentBg : colors.surfaceBg,
              borderWidth: 1,
              borderColor: isActive ? colors.surfaceBorder : colors.surfaceBg,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: isActive ? colors.textPrimary : colors.textTertiary }}
            >
              {getLabel(filter)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

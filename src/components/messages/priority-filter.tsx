import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";

type PriorityFilter = "all" | "high" | "medium" | "low";

interface PriorityFilterBarProps {
  active: PriorityFilter;
  onChange: (filter: PriorityFilter) => void;
}

const FILTERS: PriorityFilter[] = ["all", "high", "medium", "low"];

export function PriorityFilterBar({ active, onChange }: PriorityFilterBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const filterColors: Record<PriorityFilter, string> = {
    all: colors.accentBg,
    high: colors.highBg,
    medium: colors.mediumBg,
    low: colors.lowBg,
  };

  const getLabel = (filter: PriorityFilter) => {
    if (filter === "all") return t("messages.filterAll");
    return t(`priority.${filter}`);
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
              backgroundColor: isActive
                ? filterColors[filter]
                : colors.surfaceBg,
              borderWidth: 1,
              borderColor: isActive
                ? colors.surfaceBorder
                : colors.surfaceBg,
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

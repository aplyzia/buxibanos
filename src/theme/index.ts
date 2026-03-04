import { useThemeStore } from "@/stores/theme-store";
import { getColors, type ThemeColors, type ThemeMode } from "./colors";

export type { ThemeColors, ThemeMode };

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const colors = getColors(mode);
  return { mode, toggle, colors } as const;
}

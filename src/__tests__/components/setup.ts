/**
 * Shared mocks for component tests.
 */

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Return a readable version of the key for assertions
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: "en-US" },
  }),
}));

// Mock theme
jest.mock("@/theme", () => ({
  useTheme: () => ({
    colors: {
      textPrimary: "#000",
      textSecondary: "#666",
      textTertiary: "#999",
      textMuted: "#ccc",
      cardBg: "rgba(255,255,255,0.1)",
      cardBorder: "rgba(255,255,255,0.2)",
      parentCardBorder: "#4A90D9",
      highDot: "#FF4444",
      mediumDot: "#FFAA00",
      lowDot: "#44BB44",
      blueTintBg: "rgba(74,144,217,0.15)",
      avatarText: "#4A90D9",
      actionBg: "rgba(255,68,68,0.15)",
      actionText: "#FF4444",
      respondedBg: "rgba(68,187,68,0.15)",
      respondedText: "#44BB44",
      badgeBg: "rgba(0,0,0,0.05)",
      badgeText: "#666",
      threadBg: "rgba(74,144,217,0.1)",
      threadText: "#4A90D9",
      unreadDot: "#4A90D9",
      surfaceBg: "rgba(255,255,255,0.05)",
      surfaceBorder: "rgba(255,255,255,0.1)",
      accentBg: "rgba(74,144,217,0.2)",
      highBg: "rgba(255,68,68,0.1)",
      mediumBg: "rgba(255,170,0,0.1)",
      lowBg: "rgba(68,187,68,0.1)",
    },
  }),
}));

export {};

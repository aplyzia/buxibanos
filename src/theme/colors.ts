export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  // ─── Gradients ───
  staffGradient: string[];
  parentGradient: string[];
  authGradient: string[];

  // ─── Glass card ───
  cardBg: string;
  cardBorder: string;
  cardDarkBg: string;
  cardDarkBorder: string;

  // ─── Text (inline style values) ───
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // ─── Surfaces ───
  surfaceBg: string;
  surfaceBorder: string;
  inputBg: string;
  inputBorder: string;
  placeholderColor: string;

  // ─── Tab bar ───
  tabBarBg: string;
  tabBarBgNative: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  // ─── Header ───
  headerBg: string;
  headerBorder: string;

  // ─── Chat ───
  sentBubbleBg: string;
  sentBubbleBorder: string;
  receivedBubbleBg: string;
  receivedBubbleBorder: string;
  chatText: string;
  chatTimestamp: string;
  chatSenderName: string;

  // ─── Priority ───
  highBg: string;
  highText: string;
  highDot: string;
  mediumBg: string;
  mediumText: string;
  mediumDot: string;
  lowBg: string;
  lowText: string;
  lowDot: string;

  // ─── Status / feedback ───
  accentBg: string;
  accentColor: string;
  loaderColor: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;

  // ─── Badges ───
  badgeBg: string;
  badgeText: string;
  respondedBg: string;
  respondedText: string;
  actionBg: string;
  actionText: string;
  threadBg: string;
  threadText: string;

  // ─── Date separator ───
  dateSepBg: string;
  dateSepBorder: string;
  dateSepText: string;

  // ─── StatusBar ───
  statusBarStyle: "light" | "dark";

  // ─── Icons ───
  iconDefault: string;
  iconActive: string;

  // ─── Sign-in gradient ───
  signInGradient: string[];
  signInDisabledBg: string;

  // ─── Avatar ───
  avatarBg: string;
  avatarText: string;

  // ─── Misc ───
  unreadDot: string;
  recordingBg: string;
  listeningBg: string;
  overlayBg: string;

  // ─── AI insights ───
  insightsBg: string;
  insightsBorder: string;
  insightsText: string;
  insightsLabel: string;
  insightsIcon: string;

  // ─── Quick links / category ───
  blueTintBg: string;
  greenTintBg: string;
  yellowTintBg: string;
  purpleTintBg: string;
  orangeTintBg: string;

  // ─── Unified inbox card borders ───
  parentCardBorder: string;
  staffCardBorder: string;
}

const dark: ThemeColors = {
  // Gradients
  staffGradient: ["#0F172A", "#1E3A5F", "#312E81", "#1E3A5F"],
  parentGradient: ["#0C4A6E", "#155E75", "#1E40AF", "#3730A3"],
  authGradient: ["#312E81", "#4C1D95", "#831843", "#4C1D95"],

  // Glass card
  cardBg: "rgba(255,255,255,0.15)",
  cardBorder: "rgba(255,255,255,0.25)",
  cardDarkBg: "rgba(0,0,0,0.2)",
  cardDarkBorder: "rgba(255,255,255,0.1)",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.7)",
  textTertiary: "rgba(255,255,255,0.5)",
  textMuted: "rgba(255,255,255,0.4)",

  // Surfaces
  surfaceBg: "rgba(255,255,255,0.1)",
  surfaceBorder: "rgba(255,255,255,0.15)",
  inputBg: "rgba(255,255,255,0.1)",
  inputBorder: "rgba(255,255,255,0.15)",
  placeholderColor: "rgba(255,255,255,0.35)",

  // Tab bar
  tabBarBg: "rgba(15,23,42,0.7)",
  tabBarBgNative: "rgba(15,23,42,0.85)",
  tabBarBorder: "rgba(255,255,255,0.1)",
  tabActive: "#60A5FA",
  tabInactive: "rgba(255,255,255,0.5)",

  // Header
  headerBg: "rgba(15,23,42,0.6)",
  headerBorder: "rgba(255,255,255,0.1)",

  // Chat
  sentBubbleBg: "rgba(96,165,250,0.35)",
  sentBubbleBorder: "rgba(96,165,250,0.3)",
  receivedBubbleBg: "rgba(255,255,255,0.12)",
  receivedBubbleBorder: "rgba(255,255,255,0.15)",
  chatText: "#FFFFFF",
  chatTimestamp: "rgba(255,255,255,0.3)",
  chatSenderName: "rgba(255,255,255,0.4)",

  // Priority
  highBg: "rgba(239,68,68,0.15)",
  highText: "#FCA5A5",
  highDot: "#EF4444",
  mediumBg: "rgba(234,179,8,0.15)",
  mediumText: "#FDE68A",
  mediumDot: "#EAB308",
  lowBg: "rgba(34,197,94,0.15)",
  lowText: "#86EFAC",
  lowDot: "#22C55E",

  // Status
  accentBg: "rgba(96,165,250,0.3)",
  accentColor: "#60A5FA",
  loaderColor: "#60A5FA",
  errorBg: "rgba(239,68,68,0.2)",
  errorBorder: "rgba(239,68,68,0.3)",
  errorText: "#FCA5A5",
  successBg: "rgba(34,197,94,0.2)",
  successText: "#86EFAC",
  warningBg: "rgba(251,146,60,0.15)",
  warningText: "#FDBA74",

  // Badges
  badgeBg: "rgba(255,255,255,0.1)",
  badgeText: "rgba(255,255,255,0.5)",
  respondedBg: "rgba(34,197,94,0.2)",
  respondedText: "#86EFAC",
  actionBg: "rgba(239,68,68,0.25)",
  actionText: "#FCA5A5",
  threadBg: "rgba(96,165,250,0.2)",
  threadText: "#93C5FD",

  // Date separator
  dateSepBg: "rgba(255,255,255,0.1)",
  dateSepBorder: "rgba(255,255,255,0.08)",
  dateSepText: "rgba(255,255,255,0.5)",

  // StatusBar
  statusBarStyle: "light",

  // Icons
  iconDefault: "rgba(255,255,255,0.5)",
  iconActive: "#60A5FA",

  // Sign-in
  signInGradient: ["#4F46E5", "#2563EB"],
  signInDisabledBg: "rgba(255,255,255,0.1)",

  // Avatar
  avatarBg: "rgba(96,165,250,0.3)",
  avatarText: "#FFFFFF",

  // Misc
  unreadDot: "#60A5FA",
  recordingBg: "rgba(239,68,68,0.15)",
  listeningBg: "rgba(96,165,250,0.15)",
  overlayBg: "rgba(255,255,255,0.08)",

  // AI insights
  insightsBg: "rgba(96,165,250,0.12)",
  insightsBorder: "rgba(255,255,255,0.08)",
  insightsText: "rgba(255,255,255,0.8)",
  insightsLabel: "#93C5FD",
  insightsIcon: "#93C5FD",

  // Tints
  blueTintBg: "rgba(96,165,250,0.2)",
  greenTintBg: "rgba(34,197,94,0.2)",
  yellowTintBg: "rgba(234,179,8,0.2)",
  purpleTintBg: "rgba(147,51,234,0.2)",
  orangeTintBg: "rgba(249,115,22,0.2)",

  // Unified inbox
  parentCardBorder: "rgba(96,165,250,0.5)",
  staffCardBorder: "rgba(147,51,234,0.5)",
};

const light: ThemeColors = {
  // Gradients (soft nude / warm cream)
  staffGradient: ["#FDF8F4", "#F5EBE0", "#EDDED0", "#F5EBE0"],
  parentGradient: ["#FDF8F4", "#F0E4D8", "#E8D5C4", "#F0E4D8"],
  authGradient: ["#F5EBE0", "#E8D5C4", "#DCBFA8", "#E8D5C4"],

  // Glass card
  cardBg: "rgba(255,255,255,0.6)",
  cardBorder: "rgba(180,160,140,0.25)",
  cardDarkBg: "rgba(0,0,0,0.04)",
  cardDarkBorder: "rgba(180,160,140,0.15)",

  // Text (warm browns)
  textPrimary: "#44312A",
  textSecondary: "#6B5344",
  textTertiary: "#8C7464",
  textMuted: "#A89484",

  // Surfaces
  surfaceBg: "rgba(255,255,255,0.5)",
  surfaceBorder: "rgba(180,160,140,0.2)",
  inputBg: "rgba(255,255,255,0.7)",
  inputBorder: "rgba(180,160,140,0.3)",
  placeholderColor: "rgba(68,49,42,0.35)",

  // Tab bar
  tabBarBg: "rgba(253,248,244,0.75)",
  tabBarBgNative: "rgba(253,248,244,0.92)",
  tabBarBorder: "rgba(180,160,140,0.2)",
  tabActive: "#A0674D",
  tabInactive: "rgba(120,90,70,0.5)",

  // Header
  headerBg: "rgba(253,248,244,0.6)",
  headerBorder: "rgba(180,160,140,0.2)",

  // Chat
  sentBubbleBg: "rgba(181,115,90,0.18)",
  sentBubbleBorder: "rgba(181,115,90,0.25)",
  receivedBubbleBg: "rgba(255,255,255,0.65)",
  receivedBubbleBorder: "rgba(180,160,140,0.2)",
  chatText: "#44312A",
  chatTimestamp: "#A89484",
  chatSenderName: "#8C7464",

  // Priority
  highBg: "rgba(220,60,60,0.1)",
  highText: "#B91C1C",
  highDot: "#DC2626",
  mediumBg: "rgba(200,150,0,0.1)",
  mediumText: "#A16207",
  mediumDot: "#CA8A04",
  lowBg: "rgba(34,160,80,0.1)",
  lowText: "#15803D",
  lowDot: "#16A34A",

  // Status
  accentBg: "rgba(181,115,90,0.15)",
  accentColor: "#B5735A",
  loaderColor: "#B5735A",
  errorBg: "rgba(220,60,60,0.08)",
  errorBorder: "rgba(220,60,60,0.2)",
  errorText: "#B91C1C",
  successBg: "rgba(34,160,80,0.08)",
  successText: "#15803D",
  warningBg: "rgba(200,150,0,0.08)",
  warningText: "#A16207",

  // Badges
  badgeBg: "rgba(180,160,140,0.12)",
  badgeText: "#8C7464",
  respondedBg: "rgba(34,160,80,0.1)",
  respondedText: "#15803D",
  actionBg: "rgba(220,60,60,0.1)",
  actionText: "#B91C1C",
  threadBg: "rgba(181,115,90,0.12)",
  threadText: "#A0674D",

  // Date separator
  dateSepBg: "rgba(255,255,255,0.6)",
  dateSepBorder: "rgba(180,160,140,0.15)",
  dateSepText: "#8C7464",

  // StatusBar
  statusBarStyle: "dark",

  // Icons
  iconDefault: "rgba(68,49,42,0.45)",
  iconActive: "#A0674D",

  // Sign-in
  signInGradient: ["#B5735A", "#A0674D"],
  signInDisabledBg: "rgba(180,160,140,0.15)",

  // Avatar
  avatarBg: "rgba(181,115,90,0.2)",
  avatarText: "#6B5344",

  // Misc
  unreadDot: "#B5735A",
  recordingBg: "rgba(220,60,60,0.08)",
  listeningBg: "rgba(181,115,90,0.1)",
  overlayBg: "rgba(255,255,255,0.5)",

  // AI insights
  insightsBg: "rgba(181,115,90,0.08)",
  insightsBorder: "rgba(180,160,140,0.15)",
  insightsText: "#6B5344",
  insightsLabel: "#A0674D",
  insightsIcon: "#A0674D",

  // Tints
  blueTintBg: "rgba(96,140,200,0.1)",
  greenTintBg: "rgba(34,160,80,0.1)",
  yellowTintBg: "rgba(200,150,0,0.1)",
  purpleTintBg: "rgba(147,51,234,0.1)",
  orangeTintBg: "rgba(200,120,50,0.1)",

  // Unified inbox
  parentCardBorder: "rgba(96,140,200,0.4)",
  staffCardBorder: "rgba(147,51,234,0.35)",
};

const themes: Record<ThemeMode, ThemeColors> = { dark, light };

export function getColors(mode: ThemeMode): ThemeColors {
  return themes[mode];
}

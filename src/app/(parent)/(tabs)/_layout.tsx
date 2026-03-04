import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { MessageSquare, Bell, Calendar, DollarSign, FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import { useAnnouncementsStore } from "@/stores/announcements-store";

export default function ParentTabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unreadCount = useAnnouncementsStore((s) => s.unreadCount);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: "transparent",
          height: 65,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarBackground: () => (
          <View
            style={[
              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
              Platform.OS === "web"
                ? {
                    backgroundColor: colors.tabBarBg,
                    backdropFilter: "blur(30px)",
                    WebkitBackdropFilter: "blur(30px)",
                    borderTopWidth: 1,
                    borderTopColor: colors.tabBarBorder,
                  } as any
                : { backgroundColor: colors.tabBarBgNative },
            ]}
          />
        ),
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: t("tabs.announcements"),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t("tabs.schedule"),
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: t("tabs.fees"),
          tabBarIcon: ({ color, size }) => (
            <DollarSign color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t("tabs.documents"),
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

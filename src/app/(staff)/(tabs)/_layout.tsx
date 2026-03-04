import { useEffect } from "react";
import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { LayoutDashboard, MessageSquare, CheckSquare } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useChannelsStore } from "@/stores/channels-store";
import { useMessagesStore } from "@/stores/messages-store";
import { useTheme } from "@/theme";

export default function StaffTabsLayout() {
  const { t } = useTranslation();
  const organizationId = useAuthStore((s) => s.organizationId);
  const pendingCount = useTasksStore((s) => s.pendingCount);
  const fetchTasks = useTasksStore((s) => s.fetchTasks);
  const totalUnreadCount = useChannelsStore((s) => s.totalUnreadCount);
  const highPriorityCount = useMessagesStore((s) => s.highPriorityCount);
  const { colors } = useTheme();

  const inboxBadge = totalUnreadCount + highPriorityCount;

  // Hydrate task count on app launch so badge shows immediately
  useEffect(() => {
    if (organizationId) fetchTasks(organizationId);
  }, [organizationId]);

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
        name="dashboard"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
          tabBarBadge: inboxBadge > 0 ? inboxBadge : undefined,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tabs.tasks"),
          tabBarIcon: ({ color, size }) => (
            <CheckSquare color={color} size={size} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
    </Tabs>
  );
}

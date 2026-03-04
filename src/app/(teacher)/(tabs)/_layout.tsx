import { useEffect } from "react";
import { Tabs } from "expo-router";
import { View, Platform } from "react-native";
import { MessageSquare, CheckSquare } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useChannelsStore } from "@/stores/channels-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useTheme } from "@/theme";

export default function TeacherTabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const organizationId = useAuthStore((s) => s.organizationId);
  const totalUnreadCount = useChannelsStore((s) => s.totalUnreadCount);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const resolveStaffNames = useChannelsStore((s) => s.resolveStaffNames);
  const pendingCount = useTasksStore((s) => s.pendingCount);
  const fetchMyTasks = useTasksStore((s) => s.fetchMyTasks);

  const staffId = profile && "id" in profile ? profile.id : "";

  useEffect(() => {
    if (organizationId && staffId) {
      resolveStaffNames(organizationId);
      fetchChannels(organizationId, staffId);
      fetchMyTasks(organizationId, staffId);
    }
  }, [organizationId, staffId]);

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
        name="chats"
        options={{
          title: t("tabs.messages"),
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
          tabBarBadge: totalUnreadCount > 0 ? totalUnreadCount : undefined,
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

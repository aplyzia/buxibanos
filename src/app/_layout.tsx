import { useEffect, useRef } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/theme";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "@/lib/notifications";
import "@/i18n";
import "../../global.css";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const role = useAuthStore((s) => s.role);
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const { colors } = useTheme();
  const pushRegistered = useRef(false);

  useEffect(() => {
    initialize();
  }, []);

  // Register push notifications when profile is available
  useEffect(() => {
    if (!profile || !role || pushRegistered.current) return;
    pushRegistered.current = true;

    const userId = "id" in profile ? profile.id : "";
    const table = role === "parent" ? "parents" : "staff";
    if (userId) {
      registerForPushNotifications(userId, table);
    }
  }, [profile, role]);

  // Handle notification taps — navigate to the relevant screen
  useEffect(() => {
    const cleanup = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (!role) return;

      if (data?.channelId) {
        const routeGroup =
          role === "teacher"
            ? "(teacher)"
            : role === "parent"
            ? "(parent)"
            : "(staff)";
        router.push({
          pathname: `/${routeGroup}/channels/[id]` as any,
          params: { id: data.channelId as string },
        });
      } else if (data?.announcementId && role === "parent") {
        // Navigate to announcements tab when parent taps an announcement notification
        router.push("/(parent)/(tabs)/announcements" as any);
      }
    });
    return cleanup;
  }, [role]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inStaffGroup = segments[0] === "(staff)";
    const inParentGroup = segments[0] === "(parent)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const isTeacher = role === "teacher";
    const isAdmin = role && role !== "parent" && role !== "teacher";

    if (!session) {
      if (!inAuthGroup) {
        router.replace("/(auth)/sign-in");
      }
    } else if (role) {
      if (inAuthGroup) {
        // Just logged in — redirect to correct group
        if (role === "parent") {
          router.replace("/(parent)/(tabs)/messages");
        } else if (isTeacher) {
          router.replace("/(teacher)/(tabs)/chats");
        } else {
          router.replace("/(staff)/(tabs)/dashboard");
        }
      } else if (isTeacher && !inTeacherGroup) {
        // Teacher landed in wrong group
        router.replace("/(teacher)/(tabs)/chats");
      } else if (isAdmin && (inParentGroup || inTeacherGroup)) {
        // Admin landed in parent or teacher routes
        router.replace("/(staff)/(tabs)/dashboard");
      } else if (role === "parent" && (inStaffGroup || inTeacherGroup)) {
        // Parent landed in staff or teacher routes
        router.replace("/(parent)/(tabs)/messages");
      }
    }
  }, [session, role, isLoading, segments]);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
      <Slot />
    </>
  );
}

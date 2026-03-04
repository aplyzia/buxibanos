import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save token to staff/parent table.
 * Returns the Expo push token string or null if registration fails.
 */
export async function registerForPushNotifications(
  userId: string,
  userTable: "staff" | "parents"
): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("[Notifications] Not a physical device, skipping push registration");
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission not granted");
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    console.log("[Notifications] Push token:", token);

    // Save token to database
    await supabase
      .from(userTable)
      .update({ push_token: token })
      .eq("id", userId);

    // Android-specific notification channels
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4F8EF7",
        sound: "default",
      });
      await Notifications.setNotificationChannelAsync("announcements", {
        name: "Announcements",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B6B",
        sound: "default",
      });
    }

    return token;
  } catch (error) {
    console.error("[Notifications] Failed to get push token:", error);
    return null;
  }
}

/**
 * Clear push token from database on sign out.
 */
export async function clearPushToken(
  userId: string,
  userTable: "staff" | "parents"
): Promise<void> {
  await supabase
    .from(userTable)
    .update({ push_token: null })
    .eq("id", userId);
}

/**
 * Add a listener for notification taps (when user taps a notification).
 * Returns a cleanup function to remove the listener.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Add a listener for notifications received while app is in foreground.
 * Returns a cleanup function to remove the listener.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(handler);
  return () => subscription.remove();
}

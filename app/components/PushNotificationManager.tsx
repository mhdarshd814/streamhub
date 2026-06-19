"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

export default function PushNotificationManager() {
  useEffect(() => {
    registerPushNotifications();
  }, []);

  async function registerPushNotifications() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      if (!Capacitor.isNativePlatform()) {
        console.log("Push notifications: Web PWA mode");
        return;
      }

      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive !== "granted") {
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== "granted") {
          toast("Enable notifications for best experience");
          return;
        }
      }

      await PushNotifications.register();

      // Registration success
      PushNotifications.addListener("registration", async (token) => {
        await supabase.from("push_tokens").upsert({
          user_id: session.user.id,
          token: token.value,
          platform: Capacitor.getPlatform(),
          is_active: true,
        });
      });

      // Notification received
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        toast.success(notification.title + ": " + notification.body);
      });

      console.log("Push notifications registered successfully");
    } catch (error) {
      console.warn("Push notification setup failed:", error);
    }
  }

  return null;
}
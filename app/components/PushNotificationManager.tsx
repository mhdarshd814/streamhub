"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

export default function PushNotificationManager() {
  useEffect(() => {
    registerWebServiceWorker();
    setupNativePushNotifications();
  }, []);

  async function registerWebServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      await navigator.serviceWorker.register("/sw.js");
      console.log("Push Service Worker Registered");
    } catch (error) {
      console.error("Service Worker Registration Failed", error);
    }
  }

  async function setupNativePushNotifications() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const permissionStatus = await PushNotifications.checkPermissions();

      if (permissionStatus.receive !== "granted") {
        const requestStatus = await PushNotifications.requestPermissions();

        if (requestStatus.receive !== "granted") {
          toast.error("Notifications are disabled");
          return;
        }
      }

      await PushNotifications.register();

      PushNotifications.addListener("registration", async (token) => {
        const {
          data: { session: latestSession },
        } = await supabase.auth.getSession();

        const user = latestSession?.user;

        if (!user?.id) return;

        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: user.id,
            token: token.value,
            platform: "android",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,token",
          }
        );

        if (error) {
          console.error("Push token save failed:", error.message);
          return;
        }

        console.log("Push token saved");
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
        toast.error("Push notification setup failed");
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        const title = notification.title || "StreamHub";
        const body = notification.body || "New notification";

        toast(`${title}: ${body}`);
      });

      PushNotifications.addListener(
  "pushNotificationActionPerformed",
  (notification) => {
    const data = notification.notification.data || {};

    if (
      data.type === "incoming_call" &&
      typeof data.callId === "string"
    ) {
      window.location.href = `/incoming-call/${data.callId}`;
      return;
    }

    const url = data.url || data.link;

    if (typeof url === "string" && url.startsWith("/")) {
      window.location.href = url;
    }
  }
);
    } catch (error) {
      console.error("Native push setup skipped:", error);
    }
  }

  return null;
}

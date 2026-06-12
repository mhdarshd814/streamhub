"use client";

import { useEffect } from "react";

export default function PushNotificationManager() {
  useEffect(() => {
    async function registerSW() {
      if (!("serviceWorker" in navigator)) return;

      try {
        await navigator.serviceWorker.register("/sw.js");
        console.log("Push Service Worker Registered");
      } catch (error) {
        console.error("Service Worker Registration Failed", error);
      }
    }

    registerSW();
  }, []);

  return null;
}
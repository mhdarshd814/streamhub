"use client";

import { useEffect } from "react";

export default function CapacitorStatusBar() {
  useEffect(() => {
    const setupStatusBar = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) {
          document.documentElement.style.setProperty("--app-status-top", "0px");
          document.documentElement.style.setProperty("--app-bottom-extra", "0px");
          return;
        }

        document.documentElement.style.setProperty("--app-status-top", "16px");
        document.documentElement.style.setProperty("--app-bottom-extra", "60px");

        const { StatusBar, Style } = await import("@capacitor/status-bar");

        await StatusBar.setOverlaysWebView({ overlay: false });

        await StatusBar.setStyle({
          style: Style.Dark,
        });

        await StatusBar.setBackgroundColor({
          color: "#020617",
        });
      } catch (error) {
        console.warn("Capacitor StatusBar setup skipped:", error);
      }
    };

    setupStatusBar();
  }, []);

  return null;
}
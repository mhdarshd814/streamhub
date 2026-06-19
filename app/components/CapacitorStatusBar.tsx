"use client";

import { useEffect } from "react";

export default function CapacitorStatusBar() {
  useEffect(() => {
    const setupStatusBar = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) {
          document.documentElement.style.setProperty("--app-status-top", "0px");
          return;
        }

        document.documentElement.style.setProperty("--app-status-top", "24px");

        const { StatusBar, Style } = await import("@capacitor/status-bar");

        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#0a0a0a" });

        console.log("StatusBar configured for premium dark look");
      } catch (error) {
        console.warn("Capacitor StatusBar setup skipped:", error);
      }
    };

    setupStatusBar();
  }, []);

  return null;
}
"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function AndroidBackButton() {
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let lastBackPress = 0;

    async function setupBackButton() {
      try {
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");

        const listener = await App.addListener("backButton", ({ canGoBack }) => {
          const path = window.location.pathname;

          const exitPages = ["/", "/live-feed", "/login", "/signup"];
          const shouldExit = exitPages.includes(path);

          if (canGoBack && !shouldExit) {
            window.history.back();
            return;
          }

          const now = Date.now();

          if (now - lastBackPress < 1600) {
            App.exitApp();
            return;
          }

          lastBackPress = now;
          toast("Press back again to exit StreamHub", {
            icon: "👋",
            duration: 1800,
          });
        });

        removeListener = () => listener.remove();
      } catch (error) {
        console.warn("Android back button setup skipped:", error);
      }
    }

    setupBackButton();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  return null;
}
"use client";

import { useEffect } from "react";

export default function AndroidBackButton() {
  useEffect(() => {
    let removeListener: (() => void) | null = null;

    async function setupBackButton() {
      try {
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");

        const listener = await App.addListener("backButton", () => {
          const path = window.location.pathname;

          if (path === "/" || path === "") {
            App.exitApp();
            return;
          }

          if (window.history.length > 1) {
            window.history.back();
            return;
          }

          App.exitApp();
        });

        removeListener = () => {
          listener.remove();
        };
      } catch (error) {
        console.warn("Android back button setup skipped:", error);
      }
    }

    setupBackButton();

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, []);

  return null;
}
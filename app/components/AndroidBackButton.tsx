"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export default function AndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let lastBackPress = 0;

    const listener = App.addListener("backButton", ({ canGoBack }) => {
      const path = window.location.pathname;

      const shouldExit =
        path === "/" ||
        path === "/live-feed" ||
        path === "/login" ||
        path === "/signup";

      if (canGoBack && !shouldExit) {
        window.history.back();
        return;
      }

      const now = Date.now();

      if (now - lastBackPress < 1500) {
        App.exitApp();
        return;
      }

      lastBackPress = now;

      if (typeof window !== "undefined") {
        alert("Press back again to exit StreamHub");
      }
    });

    return () => {
      listener.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
}
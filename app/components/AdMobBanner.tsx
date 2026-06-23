"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdOptions,
  BannerAdPosition,
  BannerAdSize,
} from "@capacitor-community/admob";

const BANNER_AD_ID = "ca-app-pub-6760553004071218/2834504322";

const ALLOWED_PREFIXES = [
  "/dashboard",
  "/explore",
  "/analytics",
  "/profile",
  "/notifications",
];

const BLOCKED_PREFIXES = [
  "/live",
  "/watch",
  "/go-live",
  "/calls",
  "/incoming-call",
  "/invites",
  "/admin/broadcast",
];

export default function AdMobBanner() {
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const showingRef = useRef(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    async function syncBanner() {
      try {
        const isBlocked = BLOCKED_PREFIXES.some((prefix) =>
          pathname.startsWith(prefix)
        );

        const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
          pathname.startsWith(prefix)
        );

        if (isBlocked || !isAllowed) {
          if (showingRef.current) {
            await AdMob.hideBanner();
            showingRef.current = false;
          }
          return;
        }

        if (!initializedRef.current) {
          await AdMob.initialize({
            initializeForTesting: true,
          });
          initializedRef.current = true;
        }

        if (!showingRef.current) {
          const options: BannerAdOptions = {
            adId: BANNER_AD_ID,
            adSize: BannerAdSize.BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 76,
            isTesting: true,
          };

          await AdMob.showBanner(options);
          showingRef.current = true;
        } else {
          await AdMob.resumeBanner();
        }
      } catch (error) {
        console.warn("AdMob banner skipped:", error);
      }
    }

    void syncBanner();

    return () => {};
  }, [pathname]);

  return null;
}

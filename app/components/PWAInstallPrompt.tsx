"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("streamhub_pwa_prompt_dismissed");
    if (dismissed === "true") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    await installEvent.userChoice;

    setInstallEvent(null);
    setIsVisible(false);
    localStorage.setItem("streamhub_pwa_prompt_dismissed", "true");
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("streamhub_pwa_prompt_dismissed", "true");
  };

  if (!isVisible || !installEvent) return null;

  return (
    <div className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-4 right-4 z-[9999] mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-4 shadow-2xl xl:bottom-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-xl">
          ▶
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white">Install StreamHub</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Add StreamHub to your home screen for faster access.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Install
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

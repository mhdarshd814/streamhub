"use client";

import { useEffect, useState } from "react";

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = localStorage.getItem("streamhub_pwa_dismissed");
    if (dismissed === "true") return;

    const handler = (e: any) => {
      e.preventDefault();
      setInstallEvent(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    
    setIsVisible(false);
    localStorage.setItem("streamhub_pwa_dismissed", "true");
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("streamhub_pwa_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] max-w-md mx-auto premium-glass rounded-3xl p-6 shadow-2xl">
      <div className="flex gap-4">
        <div className="h-12 w-12 rounded-2xl bg-red-600 flex items-center justify-center text-3xl flex-shrink-0">
          📱
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-lg">Install StreamHub</h3>
          <p className="text-sm text-gray-400 mt-1">
            Add to home screen for quick access to live streams and calls.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleInstall}
              className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-2xl font-semibold"
            >
              Install Now
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-2xl font-semibold"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
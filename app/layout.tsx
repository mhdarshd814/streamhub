import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import Navbar from "./components/Navbar";
import PushNotificationManager from "./components/PushNotificationManager";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import CapacitorStatusBar from "./components/CapacitorStatusBar";
import IncomingCallPopup from "../components/IncomingCallPopup";

export const metadata: Metadata = {
  title: "StreamHub",
  description: "Live Streaming Platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StreamHub",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full bg-black antialiased">
      <body className="min-h-screen bg-black text-white">
        <CapacitorStatusBar />

        <PushNotificationManager />
        <IncomingCallPopup />
        <PWAInstallPrompt />

        <Navbar />

        <main className="min-h-screen pt-16 pb-[90px] xl:pt-0 xl:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
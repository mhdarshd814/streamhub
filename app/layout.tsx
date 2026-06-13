import type { Metadata, Viewport } from "next";
import "./globals.css";

import Navbar from "./components/Navbar";
import PushNotificationManager from "./components/PushNotificationManager";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
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
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#dc2626",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-black antialiased">
      <body className="min-h-full bg-black text-white">
        <PushNotificationManager />
        <IncomingCallPopup />
        <PWAInstallPrompt />

        <Navbar />

        <main className="pt-[84px] pb-[calc(104px+env(safe-area-inset-bottom))] xl:pt-0 xl:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
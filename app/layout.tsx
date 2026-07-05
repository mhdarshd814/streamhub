import type { Metadata, Viewport } from "next";
import "./globals.css";

import Navbar from "./components/Navbar";
import PushNotificationManager from "./components/PushNotificationManager";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import IncomingCallPopup from "./components/IncomingCallPopup";
import PresenceHeartbeat from "./components/PresenceHeartbeat";
import AdMobBanner from "./components/AdMobBanner";
import CapacitorStatusBar from "./components/CapacitorStatusBar";
import AndroidBackButton from "./components/AndroidBackButton";
import ToastProvider from "./components/ToastProvider";
import NativeDialogBlocker from "./components/NativeDialogBlocker";
import AuthRouteGuard from "./components/AuthRouteGuard";

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
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <head>
      <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9119759650278752"
        crossOrigin="anonymous"
        />
    </head>
      <body className="min-h-screen bg-black text-white antialiased">
        <ToastProvider />
        <NativeDialogBlocker />
        <CapacitorStatusBar />
        <AndroidBackButton />
        <PushNotificationManager />
        <PWAInstallPrompt />
        <IncomingCallPopup />
        <PresenceHeartbeat />
        <AdMobBanner />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html.streamhub-theater-mode,
              body.streamhub-theater-mode {
                overflow: hidden !important;
                overscroll-behavior: none !important;
                touch-action: none !important;
                background: #000 !important;
              }

              /* Hide ALL StreamHub chrome bars during fullscreen video:
                 desktop nav, mobile-top-nav, mobile-bottom-nav. The video
                 overlay owns the entire viewport. */
              body.streamhub-theater-mode nav {
                display: none !important;
              }

              body.streamhub-theater-mode .app-shell {
                padding: 0 !important;
                margin: 0 !important;
                min-height: 100dvh !important;
                height: 100dvh !important;
                overflow: hidden !important;
              }

              body.streamhub-theater-mode .page-enter {
                animation: none !important;
                transform: none !important;
                transition: none !important;
              }
            `,
          }}
        />

        <Navbar />

        <main className="app-shell min-h-screen pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+4rem)] md:pb-0">
          <AuthRouteGuard>
            <div className="page-enter">{children}</div>
          </AuthRouteGuard>
        </main>
      </body>
    </html>
  );
}

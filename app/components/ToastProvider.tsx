"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerStyle={{
        top: "calc(env(safe-area-inset-top) + 14px)",
        zIndex: 10000,
      }}
      toastOptions={{
        duration: 2600,
        style: {
          maxWidth: "92vw",
          background: "linear-gradient(180deg, #111827, #030712)",
          color: "#ffffff",
          border: "1px solid rgba(220, 38, 38, 0.55)",
          borderRadius: "18px",
          padding: "13px 16px",
          fontWeight: "800",
          fontSize: "14px",
          lineHeight: "1.35",
          boxShadow:
            "0 18px 45px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          backdropFilter: "blur(14px)",
        },
        success: {
          duration: 2300,
          iconTheme: {
            primary: "#22c55e",
            secondary: "#ffffff",
          },
          style: {
            border: "1px solid rgba(34, 197, 94, 0.55)",
          },
        },
        error: {
          duration: 3200,
          iconTheme: {
            primary: "#dc2626",
            secondary: "#ffffff",
          },
          style: {
            border: "1px solid rgba(220, 38, 38, 0.7)",
          },
        },
        loading: {
          duration: 4000,
          iconTheme: {
            primary: "#dc2626",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}

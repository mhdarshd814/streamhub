"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      gutter={12}
      containerStyle={{
        top: "calc(env(safe-area-inset-top) + 18px)",
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 2600,
        style: {
          background: "#111827",
          color: "#fff",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "20px",
          padding: "14px 18px",
          fontWeight: "600",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          backdropFilter: "blur(12px)",
        },
        success: {
          iconTheme: { primary: "#4ade80", secondary: "#fff" },
          style: { border: "1px solid rgba(74, 222, 128, 0.5)" },
        },
        error: {
          iconTheme: { primary: "#ef4444", secondary: "#fff" },
          style: { border: "1px solid rgba(239, 68, 68, 0.6)" },
        },
      }}
    />
  );
}
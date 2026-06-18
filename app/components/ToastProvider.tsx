"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 2500,
        style: {
          background: "#111827",
          color: "#ffffff",
          border: "1px solid #dc2626",
          borderRadius: "14px",
          padding: "12px 16px",
          fontWeight: "700",
          boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
        },
        success: {
          iconTheme: {
            primary: "#dc2626",
            secondary: "#ffffff",
          },
        },
        error: {
          iconTheme: {
            primary: "#dc2626",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}
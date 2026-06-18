"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function NativeDialogBlocker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalAlert = window.alert;

    window.alert = (message?: any) => {
      const text =
        typeof message === "string"
          ? message
          : message?.message || "Something happened";

      toast(text);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return null;
}
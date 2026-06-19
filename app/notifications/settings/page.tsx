"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function enablePush() {
    setLoading(true);
    setStatus("");

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("Push notifications are not supported in this browser.");
      setLoading(false);
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("Notification permission was not granted.");
      setLoading(false);
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidKey) {
      setStatus("NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.");
      setLoading(false);
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setStatus("Please login first.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ...subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Failed to enable push notifications.");
      setLoading(false);
      return;
    }

    setStatus("Push notifications enabled successfully.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="premium-glass rounded-3xl p-10">
          <div className="text-center mb-10">
            <div className="mx-auto mb-6 text-6xl">🔔</div>
            <h1 className="text-4xl font-black">Notification Settings</h1>
            <p className="mt-3 text-gray-400">Enable browser push notifications for live streams, guest invites, and creator updates.</p>
          </div>

          <button
            onClick={enablePush}
            disabled={loading}
            className="w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500"
          >
            {loading ? "Enabling..." : "Enable Push Notifications"}
          </button>

          {status && (
            <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              {status}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/notifications" className="text-red-400 hover:text-red-300 font-medium">Back to Notifications</Link>
        </div>
      </div>
    </main>
  );
}
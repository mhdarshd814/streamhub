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
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="mb-3 text-3xl font-black">Notification Settings</h1>

        <p className="mb-6 text-gray-400">
          Enable browser push notifications for live streams, guest invites, and
          creator updates.
        </p>

        <button
          onClick={enablePush}
          disabled={loading}
          className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700 disabled:bg-gray-700"
        >
          {loading ? "Enabling..." : "Enable Push Notifications"}
        </button>

        {status && (
          <p className="mt-5 rounded-xl border border-gray-800 bg-black p-4 text-sm text-gray-300">
            {status}
          </p>
        )}

        <Link
          href="/notifications"
          className="mt-6 inline-block text-sm font-bold text-red-400 hover:text-red-300"
        >
          Back to Notifications
        </Link>
      </div>
    </main>
  );
}

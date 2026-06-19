"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }

  async function markAllRead() {
    setUpdating(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    await loadNotifications();
    setUpdating(false);
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ACTIVITY</p>
            <h1 className="text-5xl font-black tracking-tighter mt-2">Notifications</h1>
          </div>

          <button
            onClick={markAllRead}
            disabled={updating || unreadCount === 0}
            className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500 disabled:bg-gray-700"
          >
            {updating ? "Updating..." : "Mark All Read"}
          </button>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-16 text-center">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="premium-glass rounded-3xl p-16 text-center">No notifications yet.</div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div key={notification.id} className="premium-glass rounded-3xl p-6">
                <h3 className="font-bold">{notification.title}</h3>
                <p className="text-sm text-gray-400">{notification.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
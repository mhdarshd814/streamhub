"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let notificationChannel: any = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      await loadNotifications(user.id);

      notificationChannel = supabase
        .channel("notifications-page-" + user.id + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await loadNotifications(user.id);
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
      }
    };
  }, [router]);

  async function loadNotifications(userId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }

  async function openNotification(notification: Notification) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function markAllRead() {
    setUpdating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUpdating(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setUpdating(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadNotifications(user.id);
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const readCount = notifications.filter((item) => item.is_read).length;

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
              Activity Center
            </p>

            <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
              Notifications <span className="text-red-500">Center</span>
            </h1>

            <p className="max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
              View guest invites, stream updates, follower activity and platform
              alerts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={markAllRead}
              disabled={updating || unreadCount === 0}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-400 sm:px-5 sm:text-base"
            >
              {updating ? "Updating..." : "Mark Read"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700 sm:px-5 sm:text-base"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-8 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Total Notifications</p>
            <h2 className="text-3xl font-black sm:text-4xl">
              {notifications.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Unread</p>
            <h2 className="text-3xl font-black text-red-500 sm:text-4xl">
              {unreadCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Read</p>
            <h2 className="text-3xl font-black text-green-500 sm:text-4xl">
              {readCount}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
            <p className="text-gray-400">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
            <p className="mb-5 text-6xl">🔕</p>

            <h2 className="mb-3 text-2xl font-black sm:text-3xl">
              No notifications yet
            </h2>

            <p className="mx-auto max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
              When someone invites you to a stream, follows you, or interacts
              with your content, notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => openNotification(notification)}
                className={
                  notification.is_read
                    ? "w-full rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-gray-600 sm:p-5"
                    : "w-full rounded-2xl border border-red-600/50 bg-red-600/10 p-4 text-left hover:border-red-500 sm:p-5"
                }
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-800 text-2xl sm:h-14 sm:w-14">
                    {notification.type === "guest_invite" ? "🎙️" : "🔔"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <h2 className="break-words text-lg font-black sm:text-xl">
                        {notification.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {!notification.is_read && (
                          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                            NEW
                          </span>
                        )}

                        <span className="text-xs text-gray-500 sm:text-sm">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <p className="break-words text-sm leading-6 text-gray-400 sm:text-base">
                      {notification.message || "New notification"}
                    </p>

                    {notification.link && (
                      <p className="mt-3 text-sm font-bold text-red-400">
                        Open →
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

type InviteProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type InviteStream = {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private";
  thumbnail_url: string | null;
};

type Invite = {
  id: string;
  stream_id: string;
  host_id: string;
  guest_id: string;
  status: "pending" | "accepted" | "declined" | "removed";
  created_at: string;
  streams?: InviteStream | null;
  profiles?: InviteProfile | null;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"alerts" | "invites">("alerts");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

      await Promise.all([loadNotifications(user.id), loadInvites(user.id)]);
      setLoading(false);

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
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stream_guests",
            filter: `guest_id=eq.${user.id}`,
          },
          async () => {
            await loadInvites(user.id);
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
      console.warn("Notifications load failed:", error.message);
      return;
    }

    setNotifications((data || []) as Notification[]);
  }

  async function loadInvites(userId: string) {
    const { data, error } = await supabase
      .from("stream_guests")
      .select(
        `
        *,
        streams:stream_id (
          id,
          title,
          category,
          status,
          visibility,
          thumbnail_url
        ),
        profiles:host_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("guest_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Invites load failed:", error.message);
      return;
    }

    setInvites((data || []) as Invite[]);
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

  async function updateInviteStatus(
    inviteId: string,
    status: "accepted" | "declined"
  ) {
    setUpdatingId(inviteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUpdatingId(null);
      router.push("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileData?.is_banned) {
      setUpdatingId(null);
      router.push("/banned");
      return;
    }

    const { error } = await supabase
      .from("stream_guests")
      .update({ status })
      .eq("id", inviteId);

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadInvites(user.id);
  }

  async function openRoom(invite: Invite) {
    if (!invite.stream_id) {
      alert("Stream not found.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileData?.is_banned) {
      router.push("/banned");
      return;
    }

    router.push(`/live/${invite.stream_id}`);
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const readCount = notifications.filter((item) => item.is_read).length;
  const pendingCount = invites.filter((item) => item.status === "pending").length;
  const acceptedCount = invites.filter(
    (item) => item.status === "accepted"
  ).length;

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
            {tab === "alerts" && (
              <button
                onClick={markAllRead}
                disabled={updating || unreadCount === 0}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-400 sm:px-5 sm:text-base"
              >
                {updating ? "Updating..." : "Mark Read"}
              </button>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700 sm:px-5 sm:text-base"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setTab("alerts")}
            className={
              tab === "alerts"
                ? "rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white sm:text-base"
                : "rounded-xl border border-gray-800 bg-gray-900 px-5 py-3 text-sm font-black text-gray-300 hover:border-red-600 sm:text-base"
            }
          >
            Alerts{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>

          <button
            onClick={() => setTab("invites")}
            className={
              tab === "invites"
                ? "rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white sm:text-base"
                : "rounded-xl border border-gray-800 bg-gray-900 px-5 py-3 text-sm font-black text-gray-300 hover:border-red-600 sm:text-base"
            }
          >
            Invites{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        </div>

        {tab === "alerts" && (
          <>
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
          </>
        )}

        {tab === "invites" && (
          <>
            <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-8 lg:gap-6">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                <p className="mb-2 text-sm text-gray-400">Total Invites</p>
                <h2 className="text-3xl font-black sm:text-4xl">
                  {invites.length}
                </h2>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                <p className="mb-2 text-sm text-gray-400">Pending</p>
                <h2 className="text-3xl font-black text-yellow-400 sm:text-4xl">
                  {pendingCount}
                </h2>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                <p className="mb-2 text-sm text-gray-400">Accepted</p>
                <h2 className="text-3xl font-black text-green-500 sm:text-4xl">
                  {acceptedCount}
                </h2>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
                <p className="text-gray-400">Loading invites...</p>
              </div>
            ) : invites.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
                <p className="mb-5 text-6xl">🎙️</p>

                <h2 className="mb-3 text-2xl font-black sm:text-3xl">
                  No invites yet
                </h2>

                <p className="mx-auto max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
                  When another creator invites you as a guest streamer, the
                  invitation will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:gap-6">
                {invites.map((invite) => {
                  const stream = invite.streams;
                  const host = invite.profiles;
                  const isPrivate = stream?.visibility === "private";
                  const isLive = stream?.status === "live";

                  return (
                    <div
                      key={invite.id}
                      className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900"
                    >
                      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                        <div className="relative h-52 bg-gray-800 sm:h-64 lg:h-full">
                          {stream?.thumbnail_url ? (
                            <Image
                              src={stream.thumbnail_url}
                              alt={stream.title}
                              fill
                              sizes="(min-width: 1024px) 280px, 100vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <div className="text-center text-gray-400">
                                <p className="mb-3 text-5xl">
                                  {isPrivate ? "🔒" : "📺"}
                                </p>
                                <p>No Thumbnail</p>
                              </div>
                            </div>
                          )}

                          <div
                            className={
                              isLive
                                ? "absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black sm:left-4 sm:top-4 sm:px-4 sm:text-sm"
                                : "absolute left-3 top-3 rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400 sm:left-4 sm:top-4 sm:px-4 sm:text-sm"
                            }
                          >
                            {isLive ? "LIVE" : "OFFLINE"}
                          </div>

                          <div
                            className={
                              isPrivate
                                ? "absolute right-3 top-3 rounded-full bg-purple-600 px-3 py-1 text-xs font-black sm:right-4 sm:top-4 sm:px-4 sm:text-sm"
                                : "absolute right-3 top-3 rounded-full bg-green-600 px-3 py-1 text-xs font-black sm:right-4 sm:top-4 sm:px-4 sm:text-sm"
                            }
                          >
                            {isPrivate ? "PRIVATE" : "PUBLIC"}
                          </div>
                        </div>

                        <div className="p-4 sm:p-6">
                          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0">
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-400 sm:text-sm">
                                {invite.status}
                              </p>

                              <h2 className="mb-2 break-words text-2xl font-black sm:text-3xl">
                                {stream?.title || "Stream unavailable"}
                              </h2>

                              <p className="text-sm text-gray-400 sm:text-base">
                                {stream?.category || "General"} •{" "}
                                {isPrivate ? "Private video call" : "Public stream"}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl bg-gray-800 p-3">
                              <Image
                                src={host?.avatar_url || "/default-avatar.png"}
                                alt={host?.username || "Host"}
                                width={44}
                                height={44}
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                              />

                              <div className="min-w-0">
                                <p className="truncate font-bold">
                                  {host?.display_name ||
                                    host?.username ||
                                    "Unknown Host"}
                                </p>
                                <p className="truncate text-sm text-gray-400">
                                  @{host?.username || "unknown"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                            {invite.status === "pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateInviteStatus(invite.id, "accepted")
                                  }
                                  disabled={updatingId === invite.id}
                                  className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:bg-gray-700"
                                >
                                  {updatingId === invite.id
                                    ? "Updating..."
                                    : "Accept Invite"}
                                </button>

                                <button
                                  onClick={() =>
                                    updateInviteStatus(invite.id, "declined")
                                  }
                                  disabled={updatingId === invite.id}
                                  className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                                >
                                  Decline
                                </button>
                              </>
                            )}

                            {invite.status === "accepted" && (
                              <button
                                onClick={() => openRoom(invite)}
                                className="rounded-xl bg-green-600 px-6 py-3 font-bold hover:bg-green-700"
                              >
                                Open Room
                              </button>
                            )}

                            {invite.status === "declined" && (
                              <span className="rounded-xl bg-gray-800 px-6 py-3 text-center font-bold text-gray-500">
                                Declined
                              </span>
                            )}

                            {invite.status === "removed" && (
                              <span className="rounded-xl bg-gray-800 px-6 py-3 text-center font-bold text-gray-500">
                                Removed by Host
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

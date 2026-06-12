"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
};

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

export default function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const notificationRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let inviteChannel: any = null;
    let notificationChannel: any = null;

    async function init() {
      const id = await checkUser();

      if (id) {
        inviteChannel = subscribeToInvites(id);
        notificationChannel = subscribeToNotifications(id);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const id = await checkUser();

      if (inviteChannel) supabase.removeChannel(inviteChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);

      if (id) {
        inviteChannel = subscribeToInvites(id);
        notificationChannel = subscribeToNotifications(id);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (inviteChannel) supabase.removeChannel(inviteChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function subscribeToInvites(id: string) {
    return supabase
      .channel("navbar-invites-" + id + "-" + Date.now())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stream_guests",
          filter: `guest_id=eq.${id}`,
        },
        async () => {
          await loadPendingInvites(id);
        }
      )
      .subscribe();
  }

  function subscribeToNotifications(id: string) {
    return supabase
      .channel("navbar-notifications-" + id + "-" + Date.now())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${id}`,
        },
        async () => {
          await loadNotifications(id);
        }
      )
      .subscribe();
  }

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoggedIn(false);
      setProfile(null);
      setPendingInvites(0);
      setUnreadNotifications(0);
      setNotifications([]);
      setUserId(null);
      return null;
    }

    setLoggedIn(true);
    setUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    setProfile(data || null);
    await loadPendingInvites(user.id);
    await loadNotifications(user.id);

    return user.id;
  }

  async function loadPendingInvites(id: string) {
    const { count, error } = await supabase
      .from("stream_guests")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", id)
      .eq("status", "pending");

    if (!error) setPendingInvites(count || 0);
  }

  async function loadNotifications(id: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error(error.message);
      return;
    }

    setNotifications((data || []) as Notification[]);
    setUnreadNotifications((data || []).filter((item) => !item.is_read).length);
  }

  async function openNotification(notification: Notification) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    if (userId) await loadNotifications(userId);

    setNotificationOpen(false);

    if (notification.link) {
      window.location.href = notification.link;
    }
  }

  async function markAllNotificationsRead() {
    if (!userId) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    await loadNotifications(userId);
  }

  async function logout() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setNotificationOpen(false);
    setPendingInvites(0);
    setUnreadNotifications(0);
    setNotifications([]);
    setUserId(null);
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-red-900/40 bg-gray-950 shadow-lg shadow-red-950/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div
          onClick={() => (window.location.href = "/")}
          className="flex cursor-pointer items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-lg shadow-red-600/30">
            <span className="text-2xl font-black text-white">▶</span>
          </div>

          <div className="leading-none">
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-white">Stream</span>
              <span className="text-red-500">Hub</span>
            </h1>

            <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
              Live Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => (window.location.href = "/")}
            className="font-bold text-gray-100 transition hover:text-red-400"
          >
            Home
          </button>

          <button
            onClick={() => (window.location.href = "/explore")}
            className="font-bold text-gray-100 transition hover:text-red-400"
          >
            Explore
          </button>

          {loggedIn && (
            <>
              <button
                onClick={() => (window.location.href = "/following")}
                className="font-bold text-gray-100 transition hover:text-red-400"
              >
                Following
              </button>

              <button
                onClick={() => (window.location.href = "/invites")}
                className="relative font-bold text-gray-100 transition hover:text-red-400"
              >
                Invites
                {pendingInvites > 0 && (
                  <span className="absolute -right-4 -top-3 min-w-[22px] rounded-full bg-red-600 px-2 py-0.5 text-center text-xs font-black text-white">
                    {pendingInvites}
                  </span>
                )}
              </button>

              <button
                onClick={() => (window.location.href = "/notifications")}
                className="font-bold text-gray-100 transition hover:text-red-400"
              >
                Notifications
              </button>

              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="font-bold text-gray-100 transition hover:text-red-400"
              >
                Dashboard
              </button>

              {profile?.is_admin && (
                <button
                  onClick={() => (window.location.href = "/admin")}
                  className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 font-black text-yellow-300 transition hover:bg-yellow-500 hover:text-black"
                >
                  Admin
                </button>
              )}

              <div ref={notificationRef} className="relative">
                <button
                  onClick={() => {
                    setNotificationOpen(!notificationOpen);
                    setMenuOpen(false);
                  }}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-xl transition hover:border-red-600"
                >
                  🔔
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-2 -top-2 min-w-[22px] rounded-full bg-red-600 px-2 py-0.5 text-center text-xs font-black text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 mt-3 w-96 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
                    <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
                      <div>
                        <h3 className="font-black text-white">Notifications</h3>
                        <p className="text-xs text-gray-400">
                          {unreadNotifications} unread
                        </p>
                      </div>

                      {unreadNotifications > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-xs font-bold text-red-400 hover:text-red-300"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          <p className="mb-2 text-3xl">🔕</p>
                          <p>No notifications yet.</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => openNotification(notification)}
                            className={
                              notification.is_read
                                ? "w-full border-b border-gray-800 px-5 py-4 text-left hover:bg-gray-800"
                                : "w-full border-b border-gray-800 bg-red-600/10 px-5 py-4 text-left hover:bg-gray-800"
                            }
                          >
                            <p className="font-bold text-white">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-sm text-gray-400">
                              {notification.message || "New notification"}
                            </p>
                          </button>
                        ))
                      )}
                    </div>

                    <button
                      onClick={() => (window.location.href = "/notifications")}
                      className="w-full bg-gray-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-red-600"
                    >
                      Open Notifications
                    </button>
                  </div>
                )}
              </div>

              <div ref={menuRef} className="relative">
                <button
                  onClick={() => {
                    setMenuOpen(!menuOpen);
                    setNotificationOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 transition hover:border-red-600"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-700">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "👤"
                    )}
                  </div>

                  <span className="text-base font-semibold text-white">
                    {profile?.display_name || profile?.username || "Profile"}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
                    <MenuItem label="My Profile" href="/profile" />
                    <MenuItem label="Edit Profile" href="/profile/edit" />
                    <MenuItem label="Stream Invites" href="/invites" />
                    <MenuItem label="Notifications" href="/notifications" />
                    <MenuItem label="Create Stream" href="/go-live" />

                    {profile?.is_admin && (
                      <button
                        onClick={() => (window.location.href = "/admin")}
                        className="w-full bg-gray-900 px-5 py-3 text-left font-black text-yellow-300 transition hover:bg-yellow-500 hover:text-black"
                      >
                        Admin Dashboard
                      </button>
                    )}

                    <button
                      onClick={logout}
                      className="w-full bg-gray-900 px-5 py-3 text-left font-bold text-white transition hover:bg-red-600"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {!loggedIn && (
            <>
              <button
                onClick={() => (window.location.href = "/login")}
                className="font-bold text-gray-100 transition hover:text-red-400"
              >
                Login
              </button>

              <button
                onClick={() => (window.location.href = "/signup")}
                className="rounded-xl bg-red-600 px-5 py-3 font-bold shadow-lg shadow-red-600/20 hover:bg-red-700"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuItem({ label, href }: { label: string; href: string }) {
  return (
    <button
      onClick={() => (window.location.href = href)}
      className="w-full bg-gray-900 px-5 py-3 text-left text-white transition hover:bg-red-600"
    >
      {label}
    </button>
  );
}
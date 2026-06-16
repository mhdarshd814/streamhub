"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationOpen, setNotificationOpen] = useState<boolean>(false);
  const [pendingInvites, setPendingInvites] = useState<number>(0);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const notificationRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let inviteChannel: ReturnType<typeof supabase.channel> | null = null;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;

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

  function goTo(path: string) {
    window.location.href = path;
  }

  function profilePath() {
    return "/profile";
  }

  function subscribeToInvites(id: string) {
    return supabase
      .channel(`navbar-invites-${id}-${Date.now()}`)
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
      .channel(`navbar-notifications-${id}-${Date.now()}`)
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

  async function checkUser(): Promise<string | null> {
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

    setProfile((data as Profile) || null);

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

    if (error) return;

    const list = (data || []) as Notification[];

    setNotifications(list);
    setUnreadNotifications(list.filter((item) => !item.is_read).length);
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
    const confirmed = confirm("Logout from StreamHub?");
    if (!confirmed) return;

    await supabase.auth.signOut();

    setMenuOpen(false);
    setMobileMenuOpen(false);
    setNotificationOpen(false);
    setPendingInvites(0);
    setUnreadNotifications(0);
    setNotifications([]);
    setUserId(null);

    window.location.href = "/";
  }

  return (
    <>
      <nav className="sticky top-0 z-50 hidden border-b border-red-900/40 bg-gray-950 shadow-lg shadow-red-950/20 xl:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => goTo("/")}
            className="flex cursor-pointer items-center gap-3"
          >
            <div className="h-14 w-14 overflow-hidden rounded-2xl shadow-lg shadow-red-600/30">
              <img src="/icon-512.png" alt="StreamHub" className="h-full w-full object-cover" />
            </div>

            <div className="leading-none text-left">
              <h1 className="text-4xl font-black tracking-tight">
                <span className="text-white">Stream</span>
                <span className="text-red-500">Hub</span>
              </h1>
              <p className="mt-1 text-xs uppercase tracking-widest text-gray-400">
                Live Platform
              </p>
            </div>
          </button>

          <div className="flex items-center gap-5">
            <DesktopLink label="Home" href="/" />
            <DesktopLink label="Explore" href="/explore" />
            <DesktopLink label="Upcoming" href="/streams/upcoming" />

            {loggedIn ? (
              <>
                <DesktopLink label="Following" href="/following" />

                <button
                  type="button"
                  onClick={() => goTo("/invites")}
                  className="relative font-bold text-gray-100 hover:text-red-400"
                >
                  Invites
                  {pendingInvites > 0 && (
                    <span className="absolute -right-4 -top-3 min-w-[22px] rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                      {pendingInvites}
                    </span>
                  )}
                </button>

                <DesktopLink label="Dashboard" href="/dashboard" />

                {profile?.is_admin && (
                  <button
                    type="button"
                    onClick={() => goTo("/admin")}
                    className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 font-black text-yellow-300 hover:bg-yellow-500 hover:text-black"
                  >
                    Admin
                  </button>
                )}

                <div ref={notificationRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationOpen(!notificationOpen);
                      setMenuOpen(false);
                    }}
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-xl hover:border-red-600"
                  >
                    🔔
                    {unreadNotifications > 0 && (
                      <span className="absolute -right-2 -top-2 min-w-[22px] animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <div className="absolute right-0 mt-3 w-96 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
                      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
                        <div>
                          <h3 className="font-black text-white">Notifications</h3>
                          <p className="text-xs text-gray-400">{unreadNotifications} unread</p>
                        </div>

                        {unreadNotifications > 0 && (
                          <button type="button" onClick={markAllNotificationsRead} className="text-xs font-bold text-red-400">
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-96 overflow-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-gray-400">No notifications yet.</div>
                        ) : (
                          notifications.map((notification) => (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={() => openNotification(notification)}
                              className={
                                notification.is_read
                                  ? "w-full border-b border-gray-800 px-5 py-4 text-left hover:bg-gray-800"
                                  : "w-full border-b border-gray-800 bg-red-600/10 px-5 py-4 text-left hover:bg-gray-800"
                              }
                            >
                              <p className="font-bold text-white">{notification.title}</p>
                              <p className="mt-1 text-sm text-gray-400">
                                {notification.message || "New notification"}
                              </p>
                            </button>
                          ))
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => goTo("/notifications")}
                        className="w-full bg-gray-950 px-5 py-3 text-sm font-bold text-white hover:bg-red-600"
                      >
                        Open Notifications
                      </button>
                    </div>
                  )}
                </div>

                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(!menuOpen);
                      setNotificationOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 hover:border-red-600"
                  >
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-700">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.username || "Profile"} className="h-full w-full object-cover" />
                      ) : (
                        "👤"
                      )}
                    </div>

                    <span className="max-w-[130px] truncate text-base font-semibold text-white">
                      {profile?.display_name || profile?.username || "Profile"}
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
                      <MenuItem label="My Profile" href={profilePath()} />
                      <MenuItem label="Edit Profile" href="/profile/edit" />
                      <MenuItem label="Stream Invites" href="/invites" />
                      <MenuItem label="Notifications" href="/notifications" />
                      <MenuItem label="Create Stream" href="/go-live" />
                      <MenuItem label="Schedule Stream" href="/schedule" />
                      <MenuItem label="Upcoming Streams" href="/streams/upcoming" />
                      <MenuItem label="Calls" href="/calls" />

                      {profile?.is_admin && (
                        <button
                          type="button"
                          onClick={() => goTo("/admin")}
                          className="w-full bg-gray-900 px-5 py-3 text-left font-black text-yellow-300 hover:bg-yellow-500 hover:text-black"
                        >
                          Admin Dashboard
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={logout}
                        className="w-full bg-gray-900 px-5 py-3 text-left font-bold text-white hover:bg-red-600"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <DesktopLink label="Login" href="/login" />
                <button
                  type="button"
                  onClick={() => goTo("/signup")}
                  className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <nav
        className="mobile-top-nav fixed inset-x-0 top-0 z-[9997] flex items-center border-b border-red-900/40 bg-gray-950/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-gray-950/80 xl:hidden"
        style={{ height: "calc(64px + var(--app-status-top, 0px))",
		paddingTop: "var(--app-status-top, 0px)",
		}}
      >
        <div className="flex w-full items-center justify-between">
          <button type="button" onClick={() => goTo("/")} className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-xl">
              <img src="/icon-512.png" alt="StreamHub" className="h-full w-full object-cover" />
            </div>

            <div className="leading-none text-left">
              <h1 className="text-2xl font-black tracking-tight">
                <span className="text-white">Stream</span>
                <span className="text-red-500">Hub</span>
              </h1>
              <p className="hidden">Live Platform</p>
            </div>
          </button>

          {loggedIn ? (
            <button
              type="button"
              onClick={() => goTo("/notifications")}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl"
            >
              🔔
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[20px] animate-pulse rounded-full bg-red-600 px-1.5 text-xs font-black text-white">
                  {unreadNotifications}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo("/login")}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-[9997] border-t border-red-900/40 bg-gray-950/95 backdrop-blur-xl supports-[backdrop-filter]:bg-gray-950/80 xl:hidden">
        <div
          className="relative mx-auto grid max-w-5xl grid-cols-5 items-center px-2"
          style={{
            height: "calc(76px + env(safe-area-inset-bottom))",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <MobileItem icon="🏠" label="Home" href="/" />
          <MobileItem icon="🔎" label="Discover" href="/explore" />

          <button
            type="button"
            onClick={() => goTo(loggedIn ? "/go-live" : "/login")}
            className="absolute left-1/2 top-0 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-red-600 text-white shadow-2xl shadow-red-600/40 active:scale-95"
          >
            <span className="text-3xl font-black leading-none">＋</span>
            <span className="mt-[-2px] text-[10px] font-black uppercase tracking-wide">
              Live
            </span>
          </button>

          <div className="pointer-events-none" />

          <MobileItem icon="📞" label="Calls" href={loggedIn ? "/calls" : "/login"} />

          <button
            type="button"
            onClick={() => {
              if (!loggedIn) {
                goTo("/login");
                return;
              }

              setMobileMenuOpen(true);
            }}
            className="relative flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold text-zinc-400 active:bg-white/5"
          >
            <span className="flex h-7 items-center justify-center text-2xl">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username || "Profile"} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                "👤"
              )}
            </span>
            <span className="text-[11px]">Me</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/70 xl:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-red-900/40 bg-gray-950 p-5 text-white shadow-2xl"
            style={{
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-700" />

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username || "Profile"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>

              <div>
                <p className="text-lg font-black">
                  {profile?.display_name || profile?.username || "My Account"}
                </p>
                <p className="text-sm text-gray-400">@{profile?.username || "streamhub"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MobileSheetItem label="👤 My Profile" href={profilePath()} />
              <MobileSheetItem label="✏️ Edit Profile" href="/profile/edit" />
              <MobileSheetItem label="💰 Wallet" href="/wallet" />
              <MobileSheetItem label="📞 Calls" href="/calls" />
              <MobileSheetItem label="🔔 Notifications" href="/notifications" />
              <MobileSheetItem label="🎥 Go Live" href="/go-live" />
              <MobileSheetItem label="📅 Schedule" href="/schedule" />
              <MobileSheetItem label="📆 Upcoming" href="/streams/upcoming" />
              <MobileSheetItem label="⚙️ Settings" href="/notifications/settings" />

              <button
                type="button"
                onClick={logout}
                className="rounded-2xl bg-red-600 px-4 py-4 text-left text-sm font-black text-white active:scale-95"
              >
                🚪 Logout
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 w-full rounded-2xl bg-gray-800 px-4 py-4 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopLink({ label, href }: { label: string; href: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="font-bold text-gray-100 hover:text-red-400"
    >
      {label}
    </button>
  );
}

function MenuItem({ label, href }: { label: string; href: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="w-full bg-gray-900 px-5 py-3 text-left text-white hover:bg-red-600"
    >
      {label}
    </button>
  );
}

function MobileItem({
  icon,
  label,
  href,
  badge,
}: {
  icon: ReactNode;
  label: string;
  href: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="relative flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold text-zinc-400 active:bg-white/5"
    >
      <span className="flex h-7 items-center justify-center text-2xl">{icon}</span>
      <span className="text-[11px]">{label}</span>

      {!!badge && badge > 0 && (
        <span className="absolute right-4 top-2 min-w-[20px] animate-pulse rounded-full bg-red-600 px-1.5 text-xs font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileSheetItem({ label, href }: { label: string; href: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="rounded-2xl bg-gray-800 px-4 py-4 text-left text-sm font-bold text-white active:scale-95"
    >
      {label}
    </button>
  );
}
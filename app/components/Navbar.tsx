"use client";

import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export default function Navbar() {
  const router = useRouter();

  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keep your existing auth, notifications, profile loading logic...

  return (
    <>
      {/* Premium Desktop Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-xl hidden xl:block">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(loggedIn ? "/live-feed" : "/login")}>
            <div className="h-12 w-12 overflow-hidden rounded-2xl premium-glow">
              <img src="/icon-512.png" alt="StreamHub" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter">
                Stream<span className="text-red-500">Hub</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <button onClick={() => router.push("/live-feed")} className="font-semibold hover:text-red-400 transition">Live Feed</button>
            <button onClick={() => router.push("/explore")} className="font-semibold hover:text-red-400 transition">Discover</button>

            {loggedIn && (
              <button 
                onClick={() => router.push("/go-live")}
                className="rounded-2xl bg-red-600 px-6 py-3 font-black hover:bg-red-500 transition"
              >
                + Go Live
              </button>
            )}

            {loggedIn && (
              <div className="flex items-center gap-6">
                <button className="relative text-2xl hover:text-red-400 transition">🔔 
                  {unreadNotifications > 0 && <span className="absolute -top-1 -right-1 text-xs bg-red-600 rounded-full px-1.5 py-0.5">{unreadNotifications}</span>}
                </button>

                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
                  <div className="h-9 w-9 rounded-full overflow-hidden border border-white/20">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : "👤"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      {loggedIn && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-xl xl:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-around py-3">
            <button onClick={() => router.push("/live-feed")} className="flex flex-col items-center gap-1 text-xs">
              <span>🏠</span>
              <span>Home</span>
            </button>

            <button onClick={() => router.push("/explore")} className="flex flex-col items-center gap-1 text-xs">
              <span>🔍</span>
              <span>Discover</span>
            </button>

            <button onClick={() => router.push("/go-live")} className="flex flex-col items-center -mt-8">
              <div className="h-16 w-16 rounded-full border-4 border-black bg-red-600 flex items-center justify-center text-3xl shadow-2xl">🎥</div>
            </button>

            <button onClick={() => router.push("/notifications")} className="flex flex-col items-center gap-1 text-xs relative">
              <span>🔔</span>
              <span>Notifications</span>
              {unreadNotifications > 0 && <span className="absolute -top-1 right-1 text-xs bg-red-600 rounded-full px-1.5 py-0.5">{unreadNotifications}</span>}
            </button>

            <button onClick={() => router.push("/profile")} className="flex flex-col items-center gap-1 text-xs">
              <span>👤</span>
              <span>Profile</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
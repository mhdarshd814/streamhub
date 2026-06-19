"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function StreamHubHome() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const routeUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!cancelled) {
          if (session?.user) {
            window.location.replace("/live-feed");
          } else {
            window.location.replace("/login");
          }
        }
      } catch (err) {
        if (!cancelled) window.location.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    // Small delay for premium splash feel
    const timer = setTimeout(routeUser, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black overflow-hidden relative flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(at_top,#4c1d16_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />

      <div className="relative z-10 w-full max-w-md px-6 text-center">
        {/* Logo */}
        <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-red-600 to-red-800 p-1 shadow-2xl shadow-red-600/50 premium-glow">
          <img 
            src="/icon-512.png" 
            alt="StreamHub" 
            className="h-full w-full rounded-[2rem] object-cover ring-1 ring-white/20" 
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-6xl font-black tracking-tighter mb-2">
          Stream<span className="text-red-500">Hub</span>
        </h1>
        <p className="text-xl text-gray-400 font-light tracking-wide">Creators Live Together</p>

        {/* Tagline */}
        <div className="mt-6 mb-12 text-sm uppercase tracking-[3px] text-red-500/80 font-mono">
          THE ALL-IN-ONE CREATOR PLATFORM
        </div>

        {/* Loading Indicator */}
        <div className="mx-auto w-48 h-1 bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-red-500 via-red-600 to-red-500 animate-loading-bar" />
        </div>

        {/* Feature Teasers */}
        <div className="mt-16 grid grid-cols-3 gap-4 text-xs">
          <div className="premium-card p-4 rounded-3xl text-center">
            <div className="text-2xl mb-1">🎥</div>
            <div>Live</div>
          </div>
          <div className="premium-card p-4 rounded-3xl text-center">
            <div className="text-2xl mb-1">📞</div>
            <div>Calls</div>
          </div>
          <div className="premium-card p-4 rounded-3xl text-center">
            <div className="text-2xl mb-1">💰</div>
            <div>Earn</div>
          </div>
        </div>
      </div>

      {/* Bottom Brand Line */}
      <div className="absolute bottom-8 text-xs text-gray-600 tracking-widest">
        BUILT FOR CREATORS • POWERED BY COMMUNITY
      </div>
    </main>
  );
}
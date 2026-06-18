"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  useEffect(() => {
    let cancelled = false;

    async function routeUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        window.location.replace("/live-feed");
        return;
      }

      window.location.replace("/login");
    }

    routeUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30">
          <img
            src="/icon-512.png"
            alt="StreamHub"
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-white">Stream</span>
          <span className="text-red-500">Hub</span>
        </h1>

        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
          Opening
        </p>

        <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-red-600" />
        </div>
      </div>
    </main>
  );
}
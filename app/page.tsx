"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  useEffect(() => {
    let cancelled = false;

    async function routeUser() {
      // Wait for the real session answer. The old 1.8s race timed out on
      // slow Android cold starts and wrongly sent signed-in users to
      // /login. A generous fallback only guards against a total hang.
      let resolved = false;

      const fallback = setTimeout(() => {
        if (!resolved && !cancelled) {
          window.location.replace("/login");
        }
      }, 10000);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        resolved = true;
        clearTimeout(fallback);

        if (cancelled) return;

        if (session?.user && session.access_token) {
          window.location.replace("/live-feed");
        } else {
          window.location.replace("/login");
        }
      } catch {
        resolved = true;
        clearTimeout(fallback);
        if (!cancelled) window.location.replace("/login");
      }
    }

    routeUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <section className="slide-up w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30 premium-glow">
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

        <div className="mx-auto mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-gray-800">
          <div className="opening-bar h-full w-1/2 rounded-full bg-red-600" />
        </div>

        <div className="mx-auto mt-8 space-y-3 rounded-3xl border border-red-900/30 bg-gray-950/70 p-4 text-left shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3">
            <div className="skeleton skeleton-avatar" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-line w-3/4" />
              <div className="skeleton skeleton-line w-1/2" />
            </div>
          </div>

          <div className="skeleton skeleton-card" />
        </div>
      </section>
    </main>
  );
}

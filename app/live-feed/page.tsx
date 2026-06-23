"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LiveFeedPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finding a live stream...");

  useEffect(() => {
    let cancelled = false;

    async function openFirstLiveStream() {
      setStatus("Finding a live stream...");

      const { data, error } = await supabase
        .from("streams")
        .select("id")
        .eq("status", "live")
        .in("visibility", ["public", "subscribers"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Live feed redirect error:", error);
        setStatus("Unable to load live streams. Please try again.");
        return;
      }

      if (!data?.id) {
        setStatus("No live streams right now.");
        return;
      }

      router.replace(`/watch/${data.id}?feed=1`);
    }

    openFirstLiveStream();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center space-y-4">
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />

        <div>
          <h1 className="text-xl font-semibold">Live Feed</h1>
          <p className="mt-2 text-sm text-white/60">{status}</p>
        </div>

        {status !== "Finding a live stream..." && (
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Try Again
          </button>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LiveFeedPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finding a live stream...");

  useEffect(() => {
    let cancelled = false;

    async function redirectToWorkingWatchPage() {
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
        setStatus("Unable to load live streams.");
        return;
      }

      if (!data?.id) {
        setStatus("No live streams right now.");
        return;
      }

      router.replace(`/watch/${data.id}`);
    }

    redirectToWorkingWatchPage();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center space-y-4">
        <div className="mx-auto h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <h1 className="text-xl font-semibold">Opening Live Stream</h1>
        <p className="text-sm text-white/60">{status}</p>
      </div>
    </main>
  );
}

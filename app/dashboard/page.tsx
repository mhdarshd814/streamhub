"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const creatorName = profile?.display_name || profile?.username || "Creator";

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <p className="text-gray-400">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR HUB</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Welcome, {creatorName}</h1>
          <p className="mt-3 text-gray-400">Your personal creator dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add your dashboard cards here */}
          <div className="premium-glass rounded-3xl p-8">
            <p className="text-sm text-gray-400">Go Live</p>
            <p className="text-3xl font-black mt-2">Start Streaming</p>
          </div>

          <div className="premium-glass rounded-3xl p-8">
            <p className="text-sm text-gray-400">Wallet</p>
            <p className="text-3xl font-black mt-2">Check Earnings</p>
          </div>

          <div className="premium-glass rounded-3xl p-8">
            <p className="text-sm text-gray-400">Analytics</p>
            <p className="text-3xl font-black mt-2">View Stats</p>
          </div>
        </div>
      </div>
    </main>
  );
}
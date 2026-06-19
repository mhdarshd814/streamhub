"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AnalyticsPage() {
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
        <p className="text-gray-400">Loading analytics...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR TOOLS</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">
            {creatorName}'s <span className="text-red-500">Analytics</span>
          </h1>
          <p className="mt-3 text-gray-400 max-w-2xl">
            Public stream performance, private calls, tips and subscription insights.
          </p>
        </div>

        <div className="premium-glass rounded-3xl p-12 text-center">
          <p className="text-2xl text-gray-400">Analytics dashboard coming soon...</p>
          <p className="text-sm text-gray-500 mt-4">Real-time stats will be available after launch.</p>
        </div>
      </div>
    </main>
  );
}
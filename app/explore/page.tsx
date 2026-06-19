"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ExplorePage() {
  const [streams, setStreams] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadExplore() {
    setLoading(true);

    const { data: streamData } = await supabase
      .from("streams")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });

    const { data: creatorData } = await supabase
      .from("profiles")
      .select("*")
      .order("followers", { ascending: false })
      .limit(20);

    setStreams(streamData || []);
    setCreators(creatorData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadExplore();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">DISCOVER</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Explore</h1>
        </div>

        <div className="mb-8">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search streams or creators..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-lg outline-none focus:border-red-500"
          />
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading explore...</div>
        ) : (
          <div>
            {/* Your streams and creators grid here */}
            <p className="text-gray-400">Explore content coming soon...</p>
          </div>
        )}
      </div>
    </main>
  );
}
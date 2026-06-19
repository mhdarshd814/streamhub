"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function FollowingPage() {
  const [personalizedStreams, setPersonalizedStreams] = useState<any[]>([]);
  const [recommendedCreators, setRecommendedCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFollowing() {
      setLoading(true);

      const { data: streams } = await supabase
        .from("streams")
        .select("*")
        .eq("status", "live")
        .limit(20);

      const { data: creators } = await supabase
        .from("profiles")
        .select("*")
        .limit(20);

      setPersonalizedStreams(streams || []);
      setRecommendedCreators(creators || []);
      setLoading(false);
    }

    loadFollowing();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">FOLLOWING</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Following Feed</h1>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-16 text-center">Loading your following feed...</div>
        ) : personalizedStreams.length === 0 ? (
          <div className="premium-glass rounded-3xl p-16 text-center">
            No streams from people you follow yet.
          </div>
        ) : (
          <div>
            {/* Your streams grid here */}
            <p className="text-gray-400">Following content coming soon...</p>
          </div>
        )}
      </div>
    </main>
  );
}
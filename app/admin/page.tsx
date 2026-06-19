"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeStreams: 0,
    totalTips: 0,
    totalBroadcasts: 0,
  });
  const [loading, setLoading] = useState(true);

  async function loadAdminDashboard() {
    setLoading(true);

    // You can expand this with real queries later
    const { count: users } = await supabase.from("profiles").select("*", { count: "exact" });
    const { count: streams } = await supabase.from("streams").select("*", { count: "exact" });

    setStats({
      totalUsers: users || 0,
      activeStreams: streams || 0,
      totalTips: 0,
      totalBroadcasts: 0,
    });

    setLoading(false);
  }

  useEffect(() => {
    loadAdminDashboard();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN PANEL</p>
            <h1 className="text-5xl font-black tracking-tighter">Dashboard</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadAdminDashboard}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/admin/broadcast" className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500">
              New Broadcast
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading dashboard...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="premium-glass rounded-3xl p-8 text-center">
              <p className="text-6xl font-black text-red-400">{stats.totalUsers}</p>
              <p className="text-sm text-gray-400 mt-2">Total Users</p>
            </div>

            <div className="premium-glass rounded-3xl p-8 text-center">
              <p className="text-6xl font-black text-green-400">{stats.activeStreams}</p>
              <p className="text-sm text-gray-400 mt-2">Active Streams</p>
            </div>

            <div className="premium-glass rounded-3xl p-8 text-center">
              <p className="text-6xl font-black">0</p>
              <p className="text-sm text-gray-400 mt-2">Total Tips</p>
            </div>

            <div className="premium-glass rounded-3xl p-8 text-center">
              <p className="text-6xl font-black">0</p>
              <p className="text-sm text-gray-400 mt-2">Broadcasts</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
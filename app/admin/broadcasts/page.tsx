"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Broadcast = {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
};

export default function AdminBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadBroadcasts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("admin_broadcasts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setBroadcasts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadBroadcasts();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Broadcasts</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadBroadcasts}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/admin/broadcast" className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500">
              + New Broadcast
            </Link>

            <Link href="/admin" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
              Back to Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading broadcasts...</div>
        ) : broadcasts.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No broadcasts yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6">
            <div className="space-y-4">
              {broadcasts.map((broadcast) => (
                <div key={broadcast.id} className="rounded-2xl border border-white/10 p-6 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{broadcast.title}</h3>
                    <p className="text-sm text-gray-400">{broadcast.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="capitalize text-sm px-4 py-1 rounded-full bg-white/10">{broadcast.status}</span>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(broadcast.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
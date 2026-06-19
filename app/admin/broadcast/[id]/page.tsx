"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminBroadcastPage() {
  const params = useParams();
  const broadcastId = params.id as string;

  const [broadcast, setBroadcast] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadStudio() {
    setLoading(true);

    const { data, error } = await supabase
      .from("admin_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setBroadcast(data);
    setLoading(false);
  }

  useEffect(() => {
    if (broadcastId) {
      loadStudio();
    }
  }, [broadcastId]);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
          <h1 className="text-5xl font-black tracking-tighter">Broadcast Studio</h1>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading broadcast...</div>
        ) : !broadcast ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Broadcast not found.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-8">
            <h2 className="text-2xl font-black mb-4">{broadcast.title}</h2>
            <p className="text-gray-400">{broadcast.description}</p>

            {/* Add your broadcast UI here */}
            <div className="mt-8 p-6 bg-black/50 rounded-2xl">
              <p className="text-center text-gray-400">Broadcast controls coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
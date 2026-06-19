"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CallRequest = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string;
  status: string;
  created_at: string;
};

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCalls() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setCalls(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCalls();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR TOOLS</p>
            <h1 className="text-5xl font-black tracking-tighter">Private Calls</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadCalls}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/wallet" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
              Wallet
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No private calls yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 space-y-4">
            {calls.map((call) => (
              <div key={call.id} className="rounded-2xl border border-white/10 p-6 flex justify-between">
                <div>
                  <p className="font-bold">Private Call #{call.id.slice(0, 8)}</p>
                  <p className="text-sm text-gray-400">Status: {call.status}</p>
                </div>
                <div className="text-sm text-gray-400">
                  {new Date(call.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PayoutRequest = {
  id: string;
  creator_id: string;
  amount_usd: number;
  status: string;
  payout_note?: string;
  created_at: string;
  profiles?: {
    username?: string;
    display_name?: string;
  };
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPayouts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("creator_payout_requests")
      .select(`
        *,
        profiles:creator_id (
          username,
          display_name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setPayouts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPayouts();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Payout Requests</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadPayouts}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/admin" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
              Back to Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading payout requests...</div>
        ) : payouts.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No payout requests yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">Creator</th>
                  <th className="pb-4">Amount</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-4">
                      {payout.profiles?.display_name || payout.profiles?.username || "Unknown"}
                    </td>
                    <td className="py-4 font-bold text-green-400">
                      ${payout.amount_usd}
                    </td>
                    <td className="py-4">
                      <span className="capitalize px-4 py-1 rounded-full bg-white/10 text-sm">
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
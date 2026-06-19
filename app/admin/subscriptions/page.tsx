"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Subscription = {
  id: string;
  creator_id: string;
  subscriber_id: string;
  status: string;
  created_at: string;
  creator_profile?: {
    username?: string;
    display_name?: string;
  };
  subscriber_profile?: {
    username?: string;
    display_name?: string;
  };
};

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("creator_subscriptions")
      .select(`
        *,
        creator_profile:creator_id (
          username,
          display_name
        ),
        subscriber_profile:subscriber_id (
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

    setSubscriptions(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Subscriptions</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadData}
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
          <div className="premium-glass rounded-3xl p-12 text-center">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No subscriptions yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">Creator</th>
                  <th className="pb-4">Subscriber</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="py-4">
                      {sub.creator_profile?.display_name || sub.creator_profile?.username}
                    </td>
                    <td className="py-4">
                      {sub.subscriber_profile?.display_name || sub.subscriber_profile?.username}
                    </td>
                    <td className="py-4 capitalize">{sub.status}</td>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(sub.created_at).toLocaleDateString()}
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
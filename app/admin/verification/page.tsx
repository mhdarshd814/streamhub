"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VerificationRequest = {
  id: string;
  user_id: string;
  reason: string;
  social_link?: string;
  status: string;
  admin_note?: string;
  created_at: string;
  profiles?: {
    username?: string;
    display_name?: string;
  };
};

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    setLoading(true);

    const { data, error } = await supabase
      .from("creator_verification_requests")
      .select(`
        *,
        profiles:user_id (
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

    setRequests(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Verification Requests</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadRequests}
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
          <div className="premium-glass rounded-3xl p-12 text-center">Loading verification requests...</div>
        ) : requests.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No verification requests yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">User</th>
                  <th className="pb-4">Reason</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-4 font-medium">
                      {req.profiles?.display_name || req.profiles?.username}
                    </td>
                    <td className="py-4 text-sm">{req.reason}</td>
                    <td className="py-4">
                      <span className="capitalize px-4 py-1 rounded-full bg-white/10 text-sm">{req.status}</span>
                    </td>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(req.created_at).toLocaleDateString()}
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
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InvitesPage() {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadInvites() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("stream_guests")
      .select("*")
      .eq("guest_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setInvites(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadInvites();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">INVITES</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Guest Invites</h1>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-16 text-center">Loading invites...</div>
        ) : invites.length === 0 ? (
          <div className="premium-glass rounded-3xl p-16 text-center">No invites yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-8">
            {/* Your invites list here */}
            <p className="text-gray-400">Invites coming soon...</p>
          </div>
        )}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function UpcomingStreamsPage() {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<string[]>([]);
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setUserId(user.id);
      await loadReminders(user.id);
    }

    await loadUpcomingStreams();
    setLoading(false);
  }

  async function loadUpcomingStreams() {
    const now = new Date().toISOString();

    const { data } = await supabase
      .from("scheduled_streams")
      .select(`
        *,
        profiles:creator_id (
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq("status", "scheduled")
      .gte("scheduled_start", now)
      .order("scheduled_start", { ascending: true })
      .limit(50);

    setStreams(data || []);
  }

  async function loadReminders(id: string) {
    const { data } = await supabase
      .from("stream_reminders")
      .select("scheduled_stream_id")
      .eq("user_id", id);

    setReminders((data || []).map((item: any) => item.scheduled_stream_id));
  }

  // Keep your existing toggleReminder and groupLabel functions...

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">DISCOVERY</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Upcoming Streams</h1>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-16 text-center">Loading upcoming streams...</div>
        ) : streams.length === 0 ? (
          <div className="premium-glass rounded-3xl p-16 text-center">No upcoming streams yet.</div>
        ) : (
          <div className="space-y-12">
            {/* Your grouped streams here */}
            <p className="text-gray-400">Upcoming streams coming soon...</p>
          </div>
        )}
      </div>
    </main>
  );
}
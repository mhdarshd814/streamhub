"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ScheduleStreamPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [scheduledStreams, setScheduledStreams] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScheduledStreams();
  }, []);

  async function loadScheduledStreams() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("scheduled_streams")
      .select("*")
      .eq("creator_id", user.id)
      .order("scheduled_start", { ascending: true });

    setScheduledStreams(data || []);
  }

  // Keep your existing createSchedule and cancelSchedule functions...

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR TOOLS</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Schedule Stream</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="premium-glass rounded-3xl p-8">
            <h2 className="text-2xl font-black mb-6">Create New Schedule</h2>
            {/* Your form inputs */}
          </div>

          {/* List */}
          <div className="premium-glass rounded-3xl p-8">
            <h2 className="text-2xl font-black mb-6">My Scheduled Streams</h2>
            {/* Your list */}
          </div>
        </div>
      </div>
    </main>
  );
}
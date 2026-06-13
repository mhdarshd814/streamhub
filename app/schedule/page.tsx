"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type ScheduledStream = {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  description: string | null;
  scheduled_start: string;
  notify_followers: boolean;
  status: string;
  created_at: string;
};

export default function ScheduleStreamPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [scheduledStreams, setScheduledStreams] = useState<ScheduledStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    await loadScheduledStreams(user.id);
    setLoading(false);
  }

  async function loadScheduledStreams(id: string) {
    const { data, error } = await supabase
      .from("scheduled_streams")
      .select("*")
      .eq("creator_id", id)
      .order("scheduled_start", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setScheduledStreams((data || []) as ScheduledStream[]);
  }

  async function createSchedule() {
    if (!userId) return;

    if (!title.trim()) {
      alert("Please enter a stream title.");
      return;
    }

    if (!category.trim()) {
      alert("Please enter a category.");
      return;
    }

    if (!scheduledStart) {
      alert("Please select start date and time.");
      return;
    }

    const selectedDate = new Date(scheduledStart);

    if (selectedDate.getTime() <= Date.now()) {
      alert("Scheduled time must be in the future.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("scheduled_streams").insert([
      {
        creator_id: userId,
        title: title.trim(),
        category: category.trim(),
        description: description.trim() || null,
        scheduled_start: selectedDate.toISOString(),
        notify_followers: notifyFollowers,
        status: "scheduled",
      },
    ]);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setCategory("");
    setDescription("");
    setScheduledStart("");
    setNotifyFollowers(true);

    await loadScheduledStreams(userId);

    alert("Stream scheduled successfully.");
  }

  async function cancelSchedule(id: string) {
    if (!userId) return;

    const confirmed = confirm("Cancel this scheduled stream?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("scheduled_streams")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("creator_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadScheduledStreams(userId);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-400">
            StreamHub Creator Tools
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            📅 Schedule Stream
          </h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Plan your next stream and optionally notify followers before going live.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-5 text-2xl font-black">Create Schedule</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  📝 Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: Friday Night Live"
                  className="w-full rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  🎮 Category
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Gaming, Music, Talk Show, Education..."
                  className="w-full rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell followers what this stream is about..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  ⏰ Start Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-black p-4 text-white outline-none focus:border-red-500"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-800 bg-black/40 p-4">
                <input
                  type="checkbox"
                  checked={notifyFollowers}
                  onChange={(e) => setNotifyFollowers(e.target.checked)}
                  className="h-5 w-5 accent-red-600"
                />
                <span className="font-bold">🔔 Notify followers</span>
              </label>

              <button
                onClick={createSchedule}
                disabled={saving}
                className="w-full rounded-xl bg-red-600 px-6 py-4 font-black text-white hover:bg-red-700 disabled:bg-gray-700"
              >
                {saving ? "Saving..." : "Schedule Stream"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-5 text-2xl font-black">My Scheduled Streams</h2>

            {scheduledStreams.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-6 text-center text-gray-400">
                <p className="mb-3 text-4xl">📭</p>
                <p>No scheduled streams yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledStreams.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-800 bg-black/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{item.title}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {item.category}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          item.status === "scheduled"
                            ? "bg-green-500/10 text-green-300"
                            : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.description && (
                      <p className="mt-3 text-sm leading-6 text-gray-300">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-4 rounded-xl bg-gray-900 p-3 text-sm text-gray-300">
                      ⏰{" "}
                      {new Date(item.scheduled_start).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>

                    <p className="mt-3 text-sm text-gray-400">
                      {item.notify_followers
                        ? "🔔 Followers notification enabled"
                        : "🔕 Followers notification disabled"}
                    </p>

                    {item.status === "scheduled" && (
                      <button
                        onClick={() => cancelSchedule(item.id)}
                        className="mt-4 rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-red-600"
                      >
                        Cancel Schedule
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "../../../lib/supabase";

type UpcomingStream = {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  description: string | null;
  scheduled_start: string;
  notify_followers: boolean;
  status: string;
  created_at: string;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean | null;
  } | null;
};

export default function UpcomingStreamsPage() {
  const [streams, setStreams] = useState<UpcomingStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<string[]>([]);
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(
    null
  );

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setUserId(user.id);
      await loadReminders(user.id);
    }

    await loadUpcomingStreams();
    setLoading(false);
  }

  async function loadUpcomingStreams() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("scheduled_streams")
      .select(
        `
        *,
        profiles:creator_id (
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `
      )
      .eq("status", "scheduled")
      .gte("scheduled_start", now)
      .order("scheduled_start", { ascending: true })
      .limit(50);

    if (error) {
      alert(error.message);
      return;
    }

    setStreams((data || []) as UpcomingStream[]);
  }

  async function loadReminders(id: string) {
    const { data, error } = await supabase
      .from("stream_reminders")
      .select("scheduled_stream_id")
      .eq("user_id", id);

    if (error) {
      console.error(error.message);
      return;
    }

    setReminders((data || []).map((item: any) => item.scheduled_stream_id));
  }

  async function toggleReminder(streamId: string) {
    if (!userId) {
      alert("Please login first.");
      window.location.href = "/login";
      return;
    }

    setReminderLoadingId(streamId);

    const alreadySet = reminders.includes(streamId);

    if (alreadySet) {
      const { error } = await supabase
        .from("stream_reminders")
        .delete()
        .eq("user_id", userId)
        .eq("scheduled_stream_id", streamId);

      setReminderLoadingId(null);

      if (error) {
        alert(error.message);
        return;
      }

      setReminders((current) => current.filter((id) => id !== streamId));
      return;
    }

    const { error } = await supabase.from("stream_reminders").insert([
      {
        user_id: userId,
        scheduled_stream_id: streamId,
      },
    ]);

    setReminderLoadingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setReminders((current) => [...current, streamId]);
  }

  function groupLabel(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const startOfNextDay = new Date(startOfTomorrow);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    if (date >= startOfToday && date < startOfTomorrow) return "Today";
    if (date >= startOfTomorrow && date < startOfNextDay) return "Tomorrow";

    return date.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  const groupedStreams = streams.reduce<Record<string, UpcomingStream[]>>(
    (groups, stream) => {
      const label = groupLabel(stream.scheduled_start);
      if (!groups[label]) groups[label] = [];
      groups[label].push(stream);
      return groups;
    },
    {}
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Loading upcoming streams...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-400">
            StreamHub Discovery
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            📅 Upcoming Streams
          </h1>

          <p className="mt-3 max-w-2xl text-gray-400">
            Discover scheduled streams from creators and set reminders for the
            ones you do not want to miss.
          </p>
        </div>

        {streams.length === 0 ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="mb-4 text-6xl">📭</p>

            <h2 className="text-2xl font-black">No upcoming streams yet</h2>

            <p className="mt-3 text-gray-400">
              Scheduled streams will appear here once creators plan their next
              live session.
            </p>

            <button
              onClick={() => (window.location.href = "/explore")}
              className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
            >
              Explore Creators
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedStreams).map(([label, group]) => (
              <section key={label}>
                <h2 className="mb-4 text-2xl font-black">{label}</h2>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.map((stream) => {
                    const creatorName =
                      stream.profiles?.display_name ||
                      stream.profiles?.username ||
                      "Creator";

                    const reminderSet = reminders.includes(stream.id);
                    const isReminderLoading = reminderLoadingId === stream.id;

                    return (
                      <div
                        key={stream.id}
                        className="rounded-3xl border border-gray-800 bg-gray-900 p-5"
                      >
                        <div className="mb-4 flex items-center gap-3">
                          <Image
                            src={
                              stream.profiles?.avatar_url ||
                              "/default-avatar.png"
                            }
                            alt={creatorName}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-black">
                                {creatorName}
                              </p>

                              {stream.profiles?.is_verified && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold">
                                  ✓
                                </span>
                              )}
                            </div>

                            <p className="truncate text-sm text-gray-400">
                              @{stream.profiles?.username || "creator"}
                            </p>
                          </div>
                        </div>

                        <h3 className="text-xl font-black">{stream.title}</h3>

                        <p className="mt-2 text-sm font-bold text-red-400">
                          {stream.category}
                        </p>

                        {stream.description && (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-300">
                            {stream.description}
                          </p>
                        )}

                        <div className="mt-4 rounded-2xl bg-black/40 p-4">
                          <p className="text-sm text-gray-400">Starts at</p>

                          <p className="mt-1 font-black">
                            {new Date(stream.scheduled_start).toLocaleString(
                              [],
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }
                            )}
                          </p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            onClick={() =>
                              (window.location.href = `/profile/${stream.creator_id}`)
                            }
                            className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700"
                          >
                            Creator
                          </button>

                          <button
                            onClick={() => toggleReminder(stream.id)}
                            disabled={isReminderLoading}
                            className={
                              reminderSet
                                ? "rounded-xl bg-green-600 px-4 py-3 text-sm font-bold hover:bg-green-700 disabled:bg-gray-700"
                                : "rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
                            }
                          >
                            {isReminderLoading
                              ? "Saving..."
                              : reminderSet
                              ? "✓ Reminder Set"
                              : "🔔 Notify Me"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  followers: number | null;
  following: number | null;
  is_banned?: boolean | null;
};

type Stream = {
  id: string;
  title: string;
  category?: string | null;
  status: string;
  visibility?: "public" | "private";
  likes?: number | null;
  viewers?: number | null;
  total_views?: number | null;
  peak_viewers?: number | null;
  watch_minutes?: number | null;
  thumbnail_url?: string | null;
  created_at: string;
};

export default function CreatorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, followers, following, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    setProfile(profileData || null);

    const { data, error } = await supabase
      .from("streams")
      .select(
        "id, title, category, status, visibility, likes, viewers, total_views, peak_viewers, watch_minutes, thumbnail_url, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setStreams(data || []);
    setLoading(false);
  }

  const totals = useMemo(() => {
    const totalStreams = streams.length;
    const liveStreams = streams.filter((stream) => stream.status === "live").length;
    const publicStreams = streams.filter((stream) => stream.visibility !== "private").length;
    const privateStreams = streams.filter((stream) => stream.visibility === "private").length;

    const totalViews = streams.reduce(
      (sum, stream) => sum + (stream.total_views || stream.viewers || 0),
      0
    );

    const totalLikes = streams.reduce(
      (sum, stream) => sum + (stream.likes || 0),
      0
    );

    const peakViewers = streams.reduce(
      (max, stream) => Math.max(max, stream.peak_viewers || stream.viewers || 0),
      0
    );

    const watchMinutes = streams.reduce(
      (sum, stream) => sum + (stream.watch_minutes || 0),
      0
    );

    const averageViews = totalStreams > 0 ? Math.round(totalViews / totalStreams) : 0;
    const averageLikes = totalStreams > 0 ? Math.round(totalLikes / totalStreams) : 0;
    const averageWatchMinutes =
      totalStreams > 0 ? Math.round(watchMinutes / totalStreams) : 0;

    const engagementRate =
      totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;

    return {
      totalStreams,
      liveStreams,
      publicStreams,
      privateStreams,
      totalViews,
      totalLikes,
      peakViewers,
      watchMinutes,
      averageViews,
      averageLikes,
      averageWatchMinutes,
      engagementRate,
    };
  }, [streams]);

  const topStream = useMemo(() => {
    return [...streams].sort((a, b) => {
      const aScore =
        (a.total_views || a.viewers || 0) +
        (a.likes || 0) * 3 +
        (a.peak_viewers || 0) * 2 +
        (a.watch_minutes || 0);

      const bScore =
        (b.total_views || b.viewers || 0) +
        (b.likes || 0) * 3 +
        (b.peak_viewers || 0) * 2 +
        (b.watch_minutes || 0);

      return bScore - aScore;
    })[0];
  }, [streams]);

  const maxViews = Math.max(
    ...streams.map((stream) => stream.total_views || stream.viewers || 0),
    1
  );

  const creatorName =
    profile?.display_name || profile?.username || "Creator";

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400">
              Creator Analytics
            </p>

            <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
              {creatorName}'s <span className="text-red-500">Performance</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Track views, watch time, audience growth, stream performance, and engagement.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
            <button
              onClick={loadAnalytics}
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <Stat label="Streams" value={totals.totalStreams} />
          <Stat label="Live Now" value={totals.liveStreams} color="text-green-400" />
          <Stat label="Views" value={totals.totalViews} color="text-blue-400" />
          <Stat label="Likes" value={totals.totalLikes} color="text-red-400" />
          <Stat label="Peak" value={totals.peakViewers} color="text-purple-400" />
          <Stat label="Watch Min" value={totals.watchMinutes} color="text-yellow-400" />
          <Stat label="Followers" value={profile?.followers || 0} color="text-cyan-400" />
          <Stat label="Engage %" value={totals.engagementRate} color="text-pink-400" />
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Average Views</p>
            <h2 className="text-3xl font-black text-blue-400">
              {totals.averageViews}
            </h2>
            <p className="mt-2 text-sm text-gray-500">Per stream average</p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Average Likes</p>
            <h2 className="text-3xl font-black text-red-400">
              {totals.averageLikes}
            </h2>
            <p className="mt-2 text-sm text-gray-500">Per stream average</p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Average Watch Time</p>
            <h2 className="text-3xl font-black text-yellow-400">
              {totals.averageWatchMinutes}
            </h2>
            <p className="mt-2 text-sm text-gray-500">Minutes per stream</p>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:col-span-2">
            <h2 className="mb-5 text-2xl font-black">Growth Overview</h2>

            {streams.length === 0 ? (
              <p className="text-gray-400">No streams found yet.</p>
            ) : (
              <div className="space-y-4">
                {streams.slice(0, 10).map((stream) => {
                  const views = stream.total_views || stream.viewers || 0;
                  const width = Math.max(4, Math.round((views / maxViews) * 100));

                  return (
                    <div key={stream.id}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <p className="truncate text-sm font-bold">{stream.title}</p>
                        <p className="shrink-0 text-sm text-gray-400">{views} views</p>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full rounded-full bg-red-600"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-4 text-2xl font-black">Top Stream</h2>

            {topStream ? (
              <div>
                <div className="mb-4 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gray-800">
                  {topStream.thumbnail_url ? (
                    <img
                      src={topStream.thumbnail_url}
                      alt={topStream.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <h3 className="break-words text-xl font-black">
                  {topStream.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-400">
                  👀 {topStream.total_views || topStream.viewers || 0} views • ❤️{" "}
                  {topStream.likes || 0} likes • Peak{" "}
                  {topStream.peak_viewers || topStream.viewers || 0}
                </p>

                <Link
                  href={`/live/${topStream.id}`}
                  className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
                >
                  Open Studio
                </Link>
              </div>
            ) : (
              <p className="text-gray-400">No top stream yet.</p>
            )}
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Public Streams" value={totals.publicStreams} />
          <MiniStat label="Private Rooms" value={totals.privateStreams} />
          <MiniStat label="Following" value={profile?.following || 0} />
          <MiniStat label="Offline Streams" value={totals.totalStreams - totals.liveStreams} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">Stream Breakdown</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Visibility</th>
                  <th className="px-5 py-4">Views</th>
                  <th className="px-5 py-4">Peak</th>
                  <th className="px-5 py-4">Watch Min</th>
                  <th className="px-5 py-4">Likes</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {streams.map((stream) => (
                  <tr key={stream.id} className="border-t border-gray-800">
                    <td className="max-w-[280px] truncate px-5 py-4 font-bold">
                      {stream.title}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          stream.status === "live"
                            ? "rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400"
                            : "rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-400"
                        }
                      >
                        {stream.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-gray-300">
                      {stream.visibility || "public"}
                    </td>

                    <td className="px-5 py-4">
                      {stream.total_views || stream.viewers || 0}
                    </td>

                    <td className="px-5 py-4">
                      {stream.peak_viewers || stream.viewers || 0}
                    </td>

                    <td className="px-5 py-4">
                      {stream.watch_minutes || 0}
                    </td>

                    <td className="px-5 py-4">
                      {stream.likes || 0}
                    </td>

                    <td className="px-5 py-4 text-gray-400">
                      {new Date(stream.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {streams.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                      No streams created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <p className="mb-2 truncate text-xs text-gray-400 sm:text-sm">{label}</p>
      <h2 className={`break-words text-3xl font-black leading-none ${color}`}>
        {value}
      </h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="mb-2 text-xs text-gray-400 sm:text-sm">{label}</p>
      <h3 className="text-2xl font-black">{value}</h3>
    </div>
  );
}

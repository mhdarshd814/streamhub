"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number;
  following: number;
  is_verified?: boolean;
  is_banned?: boolean;
};

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private";
  likes: number;
  viewers: number;
  total_views?: number;
  peak_viewers?: number;
  watch_minutes?: number;
  thumbnail_url?: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, followers, following, is_verified, is_banned"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setStreams(data || []);
    setLoading(false);
  }

  async function deleteStream(id: string) {
    const confirmed = confirm("Are you sure you want to delete this stream?");
    if (!confirmed) return;

    const { error } = await supabase.from("streams").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setStreams((current) => current.filter((stream) => stream.id !== id));
    alert("Stream deleted successfully.");
  }

  function openLiveRoom(id: string) {
    window.location.href = `/live/${id}`;
  }

  function editStream(id: string) {
    window.location.href = `/stream/edit/${id}`;
  }

  function openWatch(stream: Stream) {
    if (stream.visibility === "private") {
      alert("Private video calls cannot be watched publicly.");
      return;
    }

    if (stream.status !== "live") {
      alert("This stream is currently offline.");
      return;
    }

    window.location.href = `/watch/${stream.id}`;
  }

  const creatorName = profile?.display_name || profile?.username || "Creator";

  const totalLikes = streams.reduce(
    (total, stream) => total + (stream.likes || 0),
    0
  );

  const totalViews = streams.reduce(
    (total, stream) => total + (stream.total_views || stream.viewers || 0),
    0
  );

  const totalWatchMinutes = streams.reduce(
    (total, stream) => total + (stream.watch_minutes || 0),
    0
  );

  const peakViewers = streams.reduce(
    (max, stream) =>
      Math.max(max, stream.peak_viewers || stream.viewers || 0),
    0
  );

  const liveStreams = streams.filter(
    (stream) => stream.status === "live"
  ).length;

  const offlineStreams = streams.filter(
    (stream) => stream.status !== "live"
  ).length;

  const publicStreams = streams.filter(
    (stream) => stream.visibility !== "private"
  ).length;

  const privateStreams = streams.filter(
    (stream) => stream.visibility === "private"
  ).length;

  const averageLikes =
    streams.length > 0 ? Math.round(totalLikes / streams.length) : 0;

  const averageViews =
    streams.length > 0 ? Math.round(totalViews / streams.length) : 0;

  const averageWatchMinutes =
    streams.length > 0 ? Math.round(totalWatchMinutes / streams.length) : 0;

  const engagementScore =
    totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;

  const topStream = [...streams].sort((a, b) => {
    const aScore =
      (a.likes || 0) +
      (a.total_views || a.viewers || 0) +
      (a.peak_viewers || 0);

    const bScore =
      (b.likes || 0) +
      (b.total_views || b.viewers || 0) +
      (b.peak_viewers || 0);

    return bScore - aScore;
  })[0];

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
              Creator Command Center
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="break-words text-3xl font-black sm:text-4xl lg:text-5xl">
                Welcome back,{" "}
                <span className="text-red-500">{creatorName}</span>
              </h1>

              {profile?.is_verified && (
                <span className="w-fit rounded-full bg-blue-600 px-4 py-2 text-xs font-black sm:text-sm">
                  ✓ Verified Creator
                </span>
              )}
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
              Track performance, manage streams, monitor audience growth, and
              run your creator business.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={loadDashboard}
              className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:py-4 sm:text-base"
            >
              Refresh
            </button>

            <button
              onClick={() => {
                window.location.href = "/go-live";
              }}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700 sm:px-6 sm:py-4 sm:text-base"
            >
              + Create
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-10 lg:grid-cols-4 lg:gap-5">
          <button
            onClick={() => (window.location.href = "/go-live")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">🎥</div>
            <h2 className="mb-2 text-base font-bold sm:text-xl">
              Create Stream
            </h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Start a live or private room.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/explore")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">🔍</div>
            <h2 className="mb-2 text-base font-bold sm:text-xl">Explore</h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Discover creators.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/following")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">⭐</div>
            <h2 className="mb-2 text-base font-bold">Following</h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Your creator feed.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/notifications")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">🔔</div>
            <h2 className="mb-2 text-base font-bold">
              Notifications
            </h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Activity alerts.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/verification")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">✅</div>
            <h2 className="mb-2 text-base font-bold">
              Verification
            </h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Request creator badge.
            </p>
          </button>
<button
  onClick={() => (window.location.href = "/analytics")}
  className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
>
  <div className="mb-3 text-2xl">📈</div>
  <h2 className="mb-2 text-base font-bold">
    Analytics
  </h2>
  <p className="text-xs text-gray-400 sm:text-sm">
    Views, growth and performance.
  </p>
</button>

<button
  onClick={() => (window.location.href = "/wallet")}
  className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
>
  <div className="mb-3 text-2xl">💰</div>

  <h2 className="mb-2 text-base font-bold">
    Wallet
  </h2>

  <p className="text-xs text-gray-400 sm:text-sm">
    Earnings, tips and payout requests.
  </p>
</button>

          <button
            onClick={() => (window.location.href = "/profile/edit")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
          >
            <div className="mb-3 text-2xl">⚙️</div>
            <h2 className="mb-2 text-base font-bold">Settings</h2>
            <p className="text-xs text-gray-400 sm:text-sm">
              Edit your profile.
            </p>
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Total Streams</p>
            <h2 className="text-3xl font-black sm:text-4xl">
              {streams.length}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              {publicStreams} public • {privateStreams} private
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Total Views</p>
            <h2 className="text-3xl font-black text-purple-400 sm:text-4xl">
              {totalViews}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              Avg {averageViews} per stream
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Total Likes</p>
            <h2 className="text-3xl font-black text-red-500 sm:text-4xl">
              {totalLikes}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              Avg {averageLikes} per stream
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Followers</p>
            <h2 className="text-3xl font-black text-green-500 sm:text-4xl">
              {profile?.followers || 0}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              Following {profile?.following || 0}
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Live Now</p>
            <h2 className="text-2xl font-black text-green-500 sm:text-3xl">
              {liveStreams}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Offline Streams</p>
            <h2 className="text-2xl font-black text-gray-400 sm:text-3xl">
              {offlineStreams}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Peak Viewers</p>
            <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">
              {peakViewers}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Engagement Rate</p>
            <h2 className="text-2xl font-black text-blue-400 sm:text-3xl">
              {engagementScore}%
            </h2>
          </div>
        </div>

        <div className="mb-8 grid gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-3 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Watch Minutes</p>
            <h2 className="text-3xl font-black sm:text-4xl">
              {totalWatchMinutes}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              Avg {averageWatchMinutes} min per stream
            </p>
          </div>

          <button
            onClick={() => (window.location.href = "/verification")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-6 lg:p-7"
          >
            <p className="mb-2 text-sm text-gray-400">Creator Status</p>
            <h2
              className={
                profile?.is_verified
                  ? "text-3xl font-black text-blue-400 sm:text-4xl"
                  : "text-3xl font-black text-gray-400 sm:text-4xl"
              }
            >
              {profile?.is_verified ? "Verified" : "Standard"}
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              {profile?.is_verified
                ? "Your badge is active."
                : "Tap to request verification."}
            </p>
          </button>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
            <p className="mb-2 text-sm text-gray-400">Revenue</p>
            <h2 className="text-3xl font-black text-gray-500 sm:text-4xl">
              AED 0
            </h2>
            <p className="mt-2 text-xs text-gray-500 sm:text-sm">
              Donations and subscriptions coming later.
            </p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:mb-10 lg:p-7">
          <div className="mb-5">
            <h2 className="text-2xl font-black sm:text-3xl">
              Top Performing Stream
            </h2>
            <p className="mt-1 text-sm text-gray-400 sm:text-base">
              Ranked by likes, views and peak viewers.
            </p>
          </div>

          {topStream ? (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-800 sm:h-24 sm:w-36 sm:shrink-0">
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

                <div className="min-w-0">
                  <h3 className="break-words text-xl font-black sm:text-2xl">
                    {topStream.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-400 sm:text-base">
                    {topStream.category} • ❤️ {topStream.likes || 0} • 👀{" "}
                    {topStream.total_views || topStream.viewers || 0} • Peak{" "}
                    {topStream.peak_viewers || topStream.viewers || 0}
                  </p>

                  <p
                    className={
                      topStream.status === "live"
                        ? "mt-1 font-bold text-green-500"
                        : "mt-1 font-bold text-gray-500"
                    }
                  >
                    {topStream.status === "live" ? "● Live Now" : "Offline"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openLiveRoom(topStream.id)}
                className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
              >
                Open Studio
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 sm:text-base">
              No performance data yet. Create your first stream to start
              tracking analytics.
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex flex-col gap-4 border-b border-gray-800 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">
                Stream Library
              </h2>
              <p className="mt-1 text-sm text-gray-400 sm:text-base">
                Manage every stream, monitor performance and reopen your studio.
              </p>
            </div>

            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
            >
              New Stream
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center sm:p-10">
              <p className="text-gray-400">Loading analytics...</p>
            </div>
          ) : streams.length === 0 ? (
            <div className="p-8 text-center sm:p-10">
              <p className="mb-4 text-5xl">🎬</p>
              <h3 className="mb-2 text-2xl font-bold">
                No streams created yet
              </h3>
              <p className="mb-6 text-gray-400">
                Create your first stream room and start building your audience.
              </p>

              <button
                onClick={() => (window.location.href = "/go-live")}
                className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
              >
                Create Stream
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {streams.map((stream) => {
                const isLive = stream.status === "live";
                const isPrivate = stream.visibility === "private";

                return (
                  <div
                    key={stream.id}
                    className="flex flex-col gap-5 p-4 transition hover:bg-gray-800/50 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-800 sm:h-20 sm:w-28 sm:shrink-0">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-500">No Image</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              isLive
                                ? "rounded-full bg-red-600 px-3 py-1 text-xs font-black"
                                : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400"
                            }
                          >
                            {isLive ? "LIVE" : "OFFLINE"}
                          </span>

                          <span
                            className={
                              isPrivate
                                ? "rounded-full bg-purple-600 px-3 py-1 text-xs font-black"
                                : "rounded-full bg-green-600 px-3 py-1 text-xs font-black"
                            }
                          >
                            {isPrivate ? "PRIVATE" : "PUBLIC"}
                          </span>
                        </div>

                        <h3 className="break-words text-lg font-bold sm:text-xl">
                          {stream.title}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category} • ❤️ {stream.likes || 0} • 👀{" "}
                          {stream.total_views || stream.viewers || 0} • Peak{" "}
                          {stream.peak_viewers || stream.viewers || 0} • ⏱️{" "}
                          {stream.watch_minutes || 0} min
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Created {new Date(stream.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                      <button
                        onClick={() => openLiveRoom(stream.id)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700"
                      >
                        Studio
                      </button>

                      {!isPrivate && (
                        <button
                          onClick={() => openWatch(stream)}
                          disabled={!isLive}
                          className={
                            isLive
                              ? "rounded-lg bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-700"
                              : "cursor-not-allowed rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-gray-500"
                          }
                        >
                          Watch
                        </button>
                      )}

                      <button
                        onClick={() => editStream(stream.id)}
                        className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-bold hover:bg-gray-600"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteStream(stream.id)}
                        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
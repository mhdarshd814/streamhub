"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers?: number | null;
  is_verified?: boolean | null;
};

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  viewers: number | null;
  likes: number | null;
  total_views?: number | null;
  peak_viewers?: number | null;
  watch_minutes?: number | null;
  thumbnail_url: string | null;
  created_at: string;
  profile?: Profile | null;
};

type FollowRow = {
  following_id: string;
};

export default function FollowingPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [recommendedStreams, setRecommendedStreams] = useState<Stream[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFollowingStreams();
  }, []);

  async function loadFollowingStreams() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileCheck?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    const { data: follows, error: followError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (followError) {
      alert(followError.message);
      setLoading(false);
      return;
    }

    const followedIds = ((follows || []) as FollowRow[]).map(
      (item) => item.following_id
    );

    setFollowingIds(followedIds);

    if (followedIds.length > 0) {
      const { data: streamData, error: streamError } = await supabase
        .from("streams")
        .select("*")
        .in("user_id", followedIds)
        .neq("visibility", "private")
        .order("created_at", { ascending: false });

      if (streamError) {
        alert(streamError.message);
        setLoading(false);
        return;
      }

      const streamsWithProfiles = await attachProfiles(streamData || []);
      setStreams(streamsWithProfiles);
    } else {
      setStreams([]);
    }

    const { data: exploreData } = await supabase
      .from("streams")
      .select("*")
      .neq("visibility", "private")
      .order("created_at", { ascending: false })
      .limit(40);

    const recommended = await attachProfiles(exploreData || []);

    setRecommendedStreams(
      recommended
        .filter((stream) => !followedIds.includes(stream.user_id))
        .sort((a, b) => getStreamScore(b) - getStreamScore(a))
        .slice(0, 6)
    );

    setLoading(false);
  }

  async function attachProfiles(streamData: any[]): Promise<Stream[]> {
    return Promise.all(
      streamData.map(async (stream) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, followers, is_verified")
          .eq("id", stream.user_id)
          .maybeSingle();

        return {
          ...stream,
          profile: profileData,
        } as Stream;
      })
    );
  }

  function openStream(stream: Stream) {
    if (stream.visibility === "private") {
      alert("This is a private video call and cannot be watched publicly.");
      return;
    }

    if (stream.status !== "live") {
      alert("This stream is currently offline.");
      return;
    }

    window.location.href = `/watch/${stream.id}`;
  }

  function openProfile(profileId?: string) {
    if (!profileId) {
      alert("Streamer profile not found.");
      return;
    }

    window.location.href = `/profile/${profileId}`;
  }

  const personalizedStreams = useMemo(() => {
    return [...streams].sort((a, b) => getStreamScore(b) - getStreamScore(a));
  }, [streams]);

  const liveCount = streams.filter((stream) => stream.status === "live").length;

  const subscriberOnlyCount = streams.filter(
    (stream) => stream.visibility === "subscribers"
  ).length;

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();

    streams.forEach((stream) => {
      map.set(stream.category, (map.get(stream.category) || 0) + 1);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [streams]);

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 lg:mb-10">
          <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
            Personalized Feed
          </p>

          <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
            Following <span className="text-red-500">Streams</span>
          </h1>

          <p className="max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
            Ranked feed from creators you follow, plus recommendations when your feed is empty.
          </p>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-10 lg:gap-6">
          <Stat label="Followed Streams" value={streams.length} />
          <Stat label="Live Now" value={liveCount} color="text-green-500" />
          <Stat label="Subscriber Streams" value={subscriberOnlyCount} color="text-yellow-300" />
        </div>

        <div className="mb-7 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 sm:p-5 lg:mb-8">
          <h2 className="mb-2 text-lg font-black text-yellow-300 sm:text-xl">
            Personalized ranking active
          </h2>

          <p className="text-sm leading-6 text-gray-400">
            Live streams, stronger engagement, recent activity and followed creators are pushed higher.
            Private calls stay hidden. Subscriber streams stay protected.
          </p>
        </div>

        {topCategories.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-black sm:text-3xl">
              Your Category Rankings
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topCategories.map(([category, count], index) => (
                <div
                  key={category}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-4"
                >
                  <p className="mb-2 text-sm text-gray-400">#{index + 1}</p>
                  <h3 className="break-words text-xl font-black">{category}</h3>
                  <p className="mt-2 text-sm text-gray-500">{count} stream(s)</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-black sm:text-3xl">Your Feed</h2>

          <button
            onClick={() => {
              window.location.href = "/explore";
            }}
            className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
          >
            Find Creators
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
            <p className="text-gray-400">Loading following feed...</p>
          </div>
        ) : personalizedStreams.length === 0 ? (
          <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
            <p className="mb-5 text-6xl">⭐</p>

            <h2 className="mb-3 text-2xl font-black sm:text-3xl">
              No followed streams yet
            </h2>

            <p className="mx-auto mb-8 max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
              Follow creators from Explore to build your personalized feed.
            </p>

            <button
              onClick={() => {
                window.location.href = "/explore";
              }}
              className="rounded-xl bg-red-600 px-7 py-4 font-bold hover:bg-red-700"
            >
              Explore Creators
            </button>
          </div>
        ) : (
          <StreamGrid
            streams={personalizedStreams}
            openStream={openStream}
            openProfile={openProfile}
          />
        )}

        {recommendedStreams.length > 0 && (
          <section className="mt-10">
            <div className="mb-5">
              <h2 className="text-2xl font-black sm:text-3xl">
                Recommended For You
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Creators you do not follow yet, ranked by activity and engagement.
              </p>
            </div>

            <StreamGrid
              streams={recommendedStreams}
              openStream={openStream}
              openProfile={openProfile}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function StreamGrid({
  streams,
  openStream,
  openProfile,
}: {
  streams: Stream[];
  openStream: (stream: Stream) => void;
  openProfile: (profileId?: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {streams.map((stream) => (
        <StreamCard
          key={stream.id}
          stream={stream}
          openStream={openStream}
          openProfile={openProfile}
        />
      ))}
    </div>
  );
}

function StreamCard({
  stream,
  openStream,
  openProfile,
}: {
  stream: Stream;
  openStream: (stream: Stream) => void;
  openProfile: (profileId?: string) => void;
}) {
  const isLive = stream.status === "live";
  const isSubscriberOnly = stream.visibility === "subscribers";

  return (
    <div
      className={
        isLive
          ? "overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition hover:border-red-600"
          : "overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 opacity-70"
      }
    >
      <div
        onClick={() => openStream(stream)}
        className={
          isLive
            ? "relative h-48 cursor-pointer overflow-hidden bg-gray-800 sm:h-52 lg:h-56"
            : "relative h-48 cursor-not-allowed overflow-hidden bg-gray-800 sm:h-52 lg:h-56"
        }
      >
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-3 text-5xl">{isSubscriberOnly ? "⭐" : "📺"}</p>
              <p className="text-sm text-gray-400">No Thumbnail</p>
            </div>
          </div>
        )}

        {isLive ? (
          <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black shadow-lg shadow-red-600/30 sm:left-4 sm:top-4 sm:px-4 sm:text-sm">
            LIVE
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="rounded-xl bg-gray-800 px-5 py-2 font-bold text-gray-300">
              Offline
            </span>
          </div>
        )}

        <div
          className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold sm:right-4 sm:top-4 ${
            isSubscriberOnly
              ? "border border-yellow-500/30 bg-yellow-500/20 text-yellow-300"
              : "border border-white/10 bg-black/70 text-white"
          }`}
        >
          {isSubscriberOnly ? "⭐ Subscribers" : "🌍 Public"}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div
          onClick={() => openProfile(stream.profile?.id)}
          className="mb-5 flex cursor-pointer items-center gap-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700">
            {stream.profile?.avatar_url ? (
              <img
                src={stream.profile.avatar_url}
                alt={stream.profile.username || "creator"}
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate font-bold text-white">
              {stream.profile?.display_name ||
                stream.profile?.username ||
                "Unknown Streamer"}
            </p>

            <p className="truncate text-sm text-gray-400">
              @{stream.profile?.username || "unknown"}
            </p>
          </div>
        </div>

        <h3
          onClick={() => openStream(stream)}
          className={
            isLive
              ? "mb-2 cursor-pointer break-words text-xl font-black transition hover:text-red-400 sm:text-2xl"
              : "mb-2 cursor-not-allowed break-words text-xl font-black text-gray-400 sm:text-2xl"
          }
        >
          {stream.title}
        </h3>

        <div className="mb-4">
          <p className="text-sm text-gray-400 sm:text-base">{stream.category}</p>

          {isSubscriberOnly && (
            <p className="mt-1 text-xs font-bold text-yellow-300">
              Subscriber-only stream
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className={isLive ? "font-bold text-green-500" : "font-bold text-gray-500"}>
            {isLive ? "● Live Now" : "Offline"}
          </span>

          <div className="flex gap-4 text-sm text-gray-400 sm:text-base">
            <span>👀 {stream.viewers || 0}</span>
            <span>❤️ {stream.likes || 0}</span>
          </div>
        </div>

        <button
          onClick={() => openStream(stream)}
          disabled={!isLive}
          className={
            isLive
              ? isSubscriberOnly
                ? "mt-5 w-full rounded-xl bg-yellow-500 py-3 font-bold text-black hover:bg-yellow-400"
                : "mt-5 w-full rounded-xl bg-red-600 py-3 font-bold hover:bg-red-700"
              : "mt-5 w-full cursor-not-allowed rounded-xl bg-gray-800 py-3 font-bold text-gray-500"
          }
        >
          {isLive ? (isSubscriberOnly ? "Subscribe to Watch" : "Watch Now") : "Offline"}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black sm:text-4xl ${color}`}>{value}</h2>
    </div>
  );
}

function getStreamScore(stream: Stream) {
  const liveBoost = stream.status === "live" ? 10000 : 0;
  const recentBoost = getRecentBoost(stream.created_at);

  return (
    liveBoost +
    recentBoost +
    Number(stream.viewers || 0) * 25 +
    Number(stream.likes || 0) * 10 +
    Number(stream.total_views || 0) * 3 +
    Number(stream.peak_viewers || 0) * 8 +
    Number(stream.watch_minutes || 0)
  );
}

function getRecentBoost(value: string) {
  const age = Date.now() - new Date(value).getTime();
  const hours = age / (1000 * 60 * 60);

  if (hours <= 24) return 1000;
  if (hours <= 72) return 500;
  if (hours <= 168) return 250;

  return 0;
}
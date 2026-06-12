"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers";
  viewers: number;
  likes: number;
  thumbnail_url: string | null;
  created_at: string;
  profile?: Profile | null;
};

export default function ExplorePage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    loadStreams();
  }, []);

  async function loadStreams() {
    const { data: streamData, error: streamError } = await supabase
      .from("streams")
      .select("*")
      .neq("visibility", "private")
      .order("created_at", { ascending: false });

    if (streamError) {
      alert(streamError.message);
      return;
    }

    const streamsWithProfiles = await Promise.all(
      (streamData || []).map(async (stream) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", stream.user_id)
          .maybeSingle();

        return {
          ...stream,
          profile: profileData,
        };
      })
    );

    setStreams(streamsWithProfiles);
  }

  const filteredStreams = streams.filter((stream) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      stream.title.toLowerCase().includes(searchText) ||
      stream.category.toLowerCase().includes(searchText) ||
      stream.profile?.username?.toLowerCase().includes(searchText) ||
      stream.profile?.display_name?.toLowerCase().includes(searchText);

    const matchesCategory = category === "All" || stream.category === category;

    const matchesStatus =
      status === "All" ||
      (status === "Live" && stream.status === "live") ||
      (status === "Offline" && stream.status !== "live");

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const liveCount = streams.filter((stream) => stream.status === "live").length;

  const subscriberOnlyCount = streams.filter(
    (stream) => stream.visibility === "subscribers"
  ).length;

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

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 lg:mb-10">
          <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
            Discover Creators
          </p>

          <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
            Explore <span className="text-red-500">Live Streams</span>
          </h1>

          <p className="max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
            Search public and subscriber-only streams, discover creators, and
            join live rooms.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-8 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Visible Streams</p>
            <h2 className="text-3xl font-black sm:text-4xl">
              {streams.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Live Now</p>
            <h2 className="text-3xl font-black text-green-500 sm:text-4xl">
              {liveCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Subscriber Streams</p>
            <h2 className="text-3xl font-black text-yellow-300 sm:text-4xl">
              {subscriberOnlyCount}
            </h2>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:mb-8">
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search streams or creators..."
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-red-500 sm:p-4 sm:text-base"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none focus:border-red-500 sm:p-4 sm:text-base"
            >
              <option value="All">All Categories</option>
              <option value="Gaming">Gaming</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Music">Music</option>
              <option value="Sports">Sports</option>
              <option value="Education">Education</option>
              <option value="Technology">Technology</option>
              <option value="Travel">Travel</option>
              <option value="Food">Food</option>
              <option value="Lifestyle">Lifestyle</option>
              <option value="News">News</option>
              <option value="Podcast">Podcast</option>
              <option value="Kids">Kids</option>
              <option value="Subscribers Only">Subscribers Only</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-white outline-none focus:border-red-500 sm:p-4 sm:text-base"
            >
              <option value="All">All Visible Streams</option>
              <option value="Live">Live Only</option>
              <option value="Offline">Offline Only</option>
            </select>
          </div>

          <p className="mt-4 text-xs leading-5 text-gray-500 sm:text-sm">
            Private video calls are hidden. Subscriber-only streams are visible,
            but watching is protected by subscription access.
          </p>
        </div>

        <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-black sm:text-3xl">
            Available Streams
          </h2>

          <p className="text-sm text-gray-400 sm:text-base">
            Showing {filteredStreams.length} stream(s)
          </p>
        </div>

        {filteredStreams.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
            <p className="mb-4 text-5xl">🔍</p>

            <h3 className="mb-2 text-2xl font-bold">No streams found</h3>

            <p className="text-sm text-gray-400 sm:text-base">
              Try changing the search, category, or stream status filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {filteredStreams.map((stream) => {
              const isLive = stream.status === "live";
              const isSubscriberOnly = stream.visibility === "subscribers";

              return (
                <div
                  key={stream.id}
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
                          <p className="mb-3 text-5xl">
                            {isSubscriberOnly ? "⭐" : "📺"}
                          </p>
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
                            alt={stream.profile.username}
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
                      <p className="text-sm text-gray-400 sm:text-base">
                        {stream.category}
                      </p>

                      {isSubscriberOnly && (
                        <p className="mt-1 text-xs font-bold text-yellow-300">
                          Subscriber-only stream
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span
                        className={
                          isLive
                            ? "font-bold text-green-500"
                            : "font-bold text-gray-500"
                        }
                      >
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
                      {isLive
                        ? isSubscriberOnly
                          ? "Subscribe to Watch"
                          : "Watch Now"
                        : "Offline"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
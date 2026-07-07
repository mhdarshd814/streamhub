"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

type CategoryRank = {
  category: string;
  streams: number;
  live: number;
  viewers: number;
  likes: number;
  score: number;
};

export default function ExplorePage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Profile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadDiscovery();
  }, []);

  // People search: server-side profile lookup, debounced while typing.
  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) {
      setPeople([]);
      return;
    }

    const timer = setTimeout(() => {
      searchPeople(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  async function searchPeople(query: string) {
    setPeopleLoading(true);

    const safe = query.replace(/[%_,]/g, "");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, followers, is_verified")
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .order("followers", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("People search failed:", error.message);
      setPeopleLoading(false);
      return;
    }

    setPeople(
      ((data || []) as Profile[]).filter((p) => p.id !== currentUserId)
    );
    setPeopleLoading(false);
  }

  // Same follow behavior as the profile page: insert/delete on follows,
  // optimistic local counts, no direct write to profiles.followers.
  async function toggleFollowUser(target: Profile) {
    if (!currentUserId || target.id === currentUserId) return;

    setFollowBusyId(target.id);

    const alreadyFollowing = followingIds.includes(target.id);

    if (alreadyFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", target.id);

      if (error) {
        alert(error.message);
        setFollowBusyId(null);
        return;
      }

      setFollowingIds((ids) => ids.filter((id) => id !== target.id));
      setPeople((list) =>
        list.map((p) =>
          p.id === target.id
            ? { ...p, followers: Math.max(Number(p.followers || 0) - 1, 0) }
            : p
        )
      );
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: target.id,
      });

      if (error) {
        alert(error.message);
        setFollowBusyId(null);
        return;
      }

      setFollowingIds((ids) => [...ids, target.id]);
      setPeople((list) =>
        list.map((p) =>
          p.id === target.id
            ? { ...p, followers: Number(p.followers || 0) + 1 }
            : p
        )
      );
    }

    setFollowBusyId(null);
  }

  async function loadDiscovery() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    let followedCreators: string[] = [];

    if (user) {
      const { data: followsData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      followedCreators = ((followsData || []) as FollowRow[]).map(
        (item) => item.following_id
      );

      setFollowingIds(followedCreators);
    }

    const { data: streamData, error: streamError } = await supabase
      .from("streams")
      .select("*")
      .neq("visibility", "private")
      .order("created_at", { ascending: false });

    if (streamError) {
      alert(streamError.message);
      setLoading(false);
      return;
    }

    const streamsWithProfiles = await Promise.all(
      (streamData || []).map(async (stream) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, followers, is_verified")
          .eq("id", stream.user_id)
          .maybeSingle();

        return {
          ...stream,
          profile: profileData,
        };
      })
    );

    setStreams(streamsWithProfiles as Stream[]);

    const { data: creatorData } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, followers, is_verified")
      .order("followers", { ascending: false })
      .limit(30);

    setCreators((creatorData || []) as Profile[]);
    setLoading(false);
  }

  const filteredStreams = useMemo(() => {
    return streams.filter((stream) => {
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
  }, [streams, search, category, status]);

  const liveCount = streams.filter((stream) => stream.status === "live").length;

  const subscriberOnlyCount = streams.filter(
    (stream) => stream.visibility === "subscribers"
  ).length;

  const trendingStreams = useMemo(() => {
    return [...streams]
      .sort((a, b) => getStreamScore(b) - getStreamScore(a))
      .slice(0, 6);
  }, [streams]);

  const recommendedCreators = useMemo(() => {
    const activeCreatorIds = new Set(streams.map((stream) => stream.user_id));

    return creators
      .filter((creator) => creator.id !== currentUserId)
      .filter((creator) => !followingIds.includes(creator.id))
      .sort((a, b) => {
        const aActive = activeCreatorIds.has(a.id) ? 1000 : 0;
        const bActive = activeCreatorIds.has(b.id) ? 1000 : 0;

        return (
          bActive +
          Number(b.followers || 0) +
          (b.is_verified ? 500 : 0) -
          (aActive + Number(a.followers || 0) + (a.is_verified ? 500 : 0))
        );
      })
      .slice(0, 6);
  }, [creators, streams, currentUserId, followingIds]);

  const personalizedFeed = useMemo(() => {
    if (followingIds.length === 0) return trendingStreams;

    const followedStreams = streams.filter((stream) =>
      followingIds.includes(stream.user_id)
    );

    const categoryPreference = getPreferredCategories(followedStreams);

    return [...streams]
      .sort((a, b) => {
        const aFollowed = followingIds.includes(a.user_id) ? 5000 : 0;
        const bFollowed = followingIds.includes(b.user_id) ? 5000 : 0;
        const aCategory = categoryPreference.includes(a.category) ? 1500 : 0;
        const bCategory = categoryPreference.includes(b.category) ? 1500 : 0;

        return (
          bFollowed +
          bCategory +
          getStreamScore(b) -
          (aFollowed + aCategory + getStreamScore(a))
        );
      })
      .slice(0, 6);
  }, [streams, followingIds, trendingStreams]);

  const categoryRankings = useMemo(() => {
    const map = new Map<string, CategoryRank>();

    streams.forEach((stream) => {
      const existing = map.get(stream.category) || {
        category: stream.category,
        streams: 0,
        live: 0,
        viewers: 0,
        likes: 0,
        score: 0,
      };

      existing.streams += 1;
      existing.live += stream.status === "live" ? 1 : 0;
      existing.viewers += Number(stream.viewers || 0);
      existing.likes += Number(stream.likes || 0);
      existing.score += getStreamScore(stream);

      map.set(stream.category, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [streams]);

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
            Discovery Engine
          </p>

          <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
            Discover <span className="text-red-500">Streams</span>
          </h1>

          <p className="max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
            Find live streams now or check upcoming scheduled streams.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20"
            >
              Live Streams
            </button>

            <button
              type="button"
              onClick={() => (window.location.href = "/streams/upcoming")}
              className="rounded-xl border border-gray-800 bg-gray-900 px-5 py-3 text-sm font-black text-white hover:border-red-600 hover:bg-gray-800"
            >
              Upcoming Streams
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-8 lg:gap-6">
          <Stat label="Visible Streams" value={streams.length} />
          <Stat label="Live Now" value={liveCount} color="text-green-500" />
          <Stat label="Subscriber Streams" value={subscriberOnlyCount} color="text-yellow-300" />
        </div>

        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
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
              {Array.from(new Set(streams.map((stream) => stream.category))).map(
                (item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                )
              )}
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
            Private video calls are hidden. Subscriber-only streams are visible, but watching remains protected.
          </p>
        </div>

        {search.trim().length >= 2 && (
          <section className="mb-8">
            <div className="mb-5">
              <h2 className="text-2xl font-black sm:text-3xl">People</h2>
              <p className="mt-1 text-sm text-gray-400">
                Find users to view their profile and follow.
              </p>
            </div>

            {peopleLoading ? (
              <EmptyState text="Searching people..." />
            ) : people.length === 0 ? (
              <EmptyState text="No users match this search." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-gray-800 bg-gray-900 p-5 transition hover:border-red-600"
                  >
                    <button
                      onClick={() => openProfile(person.id)}
                      className="mb-4 flex w-full items-center gap-4 text-left"
                    >
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700">
                        {person.avatar_url ? (
                          <Image
                            src={person.avatar_url}
                            alt={person.username || "user"}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          "👤"
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-lg font-black">
                          {person.display_name || person.username || "User"}
                        </p>
                        <p className="truncate text-sm text-gray-400">
                          @{person.username || "user"}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-400">
                        {person.followers || 0} followers
                        {person.is_verified && (
                          <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">
                            Verified
                          </span>
                        )}
                      </span>

                      {currentUserId && (
                        <button
                          onClick={() => toggleFollowUser(person)}
                          disabled={followBusyId === person.id}
                          className={
                            followingIds.includes(person.id)
                              ? "rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-black text-gray-300 active:scale-95 disabled:opacity-50"
                              : "rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white active:scale-95 disabled:opacity-50"
                          }
                        >
                          {followBusyId === person.id
                            ? "..."
                            : followingIds.includes(person.id)
                            ? "Following"
                            : "Follow"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
            Loading discovery engine...
          </div>
        ) : (
          <>
            <DiscoverySection
              title="Trending Streams"
              note="Ranked by live status, viewers, likes, watch minutes and recent activity."
              streams={trendingStreams}
              openStream={openStream}
              openProfile={openProfile}
            />

            <section className="mb-8">
              <div className="mb-5">
                <h2 className="text-2xl font-black sm:text-3xl">
                  Recommended Creators
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Based on followers, verification and creator activity.
                </p>
              </div>

              {recommendedCreators.length === 0 ? (
                <EmptyState text="No recommended creators yet." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendedCreators.map((creator) => (
                    <button
                      key={creator.id}
                      onClick={() => openProfile(creator.id)}
                      className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-red-600"
                    >
                      <div className="mb-4 flex items-center gap-4">
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700">
                          {creator.avatar_url ? (
                            <Image
                              src={creator.avatar_url}
                              alt={creator.username || "creator"}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            "👤"
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-black">
                            {creator.display_name || creator.username || "Creator"}
                          </p>
                          <p className="truncate text-sm text-gray-400">
                            @{creator.username || "creator"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
                        <span>{creator.followers || 0} followers</span>
                        {creator.is_verified && (
                          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                            Verified
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <DiscoverySection
              title="Personalized Feed"
              note={
                followingIds.length > 0
                  ? "Prioritizes followed creators and categories you already watch."
                  : "Follow creators to make this feed truly personalized."
              }
              streams={personalizedFeed}
              openStream={openStream}
              openProfile={openProfile}
            />

            <section className="mb-8">
              <div className="mb-5">
                <h2 className="text-2xl font-black sm:text-3xl">
                  Category Rankings
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Ranked by stream count, live activity, viewers and likes.
                </p>
              </div>

              {categoryRankings.length === 0 ? (
                <EmptyState text="No category data yet." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {categoryRankings.map((item, index) => (
                    <button
                      key={item.category}
                      onClick={() => setCategory(item.category)}
                      className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-red-600"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="rounded-xl bg-red-600 px-3 py-1 text-sm font-black">
                          #{index + 1}
                        </span>
                        <span className="text-sm text-gray-400">
                          Score {item.score}
                        </span>
                      </div>

                      <h3 className="mb-3 break-words text-xl font-black">
                        {item.category}
                      </h3>

                      <p className="text-sm leading-6 text-gray-400">
                        {item.streams} streams • {item.live} live • 👀 {item.viewers} • ❤️ {item.likes}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black sm:text-3xl">
                Available Streams
              </h2>

              <p className="text-sm text-gray-400 sm:text-base">
                Showing {filteredStreams.length} stream(s)
              </p>
            </div>

            {filteredStreams.length === 0 ? (
              <EmptyState text="No streams found. Try changing search or filters." />
            ) : (
              <StreamGrid
                streams={filteredStreams}
                openStream={openStream}
                openProfile={openProfile}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiscoverySection({
  title,
  note,
  streams,
  openStream,
  openProfile,
}: {
  title: string;
  note: string;
  streams: Stream[];
  openStream: (stream: Stream) => void;
  openProfile: (profileId?: string) => void;
}) {
  return (
    <section className="mb-8">
      <div className="mb-5">
        <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{note}</p>
      </div>

      {streams.length === 0 ? (
        <EmptyState text="No streams available yet." />
      ) : (
        <StreamGrid streams={streams} openStream={openStream} openProfile={openProfile} />
      )}
    </section>
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
          ? "overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition-all duration-150 hover:border-red-600 hover:-translate-y-0.5 active:scale-[0.98]"
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
          <Image
            src={stream.thumbnail_url}
            alt={stream.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
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
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700">
            {stream.profile?.avatar_url ? (
              <Image
                src={stream.profile.avatar_url}
                alt={stream.profile.username || "creator"}
                fill
                sizes="44px"
                className="object-cover"
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
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black sm:text-4xl ${color}`}>{value}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
      <p className="mb-4 text-5xl">🔍</p>
      <h3 className="mb-2 text-2xl font-bold">Nothing here yet</h3>
      <p className="text-sm text-gray-400 sm:text-base">{text}</p>
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

function getPreferredCategories(streams: Stream[]) {
  const counts = new Map<string, number>();

  streams.forEach((stream) => {
    counts.set(stream.category, (counts.get(stream.category) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
}


"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

type FeedStream = {
  id: string;
  title: string | null;
  category: string | null;
  thumbnail_url: string | null;
  viewers: number | null;
  user_id: string;
};

type FeedHost = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

type FeedItem = {
  stream: FeedStream;
  host: FeedHost | null;
  isFollowing: boolean;
};

type SuggestedCreator = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
};

export default function LiveFeedPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);

  // Only populated when there are no live streams at all.
  const [suggested, setSuggested] = useState<SuggestedCreator[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pull-to-refresh: only engages when the feed is already scrolled to the
  // top (so it never fights the vertical snap-scroll between cards).
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const PULL_THRESHOLD = 70;
  const MAX_PULL = 100;

  const loadFeed = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id || null;
    setCurrentUserId(userId);

    const { data: streams, error } = await supabase
      .from("streams")
      .select("id, title, category, thumbnail_url, viewers, user_id")
      .eq("status", "live")
      .in("visibility", ["public", "subscribers"])
      .order("viewers", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("Live feed load failed:", error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const liveStreams = (streams || []) as FeedStream[];

    if (liveStreams.length === 0) {
      // Empty state: suggest creators to follow instead of a dead end.
      const { data: creators } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, followers")
        .order("followers", { ascending: false })
        .limit(12);

      setSuggested((creators || []) as SuggestedCreator[]);
      setItems([]);
      setLoading(false);
      return;
    }

    const hostIds = Array.from(new Set(liveStreams.map((s) => s.user_id)));

    const { data: hosts } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified")
      .in("id", hostIds);

    const hostById = new Map<string, FeedHost>();
    (hosts || []).forEach((h) => hostById.set(h.id, h as FeedHost));

    let followingIds: string[] = [];

    if (userId) {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .in("following_id", hostIds);

      followingIds = (followRows || []).map((r) => r.following_id);
    }

    setItems(
      liveStreams.map((stream) => ({
        stream,
        host: hostById.get(stream.user_id) || null,
        isFollowing: followingIds.includes(stream.user_id),
      }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  // TikTok-style edge-to-edge feed: only while the real snap-scroll feed
  // is showing (not during loading or the empty-state list), escape the
  // app-shell padding so cards run full-bleed behind the floating bottom
  // nav. See the "streamhub-feed-mode" CSS block in app/layout.tsx.
  const showFeed = !loading && items.length > 0;

  useEffect(() => {
    if (!showFeed) return;

    document.documentElement.classList.add("streamhub-feed-mode");
    document.body.classList.add("streamhub-feed-mode");

    return () => {
      document.documentElement.classList.remove("streamhub-feed-mode");
      document.body.classList.remove("streamhub-feed-mode");
    };
  }, [showFeed]);

  async function toggleFollow(hostId: string) {
    if (!currentUserId || hostId === currentUserId) return;

    setFollowBusyId(hostId);

    const item = items.find((i) => i.host?.id === hostId);
    const alreadyFollowing = item?.isFollowing;

    if (alreadyFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", hostId);
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: hostId,
      });
    }

    setItems((current) =>
      current.map((i) =>
        i.host?.id === hostId ? { ...i, isFollowing: !alreadyFollowing } : i
      )
    );

    setFollowBusyId(null);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    touchStartYRef.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartYRef.current === null || refreshing) return;

    const el = containerRef.current;
    if (!el || el.scrollTop > 0) {
      touchStartYRef.current = null;
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, MAX_PULL));
    }
  }

  async function handleTouchEnd() {
    if (touchStartYRef.current === null) return;
    touchStartYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      await loadFeed();
      setRefreshing(false);
    }

    setPullDistance(0);
  }

  if (loading) {
    return (
      <main className="relative h-[100dvh] w-full overflow-hidden bg-canvas">
        <div className="skeleton absolute inset-0 rounded-none" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
          <div className="flex items-center gap-3">
            <div className="skeleton skeleton-avatar border-2 border-white/10" />
            <div className="flex-1 space-y-2">
              <div className="skeleton skeleton-line w-1/2" />
              <div className="skeleton skeleton-line w-1/3" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-canvas px-5 py-8 text-white">
        <div className="mx-auto max-w-xl text-center">
          <p className="mb-3 text-6xl">📡</p>
          <h1 className="font-display mb-2 text-2xl font-black">No one's live right now</h1>
          <p className="mb-8 text-sm text-muted">
            Check back soon, or follow some creators so you never miss when
            they go live.
          </p>

          <button
            onClick={() => router.push("/go-live")}
            className="btn-primary mb-8 w-full py-4 text-lg"
          >
            Go Live Yourself
          </button>

          {suggested.length > 0 && (
            <div className="text-left">
              <h2 className="font-display mb-4 text-lg font-black">Creators to follow</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {suggested.map((creator) => (
                  <button
                    key={creator.id}
                    onClick={() => router.push(`/profile/${creator.id}`)}
                    className="card flex items-center gap-3 p-3 text-left hover:border-accent"
                  >
                    <div className="avatar relative h-12 w-12">
                      {creator.avatar_url ? (
                        <Image
                          src={creator.avatar_url}
                          alt={creator.username || "user"}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        "👤"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {creator.display_name || creator.username || "User"}
                      </p>
                      <p className="truncate text-xs text-faint">
                        {creator.followers || 0} followers
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fade-in h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll bg-canvas"
      style={{ scrollbarWidth: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="pointer-events-none fixed inset-x-0 z-20 flex justify-center"
          style={{
            top: "calc(env(safe-area-inset-top) + 0.75rem)",
            opacity: refreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1),
            transition: refreshing ? undefined : "opacity 120ms ease",
          }}
        >
          <div
            className={`h-8 w-8 rounded-full border-2 border-white/25 border-t-accent ${
              refreshing ? "animate-spin" : ""
            }`}
            style={!refreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
          />
        </div>
      )}

      {items.map((item, index) => {
        const name =
          item.host?.display_name || item.host?.username || "Streamer";

        return (
          <div
            key={item.stream.id}
            className="relative mx-auto flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden xl:max-w-[480px] xl:border-x xl:border-white/10"
          >
            {/* Background: thumbnail as the preview "poster". Tapping
                anywhere joins the real, fully-interactive watch page. */}
            <button
              onClick={() => router.push(`/watch/${item.stream.id}`)}
              className="absolute inset-0 h-full w-full"
              aria-label={`Join ${name}'s live stream`}
            >
              {item.stream.thumbnail_url ? (
                <Image
                  src={item.stream.thumbnail_url}
                  alt={item.stream.title || "Live stream"}
                  fill
                  sizes="100vw"
                  priority={index === 0}
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface to-canvas">
                  <span className="text-7xl">📺</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/50" />
            </button>

            {/* LIVE badge + viewer count, top — the top nav is hidden in
                feed mode, so this just needs the device safe-area inset. */}
            <div className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] flex items-center justify-between">
              <span className="badge-live backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                LIVE
              </span>

              <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                {(item.stream.viewers || 0).toLocaleString()} watching
              </span>
            </div>

            {/* Host row + tap-to-join hint, bottom — padded clear of the
                floating bottom nav (~76px + safe-area) since content now
                runs full-bleed behind it instead of the nav pushing layout. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
              <div className="pointer-events-auto flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.host?.id) router.push(`/profile/${item.host.id}`);
                  }}
                  className="avatar relative h-12 w-12 border-2 border-white/40"
                >
                  {item.host?.avatar_url ? (
                    <Image
                      src={item.host.avatar_url}
                      alt={name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-white">
                    {name}
                  </p>
                  <p className="truncate text-sm text-white/70">
                    {item.stream.title || item.stream.category || "Live now"}
                  </p>
                </div>

                {currentUserId && item.host?.id !== currentUserId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.host?.id) toggleFollow(item.host.id);
                    }}
                    disabled={followBusyId === item.host?.id}
                    className={
                      item.isFollowing
                        ? "shrink-0 rounded-full border border-white/40 bg-black/40 px-4 py-2 text-xs font-black text-white backdrop-blur disabled:opacity-50"
                        : "shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    }
                  >
                    {followBusyId === item.host?.id
                      ? "..."
                      : item.isFollowing
                      ? "Following"
                      : "Follow"}
                  </button>
                )}
              </div>

              <p className="pointer-events-none mt-4 text-center text-xs font-semibold uppercase tracking-widest text-white/50">
                Tap to join
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

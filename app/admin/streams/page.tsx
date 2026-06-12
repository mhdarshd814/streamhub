"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility: "public" | "private" | "subscribers";
  viewers: number | null;
  likes: number | null;
  total_views: number | null;
  peak_viewers: number | null;
  watch_minutes: number | null;
  is_suspended: boolean | null;
  is_featured: boolean | null;
  featured_at: string | null;
  featured_by: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

export default function AdminStreamsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadStreams();
  }, []);

  async function loadStreams() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const cleanStreams = (data || []) as Stream[];
    setStreams(cleanStreams);

    const userIds = [...new Set(cleanStreams.map((stream) => stream.user_id))];

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .in("id", userIds);

      const profileMap: Record<string, Profile> = {};

      profileData?.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    }

    setLoading(false);
  }

  async function suspendStream(streamId: string) {
    const confirmed = confirm("Suspend this stream?");
    if (!confirmed) return;

    setUpdatingId(streamId);

    const { error } = await supabase.rpc("admin_suspend_stream", {
      target_stream_id: streamId,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStreams();
  }

  async function unsuspendStream(streamId: string) {
    const confirmed = confirm("Unsuspend this stream?");
    if (!confirmed) return;

    setUpdatingId(streamId);

    const { error } = await supabase.rpc("admin_unsuspend_stream", {
      target_stream_id: streamId,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStreams();
  }

  async function forceEndStream(streamId: string) {
    const confirmed = confirm(
      "Force end this stream? This will set it offline, clear viewers, and clear chat."
    );

    if (!confirmed) return;

    setUpdatingId(streamId);

    const { error } = await supabase.rpc("admin_force_end_stream", {
      target_stream_id: streamId,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStreams();
  }

  async function toggleFeaturedStream(stream: Stream) {
    const makeFeatured = !stream.is_featured;

    const confirmed = confirm(
      makeFeatured
        ? "Feature this stream on Explore?"
        : "Remove this stream from Featured?"
    );

    if (!confirmed) return;

    setUpdatingId(stream.id);

    const { error } = await supabase.rpc("admin_toggle_featured_stream", {
      target_stream_id: stream.id,
      make_featured: makeFeatured,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStreams();
  }

  const filteredStreams = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return streams;

    return streams.filter((stream) => {
      const creator = profiles[stream.user_id];

      return (
        stream.title?.toLowerCase().includes(value) ||
        stream.category?.toLowerCase().includes(value) ||
        stream.status?.toLowerCase().includes(value) ||
        stream.visibility?.toLowerCase().includes(value) ||
        stream.id.toLowerCase().includes(value) ||
        creator?.username?.toLowerCase().includes(value) ||
        creator?.display_name?.toLowerCase().includes(value)
      );
    });
  }, [search, streams, profiles]);

  const liveCount = streams.filter((stream) => stream.status === "live").length;
  const suspendedCount = streams.filter((stream) => stream.is_suspended).length;
  const featuredCount = streams.filter((stream) => stream.is_featured).length;
  const publicCount = streams.filter(
    (stream) => stream.visibility === "public"
  ).length;
  const privateCount = streams.filter(
    (stream) => stream.visibility === "private"
  ).length;
  const subscriberCount = streams.filter(
    (stream) => stream.visibility === "subscribers"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading streams...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">
            Your account does not have admin permission.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              Stream <span className="text-red-500">Moderation</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Suspend unsafe streams, force end live streams, and feature high
              quality streams on Explore.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              onClick={loadStreams}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin Home
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
          <Stat label="Total" value={streams.length} color="text-white" />
          <Stat label="Live" value={liveCount} color="text-green-500" />
          <Stat label="Featured" value={featuredCount} color="text-yellow-300" />
          <Stat label="Suspended" value={suspendedCount} color="text-red-500" />
          <Stat label="Public" value={publicCount} color="text-blue-400" />
          <Stat label="Private" value={privateCount} color="text-purple-400" />
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Subscriber Streams</p>
            <h2 className="text-3xl font-black text-yellow-300">
              {subscriberCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Featured Control</p>
            <p className="text-sm leading-6 text-gray-400">
              Featured streams are admin-selected and can be highlighted later
              on Explore and Trending sections.
            </p>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, creator, status, visibility, category, or stream ID..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl">Streams</h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing {filteredStreams.length} stream(s)
            </p>
          </div>

          {filteredStreams.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No streams found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredStreams.map((stream) => {
                const creator = profiles[stream.user_id];
                const creatorName =
                  creator?.display_name || creator?.username || "Unknown";
                const isLive = stream.status === "live";
                const isPrivate = stream.visibility === "private";
                const isSubscribers = stream.visibility === "subscribers";

                return (
                  <div
                    key={stream.id}
                    className={
                      stream.is_featured
                        ? "flex flex-col gap-4 bg-yellow-500/5 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between"
                        : "flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between"
                    }
                  >
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-800 sm:h-24 sm:w-36">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-500">No Image</span>
                        )}

                        {stream.is_featured && (
                          <div className="absolute left-2 top-2 rounded-full bg-yellow-500 px-2 py-1 text-xs font-black text-black">
                            ⭐
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge
                            label={isLive ? "LIVE" : "OFFLINE"}
                            color={
                              isLive
                                ? "bg-green-600 text-white"
                                : "bg-gray-700 text-gray-300"
                            }
                          />

                          <Badge
                            label={
                              isPrivate
                                ? "PRIVATE"
                                : isSubscribers
                                ? "SUBSCRIBERS"
                                : "PUBLIC"
                            }
                            color={
                              isPrivate
                                ? "bg-purple-600 text-white"
                                : isSubscribers
                                ? "bg-yellow-500 text-black"
                                : "bg-blue-600 text-white"
                            }
                          />

                          {stream.is_featured && (
                            <Badge
                              label="FEATURED"
                              color="bg-yellow-500 text-black"
                            />
                          )}

                          {stream.is_suspended && (
                            <Badge label="SUSPENDED" color="bg-red-600 text-white" />
                          )}

                          {creator?.is_verified && (
                            <Badge
                              label="VERIFIED CREATOR"
                              color="bg-blue-500 text-white"
                            />
                          )}
                        </div>

                        <h3 className="break-words text-lg font-black sm:text-xl">
                          {stream.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          {stream.category} • Creator: {creatorName}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          👀 {stream.viewers || 0} • ❤️ {stream.likes || 0} •
                          Total views {stream.total_views || 0} • Peak{" "}
                          {stream.peak_viewers || 0} • Watch mins{" "}
                          {stream.watch_minutes || 0}
                        </p>

                        <p className="mt-1 break-all text-xs text-gray-500">
                          Stream ID: {stream.id}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Created {new Date(stream.created_at).toLocaleString()}
                        </p>

                        {stream.is_featured && stream.featured_at && (
                          <p className="mt-1 text-xs font-bold text-yellow-300">
                            Featured{" "}
                            {new Date(stream.featured_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[440px]">
                      {stream.is_suspended ? (
                        <button
                          onClick={() => unsuspendStream(stream.id)}
                          disabled={updatingId === stream.id}
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                          {updatingId === stream.id
                            ? "Updating..."
                            : "Unsuspend"}
                        </button>
                      ) : (
                        <button
                          onClick={() => suspendStream(stream.id)}
                          disabled={updatingId === stream.id}
                          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                        >
                          {updatingId === stream.id
                            ? "Updating..."
                            : "Suspend"}
                        </button>
                      )}

                      <button
                        onClick={() => forceEndStream(stream.id)}
                        disabled={updatingId === stream.id || !isLive}
                        className="rounded-xl bg-yellow-600 px-4 py-3 text-sm font-bold hover:bg-yellow-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                      >
                        Force End
                      </button>

                      <button
                        onClick={() => toggleFeaturedStream(stream)}
                        disabled={updatingId === stream.id || isPrivate}
                        className={
                          stream.is_featured
                            ? "rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold text-yellow-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                            : "rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                        }
                      >
                        {updatingId === stream.id
                          ? "Updating..."
                          : stream.is_featured
                          ? "Unfeature"
                          : "Feature"}
                      </button>

                      <Link
                        href={`/live/${stream.id}`}
                        className="rounded-xl bg-gray-800 px-4 py-3 text-center text-sm font-bold hover:bg-gray-700"
                      >
                        Open Studio
                      </Link>

                      {!isPrivate && (
                        <Link
                          href={`/watch/${stream.id}`}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold hover:bg-blue-700 sm:col-span-2"
                        >
                          Open Watch
                        </Link>
                      )}

                      {isPrivate && (
                        <div className="rounded-xl bg-gray-800 px-4 py-3 text-center text-sm font-bold text-gray-500 sm:col-span-2">
                          Private streams cannot be featured or watched publicly
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black ${color}`}>{value}</h2>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${color}`}>
      {label}
    </span>
  );
}
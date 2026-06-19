"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type BroadcastStream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  viewers?: number | null;
  likes?: number | null;
  thumbnail_url?: string | null;
  description?: string | null;
  created_at: string;
};

export default function AdminBroadcastsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastStream[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function loadBroadcasts() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (profile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .eq("category", "Admin Broadcast")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setBroadcasts((data || []) as BroadcastStream[]);
    setLoading(false);
  }

  const filteredBroadcasts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return broadcasts.filter((broadcast) => {
      const matchesSearch =
        !searchText ||
        broadcast.title.toLowerCase().includes(searchText) ||
        String(broadcast.description || "").toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Live" && broadcast.status === "live") ||
        (statusFilter === "Offline" && broadcast.status !== "live");

      return matchesSearch && matchesStatus;
    });
  }, [broadcasts, search, statusFilter]);

  const liveCount = broadcasts.filter((broadcast) => broadcast.status === "live").length;
  const offlineCount = broadcasts.length - liveCount;
  const totalViewers = broadcasts.reduce(
    (total, broadcast) => total + Number(broadcast.viewers || 0),
    0
  );

  async function forceEndBroadcast(broadcast: BroadcastStream) {
    const confirmed = confirm(`Force end "${broadcast.title}"?`);
    if (!confirmed) return;

    setBusyId(broadcast.id);

    const { error } = await supabase
      .from("streams")
      .update({ status: "offline", viewers: 0 })
      .eq("id", broadcast.id);

    if (error) {
      setBusyId(null);
      alert(error.message);
      return;
    }

    await supabase.from("stream_viewers").delete().eq("stream_id", broadcast.id);
    await supabase.from("stream_chat").delete().eq("stream_id", broadcast.id);

    setBusyId(null);
    await loadBroadcasts();
  }

  async function deleteBroadcast(broadcast: BroadcastStream) {
    if (broadcast.status === "live") {
      alert("Force end this broadcast before deleting it.");
      return;
    }

    const confirmed = confirm(
      `Delete "${broadcast.title}"?\n\nThis removes the broadcast stream row and cannot be undone.`
    );

    if (!confirmed) return;

    setBusyId(broadcast.id);

    await supabase.from("stream_viewers").delete().eq("stream_id", broadcast.id);
    await supabase.from("stream_chat").delete().eq("stream_id", broadcast.id);

    const { error } = await supabase
      .from("streams")
      .delete()
      .eq("id", broadcast.id);

    setBusyId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setBroadcasts((current) =>
      current.filter((item) => item.id !== broadcast.id)
    );
  }

  async function copyWatchLink(broadcastId: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/watch/${broadcastId}`);
    setCopiedId(broadcastId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-400">Loading admin broadcasts...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">Your account does not have admin permission.</p>
          <Link
            href="/admin"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Broadcast Management
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              Broadcast <span className="text-red-500">Control</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              List all admin broadcasts, see live/offline status, force end live broadcasts, delete old broadcasts, copy watch links, and reopen broadcast studios.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={loadBroadcasts}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin/broadcast"
              className="rounded-xl bg-red-600 px-5 py-3 text-center font-bold hover:bg-red-700"
            >
              New Broadcast
            </Link>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin
            </Link>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Broadcasts" value={broadcasts.length} />
          <StatCard label="Live Broadcasts" value={liveCount} color="text-red-400" />
          <StatCard label="Offline Broadcasts" value={offlineCount} color="text-gray-400" />
          <StatCard label="Current Viewers" value={totalViewers} color="text-green-400" />
        </section>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search broadcasts..."
              className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-red-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-red-500"
            >
              <option value="All">All Statuses</option>
              <option value="Live">Live Only</option>
              <option value="Offline">Offline Only</option>
            </select>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
              }}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">All Admin Broadcasts</h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing {filteredBroadcasts.length} of {broadcasts.length}
            </p>
          </div>

          {filteredBroadcasts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No admin broadcasts found.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredBroadcasts.map((broadcast) => {
                const isLive = broadcast.status === "live";
                const isBusy = busyId === broadcast.id;

                return (
                  <div
                    key={broadcast.id}
                    className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-800 sm:h-24 sm:w-36">
                        {broadcast.thumbnail_url ? (
                          <img
                            src={broadcast.thumbnail_url}
                            alt={broadcast.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-4xl">📡</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={
                              isLive
                                ? "rounded-full bg-red-600 px-3 py-1 text-xs font-black"
                                : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400"
                            }
                          >
                            {isLive ? "LIVE" : "OFFLINE"}
                          </span>

                          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                            Public
                          </span>

                          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-black text-purple-300">
                            Admin
                          </span>
                        </div>

                        <h3 className="break-words text-xl font-black">
                          {broadcast.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          {broadcast.category} • 👀 {broadcast.viewers || 0} • ❤️{" "}
                          {broadcast.likes || 0}
                        </p>

                        {broadcast.description && (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                            {broadcast.description}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-gray-600">
                          Created {new Date(broadcast.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                      <Link
                        href={`/admin/broadcast/${broadcast.id}`}
                        className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-bold hover:bg-red-700"
                      >
                        Open Studio
                      </Link>

                      <Link
                        href={`/watch/${broadcast.id}`}
                        className="rounded-xl bg-gray-800 px-4 py-3 text-center text-sm font-bold hover:bg-gray-700"
                      >
                        Watch
                      </Link>

                      <button
                        onClick={() => copyWatchLink(broadcast.id)}
                        className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700"
                      >
                        {copiedId === broadcast.id ? "Copied" : "Copy Link"}
                      </button>

                      {isLive && (
                        <button
                          onClick={() => forceEndBroadcast(broadcast)}
                          disabled={isBusy}
                          className="rounded-xl bg-yellow-600 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-400"
                        >
                          {isBusy ? "Ending..." : "Force End"}
                        </button>
                      )}

                      <button
                        onClick={() => deleteBroadcast(broadcast)}
                        disabled={isBusy || isLive}
                        className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:cursor-not-allowed disabled:text-gray-600"
                      >
                        {isBusy ? "Deleting..." : isLive ? "End First" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black sm:text-4xl ${color}`}>{value}</h2>
    </div>
  );
}

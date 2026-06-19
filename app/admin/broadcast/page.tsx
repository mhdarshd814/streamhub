"use client";

import { useEffect, useState } from "react";
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

export default function AdminBroadcastPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [streams, setStreams] = useState<BroadcastStream[]>([]);
  const [title, setTitle] = useState("Official StreamHub Broadcast");
  const [description, setDescription] = useState(
    "Official broadcast from StreamHub admin team."
  );
  const [thumbnailUrl, setThumbnailUrl] = useState("");

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
      .order("created_at", { ascending: false })
      .limit(6);

    if (!error) {
      setStreams((data || []) as BroadcastStream[]);
    }

    setLoading(false);
  }

  async function createBroadcast() {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      alert("Enter a broadcast title.");
      return;
    }

    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const basePayload = {
      user_id: user.id,
      title: cleanTitle,
      category: "Admin Broadcast",
      visibility: "public",
      status: "offline",
      viewers: 0,
      likes: 0,
    };

    const fullPayload = {
      ...basePayload,
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
    };

    let result = await supabase
      .from("streams")
      .insert([fullPayload])
      .select()
      .single();

    if (result.error) {
      result = await supabase
        .from("streams")
        .insert([basePayload])
        .select()
        .single();
    }

    setCreating(false);

    if (result.error || !result.data) {
      alert(result.error?.message || "Failed to create admin broadcast.");
      return;
    }

    window.location.href = `/admin/broadcast/${result.data.id}`;
  }

  async function openBroadcast(id: string) {
    window.location.href = `/admin/broadcast/${id}`;
  }

  async function endBroadcast(id: string) {
    const confirmed = confirm("Force end this admin broadcast?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("streams")
      .update({ status: "offline", viewers: 0 })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("stream_viewers").delete().eq("stream_id", id);
    await supabase.from("stream_chat").delete().eq("stream_id", id);
    await loadPage();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-400">Loading admin broadcast studio...</p>
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
            <p className="mb-2 text-sm font-semibold text-red-400">Admin Broadcast Studio</p>
            <h1 className="text-4xl font-black sm:text-5xl">
              Official <span className="text-red-500">Broadcasts</span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Create admin-only public broadcasts for announcements, events, presentations, training, and screen sharing from any browser tab or app window.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={loadPage}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin/broadcasts"
              className="rounded-xl bg-red-600 px-5 py-3 text-center font-bold hover:bg-red-700"
            >
              Manage
            </Link>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin
            </Link>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-red-900/40 bg-gray-900 p-5 sm:p-6 lg:p-7">
          <div className="mb-6">
            <h2 className="text-2xl font-black sm:text-3xl">Create Admin Broadcast</h2>
            <p className="mt-1 text-sm text-gray-400">
              The broadcast category is fixed as Admin Broadcast so management pages can track it correctly.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-bold text-gray-300">Broadcast Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-bold text-gray-300">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-bold text-gray-300">Thumbnail URL optional</label>
              <input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-red-500"
              />
            </div>
          </div>

          <button
            onClick={createBroadcast}
            disabled={creating}
            className="mt-6 rounded-xl bg-red-600 px-7 py-4 font-black hover:bg-red-700 disabled:bg-gray-700"
          >
            {creating ? "Creating..." : "Create & Open Broadcast Studio"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex flex-col gap-3 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="text-2xl font-black">Recent Admin Broadcasts</h2>
              <p className="mt-1 text-sm text-gray-400">Showing latest broadcasts only.</p>
            </div>

            <Link
              href="/admin/broadcasts"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center text-sm font-bold hover:bg-gray-700"
            >
              View All
            </Link>
          </div>

          {streams.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No admin broadcasts created yet.</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {streams.map((stream) => (
                <div key={stream.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className={stream.status === "live" ? "rounded-full bg-red-600 px-3 py-1 text-xs font-black" : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400"}>
                        {stream.status === "live" ? "LIVE" : "OFFLINE"}
                      </span>
                      <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                        Public
                      </span>
                    </div>
                    <h3 className="break-words text-xl font-black">{stream.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      {stream.category} • 👀 {stream.viewers || 0} • Created {new Date(stream.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      onClick={() => openBroadcast(stream.id)}
                      className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700"
                    >
                      Open Studio
                    </button>

                    <Link
                      href={`/watch/${stream.id}`}
                      className="rounded-xl bg-gray-800 px-5 py-3 text-center text-sm font-bold hover:bg-gray-700"
                    >
                      Watch
                    </Link>

                    {stream.status === "live" && (
                      <button
                        onClick={() => endBroadcast(stream.id)}
                        className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700"
                      >
                        End
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

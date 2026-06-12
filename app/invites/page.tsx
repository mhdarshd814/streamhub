"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Stream = {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private";
  thumbnail_url: string | null;
};

type Invite = {
  id: string;
  stream_id: string;
  host_id: string;
  guest_id: string;
  status: "pending" | "accepted" | "declined" | "removed";
  created_at: string;
  streams?: Stream | null;
  profiles?: Profile | null;
};

export default function InvitesPage() {
  const router = useRouter();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData?.is_banned) {
      router.push("/banned");
      return;
    }

    const { data, error } = await supabase
      .from("stream_guests")
      .select(
        `
        *,
        streams:stream_id (
          id,
          title,
          category,
          status,
          visibility,
          thumbnail_url
        ),
        profiles:host_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("guest_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setInvites((data || []) as Invite[]);
    setLoading(false);
  }

  async function updateInviteStatus(
    inviteId: string,
    status: "accepted" | "declined"
  ) {
    setUpdatingId(inviteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUpdatingId(null);
      router.push("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileData?.is_banned) {
      setUpdatingId(null);
      router.push("/banned");
      return;
    }

    const { error } = await supabase
      .from("stream_guests")
      .update({ status })
      .eq("id", inviteId);

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadInvites();
  }

  async function openRoom(invite: Invite) {
    if (!invite.stream_id) {
      alert("Stream not found.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileData?.is_banned) {
      router.push("/banned");
      return;
    }

    router.push(`/live/${invite.stream_id}`);
  }

  const pendingCount = invites.filter((item) => item.status === "pending").length;
  const acceptedCount = invites.filter(
    (item) => item.status === "accepted"
  ).length;

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
              Guest Studio
            </p>

            <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
              Stream <span className="text-red-500">Invites</span>
            </h1>

            <p className="max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
              Manage guest streamer invitations and join private or public
              co-host rooms.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Dashboard
          </button>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-8 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Total Invites</p>
            <h2 className="text-3xl font-black sm:text-4xl">
              {invites.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Pending</p>
            <h2 className="text-3xl font-black text-yellow-400 sm:text-4xl">
              {pendingCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Accepted</p>
            <h2 className="text-3xl font-black text-green-500 sm:text-4xl">
              {acceptedCount}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
            <p className="text-gray-400">Loading invites...</p>
          </div>
        ) : invites.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-12">
            <p className="mb-5 text-6xl">🎙️</p>

            <h2 className="mb-3 text-2xl font-black sm:text-3xl">
              No invites yet
            </h2>

            <p className="mx-auto max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
              When another creator invites you as a guest streamer, the
              invitation will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-6">
            {invites.map((invite) => {
              const stream = invite.streams;
              const host = invite.profiles;
              const isPrivate = stream?.visibility === "private";
              const isLive = stream?.status === "live";

              return (
                <div
                  key={invite.id}
                  className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900"
                >
                  <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                    <div className="relative h-52 bg-gray-800 sm:h-64 lg:h-full">
                      {stream?.thumbnail_url ? (
                        <img
                          src={stream.thumbnail_url}
                          alt={stream.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <div className="text-center text-gray-400">
                            <p className="mb-3 text-5xl">
                              {isPrivate ? "🔒" : "📺"}
                            </p>
                            <p>No Thumbnail</p>
                          </div>
                        </div>
                      )}

                      <div
                        className={
                          isLive
                            ? "absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black sm:left-4 sm:top-4 sm:px-4 sm:text-sm"
                            : "absolute left-3 top-3 rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400 sm:left-4 sm:top-4 sm:px-4 sm:text-sm"
                        }
                      >
                        {isLive ? "LIVE" : "OFFLINE"}
                      </div>

                      <div
                        className={
                          isPrivate
                            ? "absolute right-3 top-3 rounded-full bg-purple-600 px-3 py-1 text-xs font-black sm:right-4 sm:top-4 sm:px-4 sm:text-sm"
                            : "absolute right-3 top-3 rounded-full bg-green-600 px-3 py-1 text-xs font-black sm:right-4 sm:top-4 sm:px-4 sm:text-sm"
                        }
                      >
                        {isPrivate ? "PRIVATE" : "PUBLIC"}
                      </div>
                    </div>

                    <div className="p-4 sm:p-6">
                      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-400 sm:text-sm">
                            {invite.status}
                          </p>

                          <h2 className="mb-2 break-words text-2xl font-black sm:text-3xl">
                            {stream?.title || "Stream unavailable"}
                          </h2>

                          <p className="text-sm text-gray-400 sm:text-base">
                            {stream?.category || "General"} •{" "}
                            {isPrivate ? "Private video call" : "Public stream"}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl bg-gray-800 p-3">
                          <img
                            src={host?.avatar_url || "/default-avatar.png"}
                            alt={host?.username || "Host"}
                            className="h-11 w-11 shrink-0 rounded-full object-cover"
                          />

                          <div className="min-w-0">
                            <p className="truncate font-bold">
                              {host?.display_name ||
                                host?.username ||
                                "Unknown Host"}
                            </p>
                            <p className="truncate text-sm text-gray-400">
                              @{host?.username || "unknown"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                        {invite.status === "pending" && (
                          <>
                            <button
                              onClick={() =>
                                updateInviteStatus(invite.id, "accepted")
                              }
                              disabled={updatingId === invite.id}
                              className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:bg-gray-700"
                            >
                              {updatingId === invite.id
                                ? "Updating..."
                                : "Accept Invite"}
                            </button>

                            <button
                              onClick={() =>
                                updateInviteStatus(invite.id, "declined")
                              }
                              disabled={updatingId === invite.id}
                              className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                            >
                              Decline
                            </button>
                          </>
                        )}

                        {invite.status === "accepted" && (
                          <button
                            onClick={() => openRoom(invite)}
                            className="rounded-xl bg-green-600 px-6 py-3 font-bold hover:bg-green-700"
                          >
                            Open Room
                          </button>
                        )}

                        {invite.status === "declined" && (
                          <span className="rounded-xl bg-gray-800 px-6 py-3 text-center font-bold text-gray-500">
                            Declined
                          </span>
                        )}

                        {invite.status === "removed" && (
                          <span className="rounded-xl bg-gray-800 px-6 py-3 text-center font-bold text-gray-500">
                            Removed by Host
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
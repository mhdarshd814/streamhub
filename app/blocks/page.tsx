"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type BlockRow = {
  id: string;
  blocked_id: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export default function BlocksPage() {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  async function loadBlockedUsers() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: blockData, error: blockError } = await supabase
      .from("user_blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (blockError) {
      console.error(blockError);
      setLoading(false);
      return;
    }

    const cleanBlocks = blockData || [];
    setBlocks(cleanBlocks);

    const blockedIds = cleanBlocks.map((block) => block.blocked_id);

    if (blockedIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", blockedIds);

      if (profileError) {
        console.error(profileError);
      }

      const profileMap: Record<string, Profile> = {};
      profileData?.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    setLoading(false);
  }

  async function handleUnblock(blockedUserId: string) {
    setUnblockingId(blockedUserId);

    const { error } = await supabase.rpc("unblock_user", {
      target_user_id: blockedUserId,
    });

    if (error) {
      console.error(error);
      alert("Failed to unblock user.");
    } else {
      await loadBlockedUsers();
    }

    setUnblockingId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white p-6">
        <p className="text-zinc-400">Loading blocked users...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Blocked Users</h1>
            <p className="text-zinc-400 mt-1">
              Manage users you have blocked on StreamHub.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm"
          >
            Back
          </Link>
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-400">You have not blocked anyone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => {
              const profile = profiles[block.blocked_id];

              return (
                <div
                  key={block.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-zinc-400 text-sm">
                          {profile?.full_name?.[0] ||
                            profile?.username?.[0] ||
                            "U"}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {profile?.full_name ||
                          profile?.username ||
                          "Unknown User"}
                      </p>
                      <p className="text-sm text-zinc-500">
                        Blocked on{" "}
                        {new Date(block.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(block.blocked_id)}
                    disabled={unblockingId === block.blocked_id}
                    className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-sm font-medium"
                  >
                    {unblockingId === block.blocked_id
                      ? "Unblocking..."
                      : "Unblock"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

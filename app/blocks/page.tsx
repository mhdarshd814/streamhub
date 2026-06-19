"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function BlocksPage() {
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
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

    const { data: blockData } = await supabase
      .from("user_blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    const cleanBlocks = blockData || [];
    setBlocks(cleanBlocks);

    const blockedIds = cleanBlocks.map((block) => block.blocked_id);

    if (blockedIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", blockedIds);

      const profileMap: Record<string, any> = {};
      profileData?.forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    }

    setLoading(false);
  }

  async function handleUnblock(blockedUserId: string) {
    setUnblockingId(blockedUserId);

    const { error } = await supabase.rpc("unblock_user", {
      target_user_id: blockedUserId,
    });

    if (error) {
      alert(error.message);
    } else {
      await loadBlockedUsers();
    }

    setUnblockingId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading blocked users...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black">Blocked Users</h1>
            <p className="text-gray-400 mt-2">Manage users you have blocked.</p>
          </div>

          <Link href="/dashboard" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
            Back
          </Link>
        </div>

        {blocks.length === 0 ? (
          <div className="premium-glass rounded-3xl p-16 text-center">
            <p className="text-2xl text-gray-400">You have not blocked anyone.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => {
              const profile = profiles[block.blocked_id];

              return (
                <div key={block.id} className="premium-glass rounded-3xl p-6 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-800">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">👤</div>
                      )}
                    </div>

                    <div>
                      <p className="font-bold text-xl">{profile?.full_name || profile?.username || "Unknown"}</p>
                      <p className="text-sm text-gray-400">Blocked on {new Date(block.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(block.blocked_id)}
                    disabled={unblockingId === block.blocked_id}
                    className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500"
                  >
                    {unblockingId === block.blocked_id ? "Unblocking..." : "Unblock"}
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
// app/components/messaging/NewConversationModal.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";
import { getOrCreateDirectConversation, displayNameFor, type Profile } from "../../../lib/messaging";

type Props = {
  currentUserId: string;
  onClose: () => void;
  onConversationReady: (conversationId: string) => void;
};

type FollowRow = {
  following_id: string;
};

export default function NewConversationModal({
  currentUserId,
  onClose,
  onConversationReady,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadFollowedProfiles = useCallback(async () => {
    setLoading(true);

    const { data: follows, error: followError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId);

    if (followError) {
      toast.error(followError.message);
      setLoading(false);
      return;
    }

    const followedIds = ((follows || []) as FollowRow[]).map((f) => f.following_id);

    if (followedIds.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified")
      .in("id", followedIds);

    if (profileError) {
      toast.error(profileError.message);
      setLoading(false);
      return;
    }

    setProfiles((profileData || []) as Profile[]);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadFollowedProfiles();
  }, [loadFollowedProfiles]);

  async function handleSelect(otherUserId: string) {
    setStartingId(otherUserId);

    const { conversation, error } = await getOrCreateDirectConversation(
      currentUserId,
      otherUserId
    );

    setStartingId(null);

    if (error || !conversation) {
      toast.error(error || "Could not start conversation.");
      return;
    }

    onConversationReady(conversation.id);
  }

  const filtered = profiles.filter((p) => {
    const name = displayNameFor(p).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-[rgba(17,24,39,0.97)] border border-[rgba(127,29,29,0.45)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-semibold">New message</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people you follow..."
            className="w-full rounded-full bg-black/40 border border-white/10 px-4 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-[#dc2626]"
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <p className="text-white/50 text-sm text-center py-6">Loading...</p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-white/50 text-sm text-center py-6 px-4">
              Follow people to start messaging them, or search didn&apos;t match anyone.
            </p>
          )}

          {!loading &&
            filtered.map((profile) => {
              const name = displayNameFor(profile);
              return (
                <button
                  key={profile.id}
                  onClick={() => handleSelect(profile.id)}
                  disabled={startingId === profile.id}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[rgba(127,29,29,0.45)] flex items-center justify-center text-white font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[#ededed] text-sm font-medium">
                    {startingId === profile.id ? "Starting..." : name}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

interface BlockUserButtonProps {
  targetUserId: string;
  onBlocked?: () => void;
}

export default function BlockUserButton({ targetUserId, onBlocked }: BlockUserButtonProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const blockUser = async () => {
    if (loading) return;

    const confirmed = confirm("Block this user? They will no longer be able to interact with you.");
    if (!confirmed) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("blocks")
        .insert([
          {
            blocker_id: user?.id,
            blocked_id: targetUserId,
          },
        ]);

      if (error) throw error;

      setIsBlocked(true);
      onBlocked?.();
      toast.success("User blocked successfully");
    } catch (error) {
      alert("Failed to block user.");
    } finally {
      setLoading(false);
    }
  };

  if (isBlocked) {
    return (
      <button disabled className="rounded-2xl bg-gray-700 px-5 py-3 text-sm font-bold">
        Blocked
      </button>
    );
  }

  return (
    <button
      onClick={blockUser}
      disabled={loading}
      className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
    >
      {loading ? "Blocking..." : "Block User"}
    </button>
  );
}
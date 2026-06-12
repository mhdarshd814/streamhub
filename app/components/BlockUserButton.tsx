"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type BlockUserButtonProps = {
  targetUserId: string;
  onBlocked?: () => void;
};

export default function BlockUserButton({
  targetUserId,
  onBlocked,
}: BlockUserButtonProps) {
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkBlockStatus();
  }, [targetUserId]);

  async function checkBlockStatus() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      if (user.id === targetUserId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("Block status error:", error);
      }

      setIsBlocked(!!data);
    } catch (error) {
      console.error("Block status check failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBlock() {
    const confirmed = window.confirm(
      "Block this user? They will not be able to interact with you or your streams."
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

      const { error } = await supabase.rpc("block_user", {
        target_user_id: targetUserId,
      });

      if (error) {
        console.error(error);
        alert(error.message || "Failed to block user.");
        return;
      }

      setIsBlocked(true);
      onBlocked?.();
    } catch (error) {
      console.error(error);
      alert("Failed to block user.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUnblock() {
    try {
      setProcessing(true);

      const { error } = await supabase.rpc("unblock_user", {
        target_user_id: targetUserId,
      });

      if (error) {
        console.error(error);
        alert(error.message || "Failed to unblock user.");
        return;
      }

      setIsBlocked(false);
    } catch (error) {
      console.error(error);
      alert("Failed to unblock user.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading || !currentUserId || currentUserId === targetUserId) {
    return null;
  }

  if (isBlocked) {
    return (
      <button
        onClick={handleUnblock}
        disabled={processing}
        className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
      >
        {processing ? "Processing..." : "Unblock"}
      </button>
    );
  }

  return (
    <button
      onClick={handleBlock}
      disabled={processing}
      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {processing ? "Processing..." : "Block"}
    </button>
  );
}
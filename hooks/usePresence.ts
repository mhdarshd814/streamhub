"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type PresenceInfo = {
  isOnline: boolean;
  isOnCall: boolean;
  lastSeenAt: string | null;
};

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Sends a heartbeat for the CURRENT signed-in user every ~20s while the
 * app is open (and immediately on mount / on tab focus). Call this once,
 * high in the tree (e.g. layout.tsx), so presence stays fresh regardless
 * of which page is open.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function beat() {
      try {
        await supabase.rpc("heartbeat_presence");
      } catch {
        // Best-effort. A missed heartbeat just means this user briefly
        // shows as offline/stale to others; never worth surfacing an error.
      }
    }

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || !session?.user) return;

      await beat();
      intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void beat();
      }
    }

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}

/**
 * Looks up online/on-call/last-seen for a set of user ids, refreshing on
 * an interval. Use this in the conversation list (many ids at once) or a
 * thread header (a single id).
 */
export function usePresenceFor(userIds: string[]) {
  const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
  const idsKey = userIds.slice().sort().join(",");
  const idsRef = useRef<string[]>(userIds);
  idsRef.current = userIds;

  const refresh = useCallback(async () => {
    const ids = idsRef.current;
    if (ids.length === 0) return;

    const { data, error } = await supabase.rpc("get_presence_for_users", {
      p_user_ids: ids,
    });

    if (error) {
      console.warn("Presence lookup failed:", error.message);
      return;
    }

    const next: Record<string, PresenceInfo> = {};
    (data || []).forEach((row: any) => {
      next[row.user_id] = {
        isOnline: !!row.is_online,
        isOnCall: !!row.is_on_call,
        lastSeenAt: row.last_seen_at,
      };
    });

    setPresence(next);
  }, []);

  useEffect(() => {
    if (idsRef.current.length === 0) return;

    void refresh();

    const intervalId = setInterval(refresh, 15_000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, refresh]);

  return presence;
}

/** "Online" / "On a call" / "Last seen 5m ago" / "Offline" */
export function formatPresenceLabel(info: PresenceInfo | undefined): string {
  if (!info) return "";
  if (info.isOnCall) return "On a call";
  if (info.isOnline) return "Online";

  if (!info.lastSeenAt) return "Offline";

  const seenMs = new Date(info.lastSeenAt).getTime();
  const diffMs = Date.now() - seenMs;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Last seen ${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `Last seen ${diffDay}d ago`;
}

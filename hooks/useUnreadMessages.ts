"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { fetchConversations } from "../lib/messaging";

type NewMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string | null;
  is_deleted: boolean | null;
};

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const toastedIdsRef = useRef<Set<string>>(new Set());

  const loadUnreadCount = useCallback(async (userId: string) => {
    const { items, error } = await fetchConversations(userId);

    if (error) {
      console.error("Failed to load unread messages:", error);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const total = items.reduce((sum, item) => sum + item.unreadCount, 0);
    setUnreadCount(total);
    setLoading(false);
  }, []);

  const showMessageToast = useCallback(async (row: NewMessageRow) => {
    // Never toast twice for the same message (realtime can redeliver).
    if (toastedIdsRef.current.has(row.id)) return;
    toastedIdsRef.current.add(row.id);

    const { data: sender } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", row.sender_id)
      .maybeSingle();

    const name = sender?.display_name || sender?.username || "New message";

    const preview =
      row.message_type && row.message_type !== "text"
        ? "Sent you a message"
        : (row.content || "").trim().slice(0, 70) || "Sent you a message";

    toast(
      `${name}: ${preview}`,
      {
        id: `dm-${row.id}`,
        duration: 4500,
        icon: "💬",
      }
    );
  }, []);

  const subscribeFor = useCallback(
    (userId: string) => {
      // Replace any previous channel (e.g. after a re-login).
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelRef.current = supabase
        .channel(`unread-messages-${userId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const row = payload.new as NewMessageRow;

            if (userIdRef.current) {
              void loadUnreadCount(userIdRef.current);
            }

            // In-app toast: only for messages from others, not deleted,
            // and only when the user is NOT already inside that thread.
            if (
              row &&
              row.sender_id !== userId &&
              !row.is_deleted &&
              typeof window !== "undefined" &&
              !window.location.pathname.startsWith(
                `/messages/${row.conversation_id}`
              )
            ) {
              void showMessageToast(row);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_status",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (userIdRef.current) {
              void loadUnreadCount(userIdRef.current);
            }
          }
        )
        .subscribe();
    },
    [loadUnreadCount, showMessageToast]
  );

  useEffect(() => {
    let mounted = true;

    async function startFor(userId: string) {
      userIdRef.current = userId;
      await loadUnreadCount(userId);
      if (!mounted) return;
      subscribeFor(userId);
    }

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const userId = session?.user?.id || null;

      if (userId) {
        await startFor(userId);
      } else {
        // Session not ready yet (cold start) or signed out. Don't give up:
        // the auth listener below starts the subscription the moment the
        // session appears. The old version returned here permanently and
        // the badge stayed dead for the whole app session.
        setUnreadCount(0);
        setLoading(false);
      }
    }

    // Auth-driven lifecycle: (re)subscribe whenever a session becomes
    // available, tear down on sign-out.
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || null;

      if (!mounted) return;

      if (userId && userId !== userIdRef.current) {
        void startFor(userId);
      }

      if (!userId) {
        userIdRef.current = null;
        setUnreadCount(0);

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    function handleUnreadChanged() {
      if (userIdRef.current) {
        void loadUnreadCount(userIdRef.current);
      }
    }

    window.addEventListener("messages:unread-changed", handleUnreadChanged);

    void init();

    return () => {
      window.removeEventListener("messages:unread-changed", handleUnreadChanged);
      mounted = false;
      userIdRef.current = null;
      authSub.unsubscribe();

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadUnreadCount, subscribeFor]);

  return {
    unreadCount,
    loading,
    hasUnread: unreadCount > 0,
  };
}

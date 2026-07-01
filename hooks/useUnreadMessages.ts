"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchConversations } from "../lib/messaging";

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || null;
      userIdRef.current = userId;

      if (!mounted) return;

      if (!userId) {
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      await loadUnreadCount(userId);

      channel = supabase
        .channel(`unread-messages-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          () => {
            if (userIdRef.current) {
              void loadUnreadCount(userIdRef.current);
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
    }

    void init();

    return () => {
      mounted = false;
      userIdRef.current = null;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadUnreadCount]);

  return {
    unreadCount,
    loading,
    hasUnread: unreadCount > 0,
  };
}

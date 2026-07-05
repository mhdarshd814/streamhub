"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { fetchConversations, type ConversationListItem as ConversationListItemType } from "../../lib/messaging";
import ConversationListItem from "../components/messaging/ConversationListItem";
import NewConversationModal from "../components/messaging/NewConversationModal";
import { usePresenceFor } from "../../hooks/usePresence";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ConversationListItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);

  const otherUserIds = items
    .map((item) => item.otherProfile?.id)
    .filter((id): id is string => !!id);

  const presenceByUserId = usePresenceFor(otherUserIds);

  const loadInbox = useCallback(async (currentUserId: string) => {
    try {
      setDebugError(null);
      const { items: inboxItems, error } = await withTimeout(
        fetchConversations(currentUserId),
        10000
      );

      if (error) {
        toast.error(error);
        setDebugError(error);
      }

      setItems(inboxItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load inbox.";
      toast.error(message);
      setDebugError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          setDebugError(error.message);
          setLoading(false);
          return;
        }

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profileCheck, error: profileError } = await supabase
          .from("profiles")
          .select("is_banned")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          setDebugError(profileError.message);
          setLoading(false);
          return;
        }

        if (profileCheck?.is_banned) {
          router.push("/banned");
          return;
        }

        setUserId(user.id);
        await loadInbox(user.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to open messages.";
        setDebugError(message);
        setLoading(false);
      }
    })();
  }, [router, loadInbox]);

  useEffect(() => {
    if (!userId) return;

    const channelKey = `inbox-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          loadInbox(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadInbox]);

  return (
    <div className="min-h-screen bg-black text-[#ededed]">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 sticky top-0 bg-black/90 backdrop-blur z-10">
          <h1 className="text-xl font-semibold">Messages</h1>
          <button
            onClick={() => setShowNewConversation(true)}
            className="rounded-full bg-[#dc2626] px-4 py-2 text-sm font-medium text-white"
          >
            New message
          </button>
        </div>

        {loading && (
          <p className="text-white/50 text-sm text-center py-10">Loading conversations...</p>
        )}

        {!loading && debugError && (
          <div className="m-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-100">
            <p className="font-semibold">Messages failed to load</p>
            <p className="mt-2 break-words">{debugError}</p>
          </div>
        )}

        {!loading && !debugError && items.length === 0 && (
          <div className="text-center py-16 px-6">
            <p className="text-white/50 text-sm">
              No conversations yet. Start one with someone you follow.
            </p>
          </div>
        )}

        {!loading &&
          !debugError &&
          items.map((item) => (
            <ConversationListItem
              key={item.conversation.id}
              item={item}
              presence={
                item.otherProfile?.id
                  ? presenceByUserId[item.otherProfile.id]
                  : undefined
              }
              onClick={() => router.push(`/messages/${item.conversation.id}`)}
            />
          ))}
      </div>

      {showNewConversation && userId && (
        <NewConversationModal
          currentUserId={userId}
          onClose={() => setShowNewConversation(false)}
          onConversationReady={(conversationId) => {
            setShowNewConversation(false);
            router.push(`/messages/${conversationId}`);
          }}
        />
      )}
    </div>
  );
}

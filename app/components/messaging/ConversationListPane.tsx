"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";
import { fetchConversations, type ConversationListItem as ConversationListItemType } from "../../../lib/messaging";
import ConversationListItem from "./ConversationListItem";
import NewConversationModal from "./NewConversationModal";
import { usePresenceFor } from "../../../hooks/usePresence";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

type Props = {
  activeConversationId?: string;
};

export default function ConversationListPane({ activeConversationId }: Props) {
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
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-canvas/90 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-semibold">Messages</h1>
        <button
          onClick={() => setShowNewConversation(true)}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover active:scale-95"
        >
          New message
        </button>
      </div>

      {loading && (
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3"
            >
              <div className="skeleton skeleton-avatar shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton skeleton-line w-1/3" />
                <div className="skeleton skeleton-line w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && debugError && (
        <div className="m-4 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm text-white">
          <p className="font-semibold">Messages failed to load</p>
          <p className="mt-2 break-words">{debugError}</p>
        </div>
      )}

      {!loading && !debugError && items.length === 0 && (
        <div className="text-center py-16 px-6">
          <p className="text-muted text-sm">
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
            active={item.conversation.id === activeConversationId}
            presence={
              item.otherProfile?.id
                ? presenceByUserId[item.otherProfile.id]
                : undefined
            }
            onClick={() => router.push(`/messages/${item.conversation.id}`)}
          />
        ))}

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

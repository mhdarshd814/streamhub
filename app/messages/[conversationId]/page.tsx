// app/messages/[conversationId]/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";
import {
  fetchConversationWithProfile,
  fetchMessages,
  sendTextMessage,
  markConversationRead,
  displayNameFor,
  type Conversation,
  type Profile,
  type Message,
} from "../../../lib/messaging";
import MessageBubble from "../../components/messaging/MessageBubble";
import MessageInput from "../../components/messaging/MessageInput";
import { startPrivateCallRequest } from "../../../lib/privateCalls";
import { usePresenceFor, formatPresenceLabel } from "../../../hooks/usePresence";

export default function MessageThreadPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const [userId, setUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const presenceByUserId = usePresenceFor(
    otherProfile?.id ? [otherProfile.id] : []
  );
  const otherPresence = otherProfile?.id
    ? presenceByUserId[otherProfile.id]
    : undefined;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [callMenuOpen, setCallMenuOpen] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleStartCall = async (price: number) => {
    if (!userId || !otherProfile || startingCall) return;

    setCallMenuOpen(false);
    setStartingCall(true);

    const toastId = toast.loading("Calling...");

    const result = await startPrivateCallRequest({
      callerId: userId,
      target: otherProfile,
      price,
    });

    toast.dismiss(toastId);
    setStartingCall(false);

    if (!result.ok) {
      if (result.redirectTo) {
        window.location.href = result.redirectTo;
        return;
      }

      toast.error(result.message);
      return;
    }

    window.location.href = `/live/${result.streamId}`;
  };

  useEffect(() => {
    const bottomNav = document.querySelector(".mobile-bottom-nav") as HTMLElement | null;
    const appShell = document.querySelector(".app-shell") as HTMLElement | null;

    const previousBottomNavDisplay = bottomNav?.style.display || "";
    const previousAppShellPaddingBottom = appShell?.style.paddingBottom || "";

    if (bottomNav) bottomNav.style.display = "none";
    if (appShell) appShell.style.paddingBottom = "0px";

    return () => {
      if (bottomNav) bottomNav.style.display = previousBottomNavDisplay;
      if (appShell) appShell.style.paddingBottom = previousAppShellPaddingBottom;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { conversation: conv, otherProfile: profile, error: convError } =
        await fetchConversationWithProfile(conversationId, user.id);

      if (convError || !conv) {
        toast.error(convError || "Conversation not found.");
        router.push("/messages");
        return;
      }

      setConversation(conv);
      setOtherProfile(profile);

      const { messages: msgs, error: msgError } = await fetchMessages(conversationId);
      if (msgError) toast.error(msgError);
      setMessages(msgs);
      setLoading(false);

      await markConversationRead(conversationId, user.id);
      window.dispatchEvent(new CustomEvent("messages:unread-changed"));
    })();
  }, [conversationId, router]);

  // Realtime: subscribe to new messages in this conversation.
  // Mirrors the "live-chat-" channel pattern in app/live/[id]/page.tsx.
  useEffect(() => {
    if (!userId) return;

    const channelKey = `conversation-${conversationId}-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelKey)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((current) => {
            if (current.some((m) => m.id === newMessage.id)) return current;
            return [...current, newMessage];
          });

          // If the incoming message isn't ours, mark it read since the
          // thread is currently open and visible.
          if (newMessage.sender_id !== userId) {
            void markConversationRead(conversationId, userId).then(() => {
              window.dispatchEvent(new CustomEvent("messages:unread-changed"));
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((current) =>
            current.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text: string) {
    if (!userId) return;

    // Optimistic UI: show the message immediately, reconcile when the
    // Realtime INSERT event (or the direct insert response) arrives.
    const { message, error } = await sendTextMessage(conversationId, userId, text);

    if (error || !message) {
      toast.error(error || "Failed to send message.");
      return;
    }

    setMessages((current) => {
      if (current.some((m) => m.id === message.id)) return current;
      return [...current, message];
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/50 text-sm">Loading conversation...</p>
      </div>
    );
  }

  const name = displayNameFor(otherProfile);

  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top)-4rem)] flex-col bg-black text-[#ededed]">
      <div className="sticky top-[calc(64px+var(--app-status-top,0px))] z-30 flex items-center gap-3 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur xl:top-0">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Back to messages"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M15 18L9 12L15 6" />
          </svg>
        </button>
        {otherProfile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={otherProfile.avatar_url}
            alt={name}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-[rgba(127,29,29,0.45)] flex items-center justify-center text-white font-semibold text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{name}</div>
          {otherPresence && (
            <div
              className={
                otherPresence.isOnCall
                  ? "truncate text-xs font-semibold text-red-400"
                  : otherPresence.isOnline
                  ? "truncate text-xs font-semibold text-green-400"
                  : "truncate text-xs text-white/40"
              }
            >
              {formatPresenceLabel(otherPresence)}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setCallMenuOpen((open) => !open)}
            disabled={startingCall}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Start call"
            title="Start call"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
            </svg>
          </button>

          {callMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/60">
              <button
                type="button"
                onClick={() => handleStartCall(0)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <span>Free Call</span>
                <span className="text-xs font-black text-green-400">FREE</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall(1)}
                className="flex w-full items-center justify-between border-t border-gray-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <span>$1 Call</span>
                <span className="text-xs font-semibold text-gray-400">5 min</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall(5)}
                className="flex w-full items-center justify-between border-t border-gray-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <span>$5 Call</span>
                <span className="text-xs font-semibold text-gray-400">25 min</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall(10)}
                className="flex w-full items-center justify-between border-t border-gray-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <span>$10 Call</span>
                <span className="text-xs font-semibold text-gray-400">1 hour</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-white/40 text-sm text-center py-10">
            Say hello to start the conversation
          </p>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === userId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} disabled={!conversation} />
    </div>
  );
}



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
import { startPrivateCallRequest, getPrivateCallRate } from "../../../lib/privateCalls";
import { usePresenceFor, formatPresenceLabel } from "../../../hooks/usePresence";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// WhatsApp-style date divider label: "Today" / "Yesterday" / a full date.
function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

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
  const [otherCallRate, setOtherCallRate] = useState(0);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [tickStatusByMessageId, setTickStatusByMessageId] = useState<
    Record<string, "sent" | "delivered" | "read">
  >({});
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const [startingCall, setStartingCall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleStartCall = async () => {
    if (!userId || !otherProfile || startingCall) return;

    setStartingCall(true);

    const toastId = toast.loading("Calling...");

    const result = await startPrivateCallRequest({
      callerId: userId,
      target: otherProfile,
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

      if (profile?.id) {
        getPrivateCallRate(profile.id)
          .then(setOtherCallRate)
          .catch(() => setOtherCallRate(0));
      }

      const { messages: msgs, error: msgError } = await fetchMessages(conversationId);
      if (msgError) toast.error(msgError);
      setMessages(msgs);
      setLoading(false);

      await markConversationRead(conversationId, user.id);
      window.dispatchEvent(new CustomEvent("messages:unread-changed"));
    })();
  }, [conversationId, router]);

  // Ticks: message_status rows for MY OWN sent messages, as seen by the
  // other participant. A row is created (status='sent') automatically by
  // a database trigger for every message; it's updated to 'delivered'
  // globally (see useUnreadMessages) and to 'read' when they open this
  // thread (see markConversationRead below).
  useEffect(() => {
    if (!userId || !otherProfile?.id) return;

    const otherUserId = otherProfile.id;
    let mounted = true;

    async function loadTickStatuses() {
      const { data: myMessageIds } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_id", userId);

      const ids = (myMessageIds || []).map((m) => m.id);
      if (ids.length === 0) return;

      const { data: statusRows } = await supabase
        .from("message_status")
        .select("message_id, status")
        .eq("user_id", otherUserId)
        .in("message_id", ids);

      if (!mounted) return;

      const next: Record<string, "sent" | "delivered" | "read"> = {};
      (statusRows || []).forEach((row: any) => {
        next[row.message_id] = row.status;
      });

      setTickStatusByMessageId(next);
    }

    void loadTickStatuses();

    const tickChannel = supabase
      .channel(`ticks-${conversationId}-${otherUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_status",
          filter: `user_id=eq.${otherUserId}`,
        },
        (payload) => {
          const row = payload.new as { message_id: string; status: string };
          setTickStatusByMessageId((current) => ({
            ...current,
            [row.message_id]: row.status as "sent" | "delivered" | "read",
          }));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(tickChannel);
    };
  }, [conversationId, userId, otherProfile?.id]);

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

  // Typing indicator: a Broadcast channel, not a database table. Nothing
  // is ever written to Postgres for this — it's purely ephemeral, so it's
  // instant and leaves no trace once the 3-second auto-hide fires.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === userId) return;

        setOtherIsTyping(true);

        if (typingHideTimerRef.current) {
          clearTimeout(typingHideTimerRef.current);
        }

        typingHideTimerRef.current = setTimeout(() => {
          setOtherIsTyping(false);
        }, 3000);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingHideTimerRef.current) clearTimeout(typingHideTimerRef.current);
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId, userId]);

  function handleTyping() {
    // Throttle to at most once per second — no need to broadcast on
    // every single keystroke.
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 1000) return;
    lastTypingSentAtRef.current = now;

    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId },
    });
  }

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
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-muted text-sm">Loading conversation...</p>
      </div>
    );
  }

  const name = displayNameFor(otherProfile);

  return (
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top)-4rem)] flex-col bg-canvas text-white">
      <div className="sticky top-[calc(64px+var(--app-status-top,0px))] z-30 flex items-center gap-3 border-b border-hairline bg-canvas/95 px-4 py-3 backdrop-blur xl:top-0">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-white"
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
          <div className="avatar h-9 w-9 text-sm font-semibold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{name}</div>
          {otherIsTyping ? (
            <div className="truncate text-xs font-semibold text-success">
              typing...
            </div>
          ) : (
            otherPresence && (
              <div
                className={
                  otherPresence.isOnCall
                    ? "truncate text-xs font-semibold text-live"
                    : otherPresence.isOnline
                    ? "truncate text-xs font-semibold text-success"
                    : "truncate text-xs text-faint"
                }
              >
                {formatPresenceLabel(otherPresence)}
              </div>
            )
          )}
        </div>

        <button
          type="button"
          onClick={handleStartCall}
          disabled={startingCall}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:bg-surface-raised hover:text-white disabled:opacity-50"
          aria-label="Start call"
          title={otherCallRate > 0 ? `Call · $${otherCallRate.toFixed(2)}` : "Free call"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5 shrink-0"
          >
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
          </svg>
          <span className="text-xs font-bold">
            {otherCallRate > 0 ? `$${otherCallRate.toFixed(2)}` : "Free"}
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-faint text-sm text-center py-10">
            Say hello to start the conversation
          </p>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDivider =
            !previous ||
            !isSameDay(new Date(previous.created_at), new Date(message.created_at));

          return (
            <div key={message.id}>
              {showDivider && (
                <div className="sticky top-0 z-10 flex justify-center py-2">
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted shadow">
                    {formatDayLabel(message.created_at)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                isOwn={message.sender_id === userId}
                status={
                  message.sender_id === userId
                    ? tickStatusByMessageId[message.id] || "sent"
                    : undefined
                }
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} disabled={!conversation} onTyping={handleTyping} />
    </div>
  );
}

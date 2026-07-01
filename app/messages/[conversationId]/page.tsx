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

export default function MessageThreadPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;

  const [userId, setUserId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
            markConversationRead(conversationId, userId);
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
    <div className="min-h-screen bg-black text-[#ededed] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 bg-black/90 backdrop-blur z-10">
        <button onClick={() => router.push("/messages")} className="text-white/60 text-lg">
          ←
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

        <span className="font-medium">{name}</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="text-white/40 text-sm text-center py-10">
            Say hello to start the conversation 👋
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

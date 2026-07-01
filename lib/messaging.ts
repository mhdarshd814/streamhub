// lib/messaging.ts
// Shared helpers for the messaging feature (Phase 1: 1:1 text messaging).
// Mirrors the query/style conventions used in lib/attendance.ts and the
// stream_chat logic in app/live/[id]/page.tsx.

import { supabase } from "./supabase";

// ---------- Types ----------

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
  muted_until: string | null;
  is_archived: boolean;
  is_pinned: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_message_id: string | null;
  message_type: "text" | "image" | "video" | "voice" | "file" | "system";
  content: string | null;
  media_url: string | null;
  media_meta: Record<string, unknown> | null;
  is_edited: boolean;
  is_deleted: boolean;
  deleted_for: "none" | "everyone" | "sender_only";
  created_at: string;
  edited_at: string | null;
};

// Inbox row: a conversation enriched with the "other" participant's profile
// (direct chats only, for Phase 1) and an unread count.
export type ConversationListItem = {
  conversation: Conversation;
  otherProfile: Profile | null;
  lastMessage: Message | null;
  unreadCount: number;
};

// ---------- Queries ----------

/**
 * Find an existing direct conversation between the current user and
 * `otherUserId`, or create one if none exists. Direct-conversation
 * de-duplication is enforced here in app logic.
 */
export async function getOrCreateDirectConversation(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversation: Conversation | null; error: string | null }> {
  if (currentUserId === otherUserId) {
    return { conversation: null, error: "Cannot message yourself." };
  }

  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    p_other_user_id: otherUserId,
  });

  if (error || !data) {
    return {
      conversation: null,
      error: error?.message || "Failed to create conversation.",
    };
  }

  return { conversation: data as Conversation, error: null };
}

/**
 * Fetch the inbox: all conversations the user participates in, with the
 * other participant's profile (direct chats) and unread counts.
 * Phase 1 only handles "direct" conversations; group support comes in Phase 4.
 */
export async function fetchConversations(
  userId: string
): Promise<{ items: ConversationListItem[]; error: string | null }> {
  const { data: participantRows, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, is_archived")
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (participantError) {
    return { items: [], error: participantError.message };
  }

  const conversationIds = (participantRows || []).map((r) => r.conversation_id);
  if (conversationIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (convError) {
    return { items: [], error: convError.message };
  }

  // Other participants for direct chats.
  const { data: otherParticipants, error: otherError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", conversationIds)
    .neq("user_id", userId);

  if (otherError) {
    return { items: [], error: otherError.message };
  }

  const otherUserIdByConv = new Map<string, string>();
  (otherParticipants || []).forEach((row) => {
    otherUserIdByConv.set(row.conversation_id, row.user_id);
  });

  const otherUserIds = Array.from(new Set(Array.from(otherUserIdByConv.values())));

  const { data: profiles } = otherUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .in("id", otherUserIds)
    : { data: [] };

  const profileById = new Map<string, Profile>();
  (profiles || []).forEach((p) => profileById.set(p.id, p as Profile));

  // Last messages (batched).
  const lastMessageIds = (conversations || [])
    .map((c) => c.last_message_id)
    .filter((id): id is string => !!id);

  const { data: lastMessages } = lastMessageIds.length
    ? await supabase.from("messages").select("*").in("id", lastMessageIds)
    : { data: [] };

  const lastMessageById = new Map<string, Message>();
  (lastMessages || []).forEach((m) => lastMessageById.set(m.id, m as Message));

  // Unread counts (one RPC call per conversation â€” fine for Phase 1 inbox sizes;
  // can be batched into a single RPC later if needed).
  const unreadCounts = await Promise.all(
    conversationIds.map((id) =>
      supabase.rpc("get_unread_count", { p_conversation_id: id, p_user_id: userId })
    )
  );

  const unreadByConv = new Map<string, number>();
  conversationIds.forEach((id, idx) => {
    unreadByConv.set(id, (unreadCounts[idx].data as number) || 0);
  });

  const items: ConversationListItem[] = (conversations || []).map((conv) => ({
    conversation: conv as Conversation,
    otherProfile:
      conv.type === "direct"
        ? profileById.get(otherUserIdByConv.get(conv.id) || "") || null
        : null,
    lastMessage: conv.last_message_id
      ? lastMessageById.get(conv.last_message_id) || null
      : null,
    unreadCount: unreadByConv.get(conv.id) || 0,
  }));

  return { items, error: null };
}

/** Fetch a single conversation plus the other participant's profile (direct only). */
export async function fetchConversationWithProfile(
  conversationId: string,
  currentUserId: string
): Promise<{
  conversation: Conversation | null;
  otherProfile: Profile | null;
  error: string | null;
}> {
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conversation) {
    return { conversation: null, otherProfile: null, error: convError?.message || "Not found" };
  }

  if (conversation.type !== "direct") {
    return { conversation: conversation as Conversation, otherProfile: null, error: null };
  }

  const { data: otherParticipant } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", currentUserId)
    .maybeSingle();

  if (!otherParticipant) {
    return { conversation: conversation as Conversation, otherProfile: null, error: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_verified")
    .eq("id", otherParticipant.user_id)
    .maybeSingle();

  return {
    conversation: conversation as Conversation,
    otherProfile: (profile as Profile) || null,
    error: null,
  };
}

export async function fetchMessages(
  conversationId: string
): Promise<{ messages: Message[]; error: string | null }> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return { messages: [], error: error.message };
  }

  return { messages: (data || []) as Message[], error: null };
}

export async function sendTextMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToMessageId?: string | null
): Promise<{ message: Message | null; error: string | null }> {
  const trimmed = content.trim();

  if (!trimmed) {
    return { message: null, error: "Message is empty." };
  }

  const { data, error } = await supabase.rpc("send_direct_message", {
    p_conversation_id: conversationId,
    p_content: trimmed,
    p_reply_to_message_id: replyToMessageId || null,
  });

  if (error || !data) {
    return {
      message: null,
      error: error?.message || "Failed to send message.",
    };
  }

  return { message: data as Message, error: null };
}

/** Mark every unread message in a conversation as read for the given user. */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<{ error: string | null }> {
  const { data: messageIds } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);

  const ids = (messageIds || []).map((m) => m.id);
  if (ids.length === 0) return { error: null };

  const { error } = await supabase
    .from("message_status")
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("message_id", ids)
    .neq("status", "read");

  // Also bump the participant's read watermark.
  await supabase
    .from("conversation_participants")
    .update({
      last_read_message_id: ids[ids.length - 1],
      last_read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  return { error: error?.message ? { error: error.message }.error : null };
}

export function displayNameFor(profile: Profile | null | undefined): string {
  if (!profile) return "Unknown user";
  return profile.display_name || profile.username || "Unknown user";
}



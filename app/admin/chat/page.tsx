"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type ChatMessage = {
  id: string;
  stream_id: string;
  user_id: string | null;
  username: string;
  message: string;
  created_at: string;
};

type Stream = {
  id: string;
  title: string;
  status: string;
  visibility: "public" | "private";
};

export default function AdminChatPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streams, setStreams] = useState<Record<string, Stream>>({});
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadChat();
  }, []);

  async function loadChat() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("stream_chat")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const cleanMessages = (data || []) as ChatMessage[];
    setMessages(cleanMessages);

    const streamIds = [...new Set(cleanMessages.map((item) => item.stream_id))];

    if (streamIds.length > 0) {
      const { data: streamData } = await supabase
        .from("streams")
        .select("id, title, status, visibility")
        .in("id", streamIds);

      const streamMap: Record<string, Stream> = {};

      streamData?.forEach((stream) => {
        streamMap[stream.id] = stream;
      });

      setStreams(streamMap);
    }

    setLoading(false);
  }

  async function deleteMessage(messageId: string) {
    const confirmed = confirm("Delete this chat message?");
    if (!confirmed) return;

    setUpdatingId(messageId);

    const { error } = await supabase.rpc("admin_delete_chat_message", {
      target_message_id: messageId,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setMessages((current) => current.filter((item) => item.id !== messageId));
  }

  async function deleteUserHistory(userId: string | null, username: string) {
    if (!userId) {
      alert("This message has no user ID.");
      return;
    }

    const confirmed = confirm(
      `Delete all chat messages from ${username}? This cannot be undone.`
    );

    if (!confirmed) return;

    setUpdatingId(userId);

    const { error } = await supabase.rpc("admin_delete_user_chat_history", {
      target_user_id: userId,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setMessages((current) => current.filter((item) => item.user_id !== userId));
  }

  const filteredMessages = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return messages;

    return messages.filter((item) => {
      const stream = streams[item.stream_id];

      return (
        item.username?.toLowerCase().includes(value) ||
        item.message?.toLowerCase().includes(value) ||
        item.stream_id?.toLowerCase().includes(value) ||
        item.user_id?.toLowerCase().includes(value) ||
        stream?.title?.toLowerCase().includes(value)
      );
    });
  }, [messages, search, streams]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading chat moderation...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">
            Your account does not have admin permission.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              Chat <span className="text-red-500">Moderation</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Review recent messages, delete harmful messages, or clear a user's
              chat history.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              onClick={loadChat}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin Home
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Loaded Messages</p>
            <h2 className="text-3xl font-black">{messages.length}</h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Visible Results</p>
            <h2 className="text-3xl font-black text-red-500">
              {filteredMessages.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Streams In List</p>
            <h2 className="text-3xl font-black text-blue-400">
              {Object.keys(streams).length}
            </h2>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, message, stream title, stream ID, or user ID..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl">
              Recent Chat Messages
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing latest 200 messages.
            </p>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No chat messages found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredMessages.map((chat) => {
                const stream = streams[chat.stream_id];

                return (
                  <div
                    key={chat.id}
                    className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                          CHAT
                        </span>

                        {stream?.status === "live" && (
                          <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-black">
                            LIVE STREAM
                          </span>
                        )}

                        {stream?.visibility === "private" && (
                          <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-black">
                            PRIVATE
                          </span>
                        )}
                      </div>

                      <h3 className="break-words text-lg font-black">
                        {chat.username}
                      </h3>

                      <p className="mt-2 break-words rounded-xl bg-gray-800 p-4 text-sm leading-6 text-gray-200">
                        {chat.message}
                      </p>

                      <p className="mt-3 text-sm text-gray-400">
                        Stream: {stream?.title || "Unknown stream"}
                      </p>

                      <p className="mt-1 break-all text-xs text-gray-500">
                        User ID: {chat.user_id || "No user ID"}
                      </p>

                      <p className="mt-1 break-all text-xs text-gray-500">
                        Stream ID: {chat.stream_id}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Sent {new Date(chat.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[420px]">
                      <button
                        onClick={() => deleteMessage(chat.id)}
                        disabled={updatingId === chat.id}
                        className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        {updatingId === chat.id ? "Deleting..." : "Delete Message"}
                      </button>

                      <button
                        onClick={() =>
                          deleteUserHistory(chat.user_id, chat.username)
                        }
                        disabled={updatingId === chat.user_id}
                        className="rounded-xl bg-yellow-600 px-4 py-3 text-sm font-bold hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Clear User History
                      </button>

                      <Link
                        href={`/live/${chat.stream_id}`}
                        className="rounded-xl bg-gray-800 px-4 py-3 text-center text-sm font-bold hover:bg-gray-700"
                      >
                        Open Studio
                      </Link>

                      {stream?.visibility !== "private" && (
                        <Link
                          href={`/watch/${chat.stream_id}`}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold hover:bg-blue-700"
                        >
                          Open Watch
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

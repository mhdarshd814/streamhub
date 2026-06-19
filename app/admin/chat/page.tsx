"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ChatMessage = {
  id: string;
  stream_id: string;
  username: string;
  message: string;
  created_at: string;
};

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadChat() {
    setLoading(true);

    const { data, error } = await supabase
      .from("stream_chat")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setMessages(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadChat();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Global Chat</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadChat}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/admin" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
              Back to Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading chat messages...</div>
        ) : messages.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No chat messages yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 max-h-[70vh] overflow-auto">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="border border-white/10 rounded-2xl p-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span className="font-bold text-red-400">{msg.username}</span>
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p>{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
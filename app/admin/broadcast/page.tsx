"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function createBroadcast() {
    if (!title.trim()) {
      alert("Please enter a broadcast title");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("admin_broadcasts")
      .insert([
        {
          title: title.trim(),
          description: description.trim(),
          status: "scheduled",
        },
      ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Broadcast created successfully!");
    setTitle("");
    setDescription("");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
          <h1 className="text-5xl font-black tracking-tighter">Create Broadcast</h1>
        </div>

        <div className="premium-glass rounded-3xl p-10">
          <div className="space-y-8">
            <div>
              <label className="block text-sm text-gray-400 mb-3">Broadcast Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500"
                placeholder="Official StreamHub Broadcast"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500"
                placeholder="What is this broadcast about?"
              />
            </div>

            <button
              onClick={createBroadcast}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500 disabled:bg-gray-700"
            >
              {loading ? "Creating..." : "Create Broadcast"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
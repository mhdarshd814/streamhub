"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function GoLivePage() {
  const [title, setTitle] = useState("Live Now");
  const [category, setCategory] = useState("Live");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [privateCallPrice, setPrivateCallPrice] = useState("0");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }
  }

  function selectVisibility(nextVisibility: "public" | "private") {
    setVisibility(nextVisibility);
    if (nextVisibility === "public") {
      setTitle("Live Now");
      setCategory("Live");
    } else {
      setTitle("Private Call");
      setCategory("Private Call");
    }
  }

  async function uploadThumbnail(file: File) {
    // Keep your existing upload logic
    // ...
  }

  async function handleStartStream() {
    // Keep your existing start logic
    // ...
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">GO LIVE</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Start Broadcasting</h1>
          <p className="mt-3 text-gray-400">Choose Public or Private Call. Everything else is optional.</p>
        </div>

        <div className="premium-glass rounded-3xl p-8">
          <div className="grid grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => selectVisibility("public")}
              className={`py-6 rounded-2xl font-black text-xl ${visibility === "public" ? "bg-red-600" : "bg-gray-800"}`}
            >
              Public Stream
            </button>
            <button
              onClick={() => selectVisibility("private")}
              className={`py-6 rounded-2xl font-black text-xl ${visibility === "private" ? "bg-purple-600" : "bg-gray-800"}`}
            >
              Private Call
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 mb-3">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-xl outline-none focus:border-red-500"
              />
            </div>

            {visibility === "private" && (
              <div>
                <label className="block text-sm text-gray-400 mb-3">Call Price</label>
                <select
                  value={privateCallPrice}
                  onChange={(e) => setPrivateCallPrice(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5"
                >
                  <option value="0">Free</option>
                  <option value="5">$5</option>
                  <option value="10">$10</option>
                  <option value="25">$25</option>
                  <option value="50">$50</option>
                </select>
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={saving || uploading}
              className="w-full py-6 rounded-3xl bg-red-600 text-xl font-black hover:bg-red-500"
            >
              {saving ? "Starting..." : visibility === "private" ? "Create Private Call" : "Go Live"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
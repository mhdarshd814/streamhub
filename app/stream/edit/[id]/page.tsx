"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function EditStreamPage() {
  const [streamId, setStreamId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadStream() {
      const id = window.location.pathname.split("/").pop();

      if (!id) {
        alert("Stream ID missing.");
        return;
      }

      setStreamId(id);

      const { data, error } = await supabase
        .from("streams")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      setTitle(data.title || "");
      setCategory(data.category || "");
      setThumbnailUrl(data.thumbnail_url || "");
    }

    loadStream();
  }, []);

  async function uploadThumbnail(file: File) {
    // Keep your existing upload logic
    // ...
  }

  async function saveStream() {
    // Keep your existing save logic
    // ...
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-red-400 hover:text-red-300">
          ← Back to Dashboard
        </Link>

        <div className="premium-glass rounded-3xl p-10">
          <h1 className="text-4xl font-black mb-8">Edit Stream</h1>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <label className="block text-sm text-gray-400 mb-3">Stream Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500">
                  <option value="">Select Category</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Music">Music</option>
                  <option value="Sports">Sports</option>
                  <option value="Education">Education</option>
                  <option value="Technology">Technology</option>
                  <option value="Travel">Travel</option>
                  <option value="Food">Food</option>
                  <option value="Lifestyle">Lifestyle</option>
                  <option value="News">News</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">Thumbnail</label>
              <div className="mb-6">
                <div className="h-56 w-full rounded-2xl overflow-hidden border border-white/20">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} className="object-cover h-full w-full" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-800 text-6xl">📷</div>
                  )}
                </div>
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadThumbnail(file);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm"
              />
            </div>
          </div>

          <button onClick={saveStream} disabled={uploading} className="mt-10 w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500">
            Save Stream
          </button>
        </div>
      </div>
    </main>
  );
}
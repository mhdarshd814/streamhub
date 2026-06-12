"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

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
    const maxSize = 500 * 1024;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, PNG and WEBP images are allowed.");
      return;
    }

    if (file.size > maxSize) {
      alert("Thumbnail image must be less than 500 KB.");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `thumbnail-${streamId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        alert(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      setThumbnailUrl(data.publicUrl);
      alert("Thumbnail uploaded successfully!");
    } catch (error: any) {
      alert(error.message || "Thumbnail upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveStream() {
    if (!streamId) {
      alert("Stream not loaded yet.");
      return;
    }

    if (!title.trim() || !category) {
      alert("Title and category are required.");
      return;
    }

    const { error } = await supabase
      .from("streams")
      .update({
        title: title.trim(),
        category,
        thumbnail_url: thumbnailUrl || null,
      })
      .eq("id", streamId);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Stream updated successfully!");
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <button
        onClick={() => {
          window.location.href = "/dashboard";
        }}
        className="bg-gray-800 px-5 py-3 rounded-lg mb-8 hover:bg-gray-700"
      >
        Back to Dashboard
      </button>

      <div className="bg-gray-900 p-8 rounded-xl max-w-xl">
        <h1 className="text-4xl font-bold mb-8">Edit Stream</h1>

        <label className="block mb-2 text-gray-400">Stream Title</label>
        <input
          placeholder="Stream Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 mb-5 rounded bg-gray-800"
        />

        <label className="block mb-2 text-gray-400">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-3 mb-5 rounded bg-gray-800"
        >
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
          <option value="Podcast">Podcast</option>
          <option value="Kids">Kids</option>
        </select>

        <label className="block mb-2 text-gray-400">
          Stream Thumbnail Max 500 KB
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              uploadThumbnail(file);
            }
          }}
          className="w-full p-3 mb-5 rounded bg-gray-800"
        />

        {uploading && (
          <p className="text-gray-400 mb-5">Uploading thumbnail...</p>
        )}

        {thumbnailUrl && (
          <div className="mb-5">
            <p className="text-gray-400 mb-2">Thumbnail Preview</p>

            <img
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="w-full h-52 rounded-lg object-cover bg-gray-700"
            />
          </div>
        )}

        <button
          onClick={saveStream}
          disabled={uploading}
          className="bg-red-600 px-6 py-3 rounded hover:bg-red-700 disabled:bg-gray-600"
        >
          {uploading ? "Uploading..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
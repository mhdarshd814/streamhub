"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type StreamVisibility = "public" | "private" | "subscribers";

export default function GoLivePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<StreamVisibility>("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

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

    const { data, error } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setCheckingAccess(false);
      return;
    }

    if (data?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    setCheckingAccess(false);
  }

  function selectVisibility(nextVisibility: StreamVisibility) {
    setVisibility(nextVisibility);

    if (nextVisibility === "private") {
      setCategory("Private Call");
      if (!title.trim()) setTitle("Private One-on-One Call");
    }

    if (nextVisibility === "subscribers") {
      setCategory("Subscribers Only");
      if (!title.trim()) setTitle("Premium Subscriber Stream");
    }
  }

  async function uploadThumbnail(file: File) {
    const maxSize = 500 * 1024;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

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
      const fileName = `thumbnail-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        alert(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from("thumbnails")
        .getPublicUrl(fileName);

      setThumbnailUrl(data.publicUrl);
    } catch (error: any) {
      alert(error.message || "Thumbnail upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleStartStream() {
    if (!title.trim() || !category) {
      alert("Please enter title and select category.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      alert("Please login first.");
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setSaving(false);
      alert(profileError.message);
      return;
    }

    if (profileData?.is_banned) {
      setSaving(false);
      window.location.href = "/banned";
      return;
    }

    const { data, error } = await supabase
      .from("streams")
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          category,
          description: description.trim() || null,
          tags: tags.trim() || null,
          visibility,
          thumbnail_url: thumbnailUrl || null,
          status: "offline",
        },
      ])
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      visibility === "private"
        ? "Private one-on-one call room created. Invite a guest from the studio."
        : visibility === "subscribers"
        ? "Subscriber-only stream created successfully."
        : "Public stream created successfully."
    );

    window.location.href = `/live/${data.id}`;
  }

  const visibilityLabel =
    visibility === "private"
      ? "Private one-on-one call"
      : visibility === "subscribers"
      ? "Subscribers-only stream"
      : "Public live stream";

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Checking account access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 lg:mb-10">
          <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
            Creator Studio
          </p>

          <h1 className="mb-3 text-3xl font-black sm:text-4xl lg:text-5xl">
            Create <span className="text-red-500">Live Content</span>
          </h1>

          <p className="max-w-3xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
            Create a public stream, subscriber-only broadcast, or private
            one-on-one video call.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:col-span-2 lg:p-8">
            <h2 className="mb-6 text-2xl font-black sm:text-3xl">
              Session Details
            </h2>

            <label className="mb-3 block text-sm font-semibold text-gray-300 sm:text-base">
              Select Type
            </label>

            <div className="mb-6 grid gap-3 md:grid-cols-3 md:gap-4">
              <button
                type="button"
                onClick={() => selectVisibility("public")}
                className={
                  visibility === "public"
                    ? "rounded-2xl border border-red-600 bg-red-600/10 p-4 text-left sm:p-5"
                    : "rounded-2xl border border-gray-700 bg-gray-800 p-4 text-left hover:border-gray-500 sm:p-5"
                }
              >
                <div className="mb-3 text-3xl">🌍</div>
                <h3 className="mb-2 text-lg font-black">Public Stream</h3>
                <p className="text-sm leading-6 text-gray-400">
                  Visible on Explore and Following pages.
                </p>
              </button>

              <button
                type="button"
                onClick={() => selectVisibility("private")}
                className={
                  visibility === "private"
                    ? "rounded-2xl border border-purple-500 bg-purple-500/10 p-4 text-left sm:p-5"
                    : "rounded-2xl border border-gray-700 bg-gray-800 p-4 text-left hover:border-gray-500 sm:p-5"
                }
              >
                <div className="mb-3 text-3xl">📞</div>
                <h3 className="mb-2 text-lg font-black">Private Call</h3>
                <p className="text-sm leading-6 text-gray-400">
                  One-on-one video call. Hidden from public pages.
                </p>
              </button>

              <button
                type="button"
                onClick={() => selectVisibility("subscribers")}
                className={
                  visibility === "subscribers"
                    ? "rounded-2xl border border-yellow-500 bg-yellow-500/10 p-4 text-left sm:p-5"
                    : "rounded-2xl border border-gray-700 bg-gray-800 p-4 text-left hover:border-gray-500 sm:p-5"
                }
              >
                <div className="mb-3 text-3xl">⭐</div>
                <h3 className="mb-2 text-lg font-black">Subscribers Only</h3>
                <p className="text-sm leading-6 text-gray-400">
                  Only active subscribers can watch and chat.
                </p>
              </button>
            </div>

            <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
              Title
            </label>
            <input
              placeholder={
                visibility === "private"
                  ? "Example: Private one-on-one call with Ahmed"
                  : visibility === "subscribers"
                  ? "Example: Premium Q&A for subscribers"
                  : "Example: Late Night Gaming Live"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-5 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
            />

            <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-5 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
            >
              <option value="">Select Category</option>
              <option value="Private Call">Private Call</option>
              <option value="One-on-One Call">One-on-One Call</option>
              <option value="Subscribers Only">Subscribers Only</option>
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

            <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
              Description
            </label>
            <textarea
              placeholder={
                visibility === "private"
                  ? "Optional private call notes..."
                  : visibility === "subscribers"
                  ? "Tell subscribers what premium content they will get..."
                  : "Tell viewers what this stream is about..."
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mb-5 h-28 w-full resize-none rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:h-32 sm:p-4 sm:text-base"
            />

            <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
              Tags
            </label>
            <input
              placeholder={
                visibility === "private"
                  ? "private, call, meeting"
                  : "gaming, live, fun, tutorial"
              }
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mb-6 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
            />

            {visibility === "private" && (
              <div className="mb-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 sm:p-5">
                <h3 className="mb-2 text-lg font-black text-purple-300">
                  Private Call Rules
                </h3>
                <p className="text-sm leading-6 text-gray-300">
                  This room will not appear on Explore or Following pages. After
                  creating it, open the studio and invite one guest. Both users
                  will publish camera and microphone inside the same LiveKit
                  room.
                </p>
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={uploading || saving}
              className="w-full rounded-xl bg-red-600 px-6 py-4 text-base font-bold hover:bg-red-700 disabled:bg-gray-700 sm:w-auto sm:px-8 sm:text-lg"
            >
              {saving
                ? "Creating..."
                : visibility === "private"
                ? "Create Private Call Room"
                : visibility === "subscribers"
                ? "Create Subscribers-only Stream"
                : "Create Public Stream"}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-8">
            <h2 className="mb-6 text-2xl font-black sm:text-3xl">
              Thumbnail
            </h2>

            <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
              Upload Thumbnail Max 500 KB
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadThumbnail(file);
              }}
              className="mb-5 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white sm:p-4"
            />

            {uploading && (
              <p className="mb-5 text-sm text-gray-400">
                Uploading thumbnail...
              </p>
            )}

            <div className="mb-6 flex h-52 items-center justify-center overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 sm:h-64">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <p className="mb-3 text-5xl">
                    {visibility === "private"
                      ? "📞"
                      : visibility === "subscribers"
                      ? "⭐"
                      : "📺"}
                  </p>
                  <p>No thumbnail uploaded</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-gray-800 p-4 sm:p-5">
              <p className="mb-2 text-sm text-gray-400">Preview</p>

              <h3 className="mb-2 break-words text-lg font-black sm:text-xl">
                {title || "Your session title"}
              </h3>

              <p className="mb-2 text-sm text-gray-400 sm:text-base">
                {category || "Category"}
              </p>

              <p
                className={
                  visibility === "private"
                    ? "text-sm font-semibold text-purple-400"
                    : visibility === "subscribers"
                    ? "text-sm font-semibold text-yellow-300"
                    : "text-sm font-semibold text-green-400"
                }
              >
                {visibilityLabel}
              </p>

              {visibility === "private" && (
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Hidden from public pages. Only invited guest can join.
                </p>
              )}

              {visibility === "subscribers" && (
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Only users with active subscription can access the watch page.
                </p>
              )}

              {visibility === "public" && (
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  Visible to followers and public viewers.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
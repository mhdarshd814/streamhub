"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type StreamVisibility = "public" | "private" | "subscribers";

export default function GoLivePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Entertainment");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<StreamVisibility>("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [privateCallPriceOption, setPrivateCallPriceOption] = useState("25");
  const [customPrivateCallPrice, setCustomPrivateCallPrice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

    if (nextVisibility === "public") {
      setCategory("Entertainment");
    }

    if (nextVisibility === "private") {
      setCategory("Private Call");
      if (!title.trim()) setTitle("Private One-on-One Call");
    }

    if (nextVisibility === "subscribers") {
      setCategory("Subscribers Only");
      if (!title.trim()) setTitle("Premium Subscriber Stream");
    }
  }

  function getPrivateCallPriceAmount() {
    if (visibility !== "private") return 0;

    if (privateCallPriceOption === "custom") {
      return Number(customPrivateCallPrice);
    }

    return Number(privateCallPriceOption);
  }

  function getDefaultTitle() {
    if (title.trim()) return title.trim();

    if (visibility === "private") return "Private One-on-One Call";
    if (visibility === "subscribers") return "Premium Subscriber Stream";

    return "Live Stream";
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
    if (saving || uploading) return;

    const priceAmount = getPrivateCallPriceAmount();

    if (
      visibility === "private" &&
      privateCallPriceOption === "custom" &&
      customPrivateCallPrice.trim() === ""
    ) {
      alert("Please enter a custom private call price.");
      return;
    }

    if (
      visibility === "private" &&
      (Number.isNaN(priceAmount) || priceAmount < 0)
    ) {
      alert("Please enter a valid private call price.");
      return;
    }

    if (visibility === "private" && priceAmount > 5000) {
      alert("Private call price cannot be more than AED 5,000.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
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
          title: getDefaultTitle(),
          category: category || "Entertainment",
          description: description.trim() || null,
          tags: tags.trim() || null,
          visibility,
          thumbnail_url: thumbnailUrl || null,
          private_call_price: priceAmount,
          status: "offline",
        },
      ])
      .select()
      .single();

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    window.location.href = `/live/${data.id}`;
  }

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Opening creator studio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-28 pt-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="mb-2 text-sm font-bold text-red-400">StreamHub Live</p>
          <h1 className="text-3xl font-black sm:text-4xl">
            Go <span className="text-red-500">Live</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Fast mobile setup. Choose type, tap Go Live, then start your camera.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-gray-900 p-2">
          <button
            type="button"
            onClick={() => selectVisibility("public")}
            className={
              visibility === "public"
                ? "rounded-xl bg-red-600 px-3 py-4 text-sm font-black"
                : "rounded-xl bg-gray-800 px-3 py-4 text-sm font-bold text-gray-300"
            }
          >
            Public
          </button>

          <button
            type="button"
            onClick={() => selectVisibility("private")}
            className={
              visibility === "private"
                ? "rounded-xl bg-purple-600 px-3 py-4 text-sm font-black"
                : "rounded-xl bg-gray-800 px-3 py-4 text-sm font-bold text-gray-300"
            }
          >
            Call
          </button>

          <button
            type="button"
            onClick={() => selectVisibility("subscribers")}
            className={
              visibility === "subscribers"
                ? "rounded-xl bg-yellow-500 px-3 py-4 text-sm font-black text-black"
                : "rounded-xl bg-gray-800 px-3 py-4 text-sm font-bold text-gray-300"
            }
          >
            Subs
          </button>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4 shadow-2xl sm:p-6">
          <label className="mb-2 block text-sm font-bold text-gray-300">
            Title optional
          </label>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              visibility === "private"
                ? "Private call title"
                : visibility === "subscribers"
                ? "Subscriber live title"
                : "What are you live about?"
            }
            className="mb-4 w-full rounded-2xl border border-gray-800 bg-black px-4 py-4 text-base outline-none focus:border-red-500"
          />

          {visibility === "private" && (
            <div className="mb-4 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
              <label className="mb-2 block text-sm font-black text-purple-300">
                Private call price
              </label>

              <select
                value={privateCallPriceOption}
                onChange={(e) => {
                  setPrivateCallPriceOption(e.target.value);
                  if (e.target.value !== "custom") {
                    setCustomPrivateCallPrice("");
                  }
                }}
                className="w-full rounded-xl border border-purple-500/20 bg-black p-3 text-white outline-none"
              >
                <option value="0">Free</option>
                <option value="25">AED 25</option>
                <option value="50">AED 50</option>
                <option value="100">AED 100</option>
                <option value="250">AED 250</option>
                <option value="500">AED 500</option>
                <option value="1000">AED 1000</option>
                <option value="custom">Custom</option>
              </select>

              {privateCallPriceOption === "custom" && (
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={customPrivateCallPrice}
                  onChange={(e) => setCustomPrivateCallPrice(e.target.value)}
                  placeholder="Enter amount"
                  className="mt-3 w-full rounded-xl border border-purple-500/20 bg-black p-3 text-white outline-none"
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="mb-4 w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm font-bold text-gray-300"
          >
            {advancedOpen ? "Hide Advanced Options" : "Advanced Options"}
          </button>

          {advancedOpen && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl border border-gray-800 bg-black p-4 outline-none focus:border-red-500"
                >
                  <option value="Entertainment">Entertainment</option>
                  <option value="Gaming">Gaming</option>
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
                  <option value="Private Call">Private Call</option>
                  <option value="Subscribers Only">Subscribers Only</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional stream description"
                  className="h-24 w-full resize-none rounded-2xl border border-gray-800 bg-black p-4 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Tags
                </label>

                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="gaming, live, music"
                  className="w-full rounded-2xl border border-gray-800 bg-black p-4 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Thumbnail optional
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadThumbnail(file);
                  }}
                  className="w-full rounded-2xl border border-gray-800 bg-black p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                />

                {uploading && (
                  <p className="mt-2 text-sm text-gray-400">
                    Uploading thumbnail...
                  </p>
                )}
              </div>

              {thumbnailUrl && (
                <div className="overflow-hidden rounded-2xl border border-gray-800">
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail preview"
                    className="h-44 w-full object-cover"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-black/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={handleStartStream}
              disabled={saving || uploading}
              className="w-full rounded-full bg-red-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:bg-gray-700"
            >
              {saving
                ? "Opening Studio..."
                : visibility === "private"
                ? "Create Call Room"
                : "Go Live Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type StreamVisibility = "public" | "private";

const DEFAULT_PUBLIC_TITLE = "Live Now";
const DEFAULT_PRIVATE_TITLE = "Private Call";

export default function GoLivePage() {
  const [title, setTitle] = useState(DEFAULT_PUBLIC_TITLE);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [category, setCategory] = useState("Live");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<StreamVisibility>("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [privateCallPriceOption, setPrivateCallPriceOption] = useState("0");
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
      setCategory("Live");

      if (!userEditedTitle || title === DEFAULT_PRIVATE_TITLE) {
        setTitle(DEFAULT_PUBLIC_TITLE);
        setUserEditedTitle(false);
      }
    }

    if (nextVisibility === "private") {
      setCategory("Private Call");

      if (!userEditedTitle || title === DEFAULT_PUBLIC_TITLE) {
        setTitle(DEFAULT_PRIVATE_TITLE);
        setUserEditedTitle(false);
      }
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setUserEditedTitle(
      value.trim() !== "" &&
        value !== DEFAULT_PUBLIC_TITLE &&
        value !== DEFAULT_PRIVATE_TITLE
    );
  }

  function getPrivateCallPriceAmount() {
    if (visibility !== "private") return 0;

    if (privateCallPriceOption === "custom") {
      return Number(customPrivateCallPrice);
    }

    return Number(privateCallPriceOption);
  }

  function getDefaultTitle() {
    const cleanTitle = title.trim();

    if (cleanTitle) return cleanTitle;

    return visibility === "private" ? DEFAULT_PRIVATE_TITLE : DEFAULT_PUBLIC_TITLE;
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

      const { data } = supabase.storage.from("thumbnails").getPublicUrl(fileName);
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

    if (visibility === "private" && (Number.isNaN(priceAmount) || priceAmount < 0)) {
      alert("Please enter a valid private call price.");
      return;
    }

    if (visibility === "private" && priceAmount > 100) {
      alert("Private call price cannot be more than $100.");
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
          category: category || "Live",
          description: description.trim() || null,
          tags: null,
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
    <div className="min-h-screen bg-black px-4 pb-32 pt-5 text-white sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-red-400">
            StreamHub Creator Studio
          </p>

          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            Start your <span className="text-red-500">live room</span>
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            Choose public live, private call, or schedule a stream.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-gray-800 bg-gray-950 p-2">
          <button
            type="button"
            onClick={() => selectVisibility("public")}
            className={
              visibility === "public"
                ? "rounded-xl bg-red-600 px-3 py-5 text-base font-black text-white shadow-md shadow-red-600/20"
                : "rounded-xl bg-black px-3 py-5 text-base font-bold text-gray-300 hover:bg-gray-900"
            }
          >
            Public Live
          </button>

          <button
            type="button"
            onClick={() => selectVisibility("private")}
            className={
              visibility === "private"
                ? "rounded-xl bg-red-600 px-3 py-5 text-base font-black text-white shadow-md shadow-red-600/20"
                : "rounded-xl bg-black px-3 py-5 text-base font-bold text-gray-300 hover:bg-gray-900"
            }
          >
            Private Call
          </button>
        </div>

        <button
          type="button"
          onClick={() => (window.location.href = "/schedule")}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 px-5 py-4 text-base font-black text-white transition hover:border-red-600 hover:bg-gray-800"
        >
          <span aria-hidden="true">??</span>
          <span>Schedule Stream</span>
        </button>

        <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4 shadow-2xl sm:p-6">
          <div className="mb-4 rounded-2xl border border-gray-800 bg-black p-4">
            <p className="text-sm font-bold text-red-400">
              {visibility === "private" ? "Private Call Room" : "Public Live Stream"}
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {visibility === "private" ? "Set up a private call" : "Public room ready"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              {visibility === "private"
                ? "Set your call price, open the room, then invite or wait for the viewer."
                : "Review optional settings, then start your public live room."}
            </p>
          </div>

          {visibility === "private" && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <label className="mb-2 block text-sm font-black text-red-300">
                Call price
              </label>

              <select
                value={privateCallPriceOption}
                onChange={(e) => {
                  setPrivateCallPriceOption(e.target.value);
                  if (e.target.value !== "custom") setCustomPrivateCallPrice("");
                }}
                className="w-full rounded-xl border border-red-500/20 bg-black p-3 text-white outline-none focus:border-red-500"
              >
                <option value="0">Free</option>
                <option value="1">$1 Fan</option>
                <option value="3">$3 Premium</option>
                <option value="5">$5 VIP</option>
                <option value="10">$10 Creator Pro</option>
                <option value="custom">Custom</option>
              </select>

              {privateCallPriceOption === "custom" && (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={customPrivateCallPrice}
                  onChange={(e) => setCustomPrivateCallPrice(e.target.value)}
                  placeholder="Enter amount"
                  className="mt-3 w-full rounded-xl border border-red-500/20 bg-black p-3 text-white outline-none focus:border-red-500"
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="mb-4 w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm font-bold text-gray-300 hover:bg-gray-800"
          >
            {advancedOpen ? "Hide Optional Settings" : "Optional Settings"}
          </button>

          {advancedOpen && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Title optional
                </label>

                <input
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={
                    visibility === "private"
                      ? "Private call title"
                      : "What are you live about?"
                  }
                  className="w-full rounded-2xl border border-gray-800 bg-black px-4 py-4 text-base outline-none focus:border-red-500"
                />
              </div>

              {visibility === "public" && (
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-300">
                    Category optional
                  </label>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-gray-800 bg-black p-4 outline-none focus:border-red-500"
                  >
                    <option value="Live">Live</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Education">Education</option>
                    <option value="Lifestyle">Lifestyle</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Description optional
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

          {(
            <button
              onClick={handleStartStream}
              disabled={saving || uploading}
              className="mt-5 w-full rounded-full bg-red-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:bg-gray-700"
            >
              {saving ? "Opening..." : visibility === "private" ? "Start Private Call" : "Start Public Live"}
            </button>
            )}
        </div>
      </div>
    </div>
  );
}



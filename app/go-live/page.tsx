"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type StreamVisibility = "public" | "private";

const DEFAULT_PUBLIC_TITLE = "Live Now";

const RATE_PRESETS = ["0", "1", "3", "5", "10"];

export default function GoLivePage() {
  const [title, setTitle] = useState(DEFAULT_PUBLIC_TITLE);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [category, setCategory] = useState("Live");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<StreamVisibility>("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Private call rate: this is a profile setting now, not a per-session
  // price. Whatever you set here is what anyone pays when THEY call YOU
  // (via Messages) — this tab never creates or opens a call room itself.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [savedRate, setSavedRate] = useState(0);
  const [rateOption, setRateOption] = useState("0");
  const [customRate, setCustomRate] = useState("");
  const [loadingRate, setLoadingRate] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [rateSavedJustNow, setRateSavedJustNow] = useState(false);

  const [availabilityEnabled, setAvailabilityEnabled] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("18:00");
  const [availableUntil, setAvailableUntil] = useState("22:00");

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
      .select(
        "is_banned, private_call_rate, call_availability_enabled, call_available_from, call_available_until"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setCheckingAccess(false);
      setLoadingRate(false);
      return;
    }

    if (data?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    setCurrentUserId(user.id);

    const rate = Number(data?.private_call_rate || 0);
    setSavedRate(rate);

    if (RATE_PRESETS.includes(String(rate))) {
      setRateOption(String(rate));
    } else if (rate > 0) {
      setRateOption("custom");
      setCustomRate(String(rate));
    }

    setAvailabilityEnabled(!!data?.call_availability_enabled);
    // Postgres `time` columns come back as "HH:MM:SS" - trim to "HH:MM"
    // for the <input type="time"> fields.
    if (data?.call_available_from) {
      setAvailableFrom(String(data.call_available_from).slice(0, 5));
    }
    if (data?.call_available_until) {
      setAvailableUntil(String(data.call_available_until).slice(0, 5));
    }

    setCheckingAccess(false);
    setLoadingRate(false);
  }

  function selectVisibility(nextVisibility: StreamVisibility) {
    setVisibility(nextVisibility);

    if (nextVisibility === "public") {
      setCategory("Live");

      if (!userEditedTitle) {
        setTitle(DEFAULT_PUBLIC_TITLE);
        setUserEditedTitle(false);
      }
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setUserEditedTitle(value.trim() !== "" && value !== DEFAULT_PUBLIC_TITLE);
  }

  function getDefaultTitle() {
    const cleanTitle = title.trim();
    return cleanTitle || DEFAULT_PUBLIC_TITLE;
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
          visibility: "public",
          thumbnail_url: thumbnailUrl || null,
          private_call_price: 0,
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

  function getRateAmount() {
    if (rateOption === "custom") return Number(customRate);
    return Number(rateOption);
  }

  async function handleSaveRate() {
    if (savingRate || !currentUserId) return;

    const amount = getRateAmount();

    if (rateOption === "custom" && customRate.trim() === "") {
      alert("Please enter a custom rate.");
      return;
    }

    if (Number.isNaN(amount) || amount < 0) {
      alert("Please enter a valid rate.");
      return;
    }

    if (amount > 100) {
      alert("Rate cannot be more than $100.");
      return;
    }

    if (availabilityEnabled && (!availableFrom || !availableUntil)) {
      alert("Please set both a start and end time for your availability window.");
      return;
    }

    setSavingRate(true);
    setRateSavedJustNow(false);

    const { error } = await supabase
      .from("profiles")
      .update({
        private_call_rate: amount,
        call_availability_enabled: availabilityEnabled,
        call_available_from: availabilityEnabled ? availableFrom : null,
        call_available_until: availabilityEnabled ? availableUntil : null,
      })
      .eq("id", currentUserId);

    setSavingRate(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSavedRate(amount);
    setRateSavedJustNow(true);
    setTimeout(() => setRateSavedJustNow(false), 2500);
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
            Choose public live, set your private call rate, or schedule a stream.
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
            Private Call Rate
          </button>
        </div>

        <button
          type="button"
          onClick={() => (window.location.href = "/schedule")}
          className="mb-5 w-full rounded-2xl border border-gray-800 bg-gray-950 px-5 py-4 text-base font-black text-white transition hover:border-red-600 hover:bg-gray-900"
        >
          <span>Schedule Stream</span>
        </button>

        {visibility === "private" ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4 shadow-2xl sm:p-6">
            <div className="mb-4 rounded-2xl border border-gray-800 bg-black p-4">
              <p className="text-sm font-bold text-red-400">Private Call Rate</p>

              <h2 className="mt-2 text-2xl font-black">Set your call rate</h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                This is what people pay when THEY call YOU from Messages.
                There's nothing to start here — calls begin when someone
                reaches out. Set to Free to allow calls at no charge.
              </p>

              {savedRate > 0 && (
                <p className="mt-3 text-sm font-bold text-green-400">
                  Current rate: ${savedRate.toFixed(2)}
                </p>
              )}
              {savedRate === 0 && !loadingRate && (
                <p className="mt-3 text-sm font-bold text-gray-400">
                  Current rate: Free
                </p>
              )}
            </div>

            {loadingRate ? (
              <p className="text-sm text-gray-400">Loading your rate...</p>
            ) : (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <label className="mb-2 block text-sm font-black text-red-300">
                  Your rate
                </label>

                <select
                  value={rateOption}
                  onChange={(e) => {
                    setRateOption(e.target.value);
                    if (e.target.value !== "custom") setCustomRate("");
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

                {rateOption === "custom" && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    placeholder="Enter amount"
                    className="mt-3 w-full rounded-xl border border-red-500/20 bg-black p-3 text-white outline-none focus:border-red-500"
                  />
                )}

                <div className="mt-5 rounded-2xl border border-gray-800 bg-black p-4">
                  <label className="flex cursor-pointer items-center justify-between">
                    <span>
                      <span className="block text-sm font-black text-white">
                        Availability Hours
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-400">
                        Only allow calls during set hours. Off means always available.
                      </span>
                    </span>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={availabilityEnabled}
                      onClick={() => setAvailabilityEnabled((current) => !current)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                        availabilityEnabled ? "bg-red-600" : "bg-gray-700"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          availabilityEnabled ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </label>

                  {availabilityEnabled && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-400">
                          From
                        </label>
                        <input
                          type="time"
                          value={availableFrom}
                          onChange={(e) => setAvailableFrom(e.target.value)}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 p-3 text-white outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-gray-400">
                          Until
                        </label>
                        <input
                          type="time"
                          value={availableUntil}
                          onChange={(e) => setAvailableUntil(e.target.value)}
                          className="w-full rounded-xl border border-gray-800 bg-gray-950 p-3 text-white outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  )}

                  {availabilityEnabled && (
                    <p className="mt-3 text-xs leading-5 text-gray-500">
                      Times are in UTC. A window like 22:00–02:00 correctly
                      spans past midnight.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveRate}
                  disabled={savingRate}
                  className="mt-4 w-full rounded-full bg-red-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:bg-gray-700"
                >
                  {savingRate
                    ? "Saving..."
                    : rateSavedJustNow
                    ? "Rate Saved ✓"
                    : "Save Rate"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4 shadow-2xl sm:p-6">
            <div className="mb-4 rounded-2xl border border-gray-800 bg-black p-4">
              <p className="text-sm font-bold text-red-400">Public Live Stream</p>

              <h2 className="mt-2 text-2xl font-black">Public room ready</h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Review optional settings, then start your public live room.
              </p>
            </div>

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
                    placeholder="What are you live about?"
                    className="w-full rounded-2xl border border-gray-800 bg-black px-4 py-4 text-base outline-none focus:border-red-500"
                  />
                </div>

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

            <button
              onClick={handleStartStream}
              disabled={saving || uploading}
              className="mt-5 w-full rounded-full bg-red-600 px-6 py-4 text-lg font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:bg-gray-700"
            >
              {saving ? "Opening..." : "Start Public Live"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function EditProfilePage() {
  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      alert(error.message);
      setCheckingAccess(false);
      return;
    }

    if (data?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    setProfileId(data.id);
    setUsername(data.username || "");
    setDisplayName(data.display_name || "");
    setAvatarUrl(data.avatar_url || "");
    setBio(data.bio || "");
    setCheckingAccess(false);
  }

  async function uploadAvatar(file: File) {
    if (!profileId) {
      alert("Profile not loaded yet.");
      return;
    }

    const maxSize = 200 * 1024;

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
      alert("Avatar image must be less than 200 KB.");
      return;
    }

    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploading(false);
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        alert(profileError.message);
        setUploading(false);
        return;
      }

      if (profileData?.is_banned) {
        setUploading(false);
        window.location.href = "/banned";
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${profileId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        alert(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);

      setAvatarUrl(data.publicUrl);
      alert("Avatar uploaded successfully!");
    } catch (error: any) {
      alert(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!profileId) {
      alert("Profile not loaded yet.");
      return;
    }

    if (!username.trim()) {
      alert("Username is required.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileCheckError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileCheckError) {
      alert(profileCheckError.message);
      return;
    }

    if (profileData?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        display_name: displayName.trim(),
        avatar_url: avatarUrl || null,
        bio: bio.trim() || null,
      })
      .eq("id", profileId);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Profile updated successfully!");
    window.location.href = "/profile";
  }

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Checking account access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => {
            window.location.href = "/profile";
          }}
          className="mb-6 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:mb-8 sm:text-base"
        >
          Back to Profile
        </button>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-8">
          <div className="mb-7">
            <p className="mb-2 text-sm font-semibold text-red-400">
              Creator Profile
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              Edit <span className="text-red-500">Profile</span>
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base">
              Update your public creator identity, avatar, and profile details.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="mb-5 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
              />

              <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="mb-5 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
              />

              <label className="mb-2 block text-sm font-semibold text-gray-300 sm:text-base">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself..."
                className="mb-6 h-32 w-full resize-none rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
              />

              <button
                onClick={saveProfile}
                disabled={uploading}
                className="w-full rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:bg-gray-600 sm:w-auto"
              >
                {uploading ? "Uploading..." : "Save Profile"}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
              <label className="mb-3 block text-sm font-semibold text-gray-300">
                Profile Picture Max 200 KB
              </label>

              <div className="mb-5 flex justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    className="h-28 w-28 rounded-full border border-gray-700 bg-gray-700 object-cover sm:h-32 sm:w-32"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-4xl sm:h-32 sm:w-32">
                    👤
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    uploadAvatar(file);
                  }
                }}
                className="mb-4 w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
              />

              {uploading && (
                <p className="text-sm text-gray-400">Uploading image...</p>
              )}

              <p className="mt-4 text-xs leading-5 text-gray-500">
                Use a clear square image. Large images will be rejected, so keep
                it below 200 KB.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

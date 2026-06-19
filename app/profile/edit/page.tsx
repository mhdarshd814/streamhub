"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function EditProfilePage() {
  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);

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
      return;
    }

    setProfileId(data.id);
    setUsername(data.username || "");
    setDisplayName(data.display_name || "");
    setAvatarUrl(data.avatar_url || "");
    setBio(data.bio || "");
  }

  async function uploadAvatar(file: File) {
    // Keep your existing upload logic
    // ...
  }

  async function saveProfile() {
    // Keep your existing save logic
    // ...
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/profile" className="mb-8 inline-flex items-center gap-2 text-red-400 hover:text-red-300">
          ← Back to Profile
        </Link>

        <div className="premium-glass rounded-3xl p-10">
          <h1 className="text-4xl font-black mb-8">Edit Profile</h1>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <label className="block text-sm text-gray-400 mb-3">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3">Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-3">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full h-32 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">Profile Picture</label>
              <div className="mb-6">
                <div className="h-40 w-40 rounded-3xl overflow-hidden border border-white/20 mx-auto">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="object-cover h-full w-full" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-800 text-6xl">👤</div>
                  )}
                </div>
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm"
              />
            </div>
          </div>

          <button onClick={saveProfile} disabled={uploading} className="mt-10 w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500">
            Save Profile
          </button>
        </div>
      </div>
    </main>
  );
}
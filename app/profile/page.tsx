"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
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

      setProfile(data as Profile);
    }

    loadProfile();
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen bg-black p-8 text-white">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <button
        onClick={() => {
          window.location.href = "/dashboard";
        }}
        className="mb-8 rounded-lg bg-gray-800 px-5 py-3 hover:bg-gray-700"
      >
        Back to Dashboard
      </button>

      <div className="max-w-2xl rounded-xl bg-gray-900 p-8">
        <div className="mb-6 flex items-center gap-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-4xl">👤</span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="break-words text-4xl font-bold">
              {profile.display_name || profile.username}
            </h1>

            <p className="text-gray-400">@{profile.username}</p>
          </div>
        </div>

        <p className="mb-6 text-gray-300">
          {profile.bio || "No bio added yet."}
        </p>

        <div className="flex gap-6 text-gray-400">
          <p>{profile.followers || 0} followers</p>
          <p>{profile.following || 0} following</p>
        </div>
      </div>
    </div>
  );
}

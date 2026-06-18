"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers: number;
  following: number;
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

      setProfile(data);
    }

    loadProfile();
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        Loading profile...
      </div>
    );
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

      <div className="bg-gray-900 p-8 rounded-xl max-w-2xl">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-24 h-24 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
            <img
             src={profile.avatar_url}
             alt={profile.username}
             className="w-full h-full object-cover"
             />
             ) : (
             <span className="text-4xl">👤</span>
             )}
            </div>
            <h1 className="text-4xl font-bold">
              {profile.display_name || profile.username}
            </h1>

            <p className="text-gray-400">@{profile.username}</p>
          </div>
        </div>

        <p className="text-gray-300 mb-6">
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
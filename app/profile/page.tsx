"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading profile...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-red-400 hover:text-red-300">
          ← Back to Dashboard
        </Link>

        <div className="premium-glass rounded-3xl p-10">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0">
              <div className="h-40 w-40 rounded-3xl overflow-hidden border-4 border-white/20">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} className="object-cover h-full w-full" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-800 text-6xl">👤</div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-4xl font-black">{profile.display_name || profile.username}</h1>
              <p className="text-red-400 text-xl">@{profile.username}</p>

              <div className="mt-6 flex gap-8">
                <div>
                  <p className="text-3xl font-black">{profile.followers || 0}</p>
                  <p className="text-sm text-gray-400">Followers</p>
                </div>
                <div>
                  <p className="text-3xl font-black">{profile.following || 0}</p>
                  <p className="text-sm text-gray-400">Following</p>
                </div>
              </div>

              <p className="mt-8 text-lg text-gray-300">{profile.bio || "No bio yet."}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
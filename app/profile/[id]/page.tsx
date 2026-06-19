"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) {
        alert("Profile not found");
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    loadProfile();
  }, [profileId]);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Profile not found.</div>;
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="premium-glass rounded-3xl overflow-hidden">
          <div className="h-56 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 relative" />

          <div className="p-8 -mt-16">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-shrink-0">
                <div className="h-40 w-40 rounded-3xl overflow-hidden border-4 border-black">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="object-cover h-full w-full" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-6xl">👤</div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h1 className="text-4xl font-black">{profile.display_name || profile.username}</h1>
                <p className="text-red-400">@{profile.username}</p>

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
      </div>
    </main>
  );
}
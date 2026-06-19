"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  is_verified?: boolean;
};

type Stream = {
  id: string;
  title: string;
  category: string;
  status: string;
  thumbnail_url: string | null;
  likes: number;
  visibility?: "public" | "private";
};

export default function PublicUserPage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    loadUser();
  }, [username]);

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);
    }

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (error) {
      alert("Profile not found");
      return;
    }

    setProfile(profileData);

    const { data: streamData } = await supabase
      .from("streams")
      .select("*")
      .eq("user_id", profileData.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    setStreams(streamData || []);
  }

  // Keep your existing followUser, unfollowUser, openStream functions...

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="premium-glass rounded-3xl overflow-hidden">
          {/* Your premium profile UI here */}
          <p className="text-gray-400">Public profile coming soon...</p>
        </div>
      </div>
    </main>
  );
}
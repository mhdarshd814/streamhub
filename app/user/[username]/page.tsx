"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers: number;
  following: number;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(
    null
  );
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const username = window.location.pathname.split("/").pop();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);

        const { data: myProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        setCurrentUserProfile(myProfile || null);
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError) {
        alert(profileError.message);
        return;
      }

      setProfile(profileData);

      if (user && user.id !== profileData.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", user.id)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(!!followData);
      }

      const { data: streamData, error: streamError } = await supabase
        .from("streams")
        .select("*")
        .eq("user_id", profileData.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (streamError) {
        alert(streamError.message);
        return;
      }

      setStreams(streamData || []);
    }

    loadUser();
  }, []);

  async function followUser() {
    if (!profile || loadingFollow) return;

    setLoadingFollow(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoadingFollow(false);
      alert("Please login to follow.");
      window.location.href = "/login";
      return;
    }

    if (user.id === profile.id) {
      setLoadingFollow(false);
      alert("You cannot follow yourself.");
      return;
    }

    const { error } = await supabase.from("follows").insert([
      {
        follower_id: user.id,
        following_id: profile.id,
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        setIsFollowing(true);
        setLoadingFollow(false);
        return;
      }

      setLoadingFollow(false);
      alert(error.message);
      return;
    }

    const followerName =
      currentUserProfile?.display_name ||
      currentUserProfile?.username ||
      user.email ||
      "Someone";

    const followerUsername = currentUserProfile?.username || "";

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: profile.id,
          type: "new_follower",
          title: "New Follower",
          message: `${followerName} started following you.`,
          link: followerUsername ? `/user/${followerUsername}` : "/notifications",
          is_read: false,
        },
      ]);

    if (notificationError) {
      console.error("Notification error:", notificationError.message);
    }

    setIsFollowing(true);
    setProfile({
      ...profile,
      followers: (profile.followers || 0) + 1,
    });

    setLoadingFollow(false);
  }

  async function unfollowUser() {
    if (!profile || !currentUserId || loadingFollow) return;

    setLoadingFollow(true);

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", profile.id);

    if (error) {
      setLoadingFollow(false);
      alert(error.message);
      return;
    }

    setIsFollowing(false);
    setProfile({
      ...profile,
      followers: Math.max((profile.followers || 0) - 1, 0),
    });

    setLoadingFollow(false);
  }

  function openStream(stream: Stream) {
    if (stream.visibility === "private") {
      alert("This is a private video call and cannot be watched publicly.");
      return;
    }

    if (stream.status !== "live") {
      alert("This stream is currently offline.");
      return;
    }

    window.location.href = `/watch/${stream.id}`;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
        <p className="text-gray-400">Loading user profile...</p>
      </div>
    );
  }

  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => {
            window.location.href = "/explore";
          }}
          className="mb-6 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:mb-8 sm:text-base"
        >
          Back to Explore
        </button>

        <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-700 text-5xl sm:h-32 sm:w-32">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.username}
                    fill
                    sizes="(min-width: 640px) 128px, 112px"
                    className="object-cover"
                  />
                ) : (
                  "👤"
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <h1 className="break-words text-3xl font-black sm:text-4xl">
                    {profile.display_name || profile.username}
                  </h1>

                  {profile.is_verified && (
                    <span className="w-fit rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white sm:text-sm">
                      ✓ Verified
                    </span>
                  )}
                </div>

                <p className="mt-1 text-gray-400">@{profile.username}</p>

                {profile.is_verified && (
                  <p className="mt-2 text-sm font-semibold text-blue-400">
                    Verified Creator
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400 sm:gap-6 sm:text-base">
                  <p>{profile.followers || 0} followers</p>
                  <p>{profile.following || 0} following</p>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {!isOwnProfile ? (
                isFollowing ? (
                  <button
                    onClick={unfollowUser}
                    disabled={loadingFollow}
                    className="w-full rounded-xl bg-gray-700 px-6 py-3 font-bold hover:bg-gray-600 disabled:bg-gray-500 sm:w-auto"
                  >
                    {loadingFollow ? "Please wait..." : "Following"}
                  </button>
                ) : (
                  <button
                    onClick={followUser}
                    disabled={loadingFollow}
                    className="w-full rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:bg-gray-500 sm:w-auto"
                  >
                    {loadingFollow ? "Please wait..." : "Follow"}
                  </button>
                )
              ) : (
                <button
                  onClick={() => {
                    window.location.href = "/profile/edit";
                  }}
                  className="w-full rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 sm:w-auto"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-sm leading-6 text-gray-300 sm:text-base">
            {profile.bio || "No bio added yet."}
          </p>
        </div>

        <div className="mb-6">
          <h2 className="break-words text-2xl font-black sm:text-3xl">
            Streams by {profile.display_name || profile.username}
            {profile.is_verified && <span className="ml-2 text-blue-400">✓</span>}
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Public streams only. Private video calls are hidden.
          </p>
        </div>

        {streams.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center sm:p-10">
            <p className="mb-4 text-5xl">📺</p>
            <p className="text-gray-400">No public streams found.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {streams.map((stream) => {
              const isLive = stream.status === "live";

              return (
                <div
                  key={stream.id}
                  onClick={() => openStream(stream)}
                  className={
                    isLive
                      ? "cursor-pointer overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition-all duration-150 hover:border-red-600 hover:-translate-y-0.5 active:scale-[0.98]"
                      : "cursor-not-allowed overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 opacity-70"
                  }
                >
                  <div className="relative h-48 overflow-hidden bg-gray-800 sm:h-52">
                    {stream.thumbnail_url ? (
                      <Image
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-gray-400">No Thumbnail</p>
                      </div>
                    )}

                    {isLive ? (
                      <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black sm:left-4 sm:top-4">
                        LIVE
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <span className="rounded-xl bg-gray-800 px-5 py-2 font-bold text-gray-300">
                          Offline
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5">
                    <h3 className="mb-2 break-words text-lg font-bold sm:text-xl">
                      {stream.title}
                    </h3>

                    <p className="mb-3 text-sm text-gray-400 sm:text-base">
                      {stream.category}
                    </p>

                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          isLive ? "text-green-500" : "text-gray-500"
                        }
                      >
                        {isLive ? "● Live Now" : "Offline"}
                      </span>

                      <span className="text-gray-400">
                        ❤️ {stream.likes || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
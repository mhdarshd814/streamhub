"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  is_banned?: boolean | null;
  is_verified?: boolean | null;
};

type SubscriptionPlan = {
  id: string;
  creator_id: string;
  plan_name: string;
  price_usd: number;
  description: string | null;
  is_active: boolean;
};

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params?.id as string;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasFirstStream, setHasFirstStream] = useState(false);
  const [hasFirstFollow, setHasFirstFollow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [callLoading, setCallLoading] = useState(false);

  useEffect(() => {
    if (profileId) loadProfile();
  }, [profileId]);

  const isOwnProfile = viewerId === profile?.id;
  const hasPremiumPlan = !!plan?.is_active;
  const planName = plan?.plan_name || "Premium";
  const planPrice = plan?.price_usd ?? 9.99;

  const completionItems = useMemo(() => {
    if (!profile) return [];

    return [
      {
        label: "Username added",
        done: !!profile.username,
        action: "/profile/edit",
      },
      {
        label: "Avatar uploaded",
        done: !!profile.avatar_url,
        action: "/profile/edit",
      },
      {
        label: "Bio completed",
        done: !!profile.bio && profile.bio.trim().length >= 10,
        action: "/profile/edit",
      },
      {
        label: "Subscription plan active",
        done: hasPremiumPlan,
        action: "/wallet",
      },
      {
        label: "First stream created",
        done: hasFirstStream,
        action: "/go-live",
      },
      {
        label: "Following someone",
        done: hasFirstFollow,
        action: "/explore",
      },
    ];
  }, [profile, hasPremiumPlan, hasFirstStream, hasFirstFollow]);

  const completedCount = completionItems.filter((item) => item.done).length;
  const completionPercent =
    completionItems.length > 0
      ? Math.round((completedCount / completionItems.length) * 100)
      : 0;

  const creatorLevel = useMemo(() => {
    const followers = profile?.followers || 0;
    let score = 0;

    if (profile?.username) score += 10;
    if (profile?.avatar_url) score += 10;
    if (profile?.bio && profile.bio.trim().length >= 10) score += 10;
    if (hasPremiumPlan) score += 15;
    if (hasFirstStream) score += 20;
    if (followers >= 10) score += 10;
    if (followers >= 50) score += 15;
    if (followers >= 100) score += 20;

    if (score >= 90) {
      return {
        emoji: "💎",
        name: "Diamond Creator",
        color: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
        progressText: "Elite creator profile",
        nextGoal: "Keep growing your audience and revenue.",
      };
    }

    if (score >= 65) {
      return {
        emoji: "🥇",
        name: "Gold Creator",
        color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
        progressText: "Strong creator profile",
        nextGoal: "Reach 100 followers or improve profile completion.",
      };
    }

    if (score >= 40) {
      return {
        emoji: "🥈",
        name: "Silver Creator",
        color: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
        progressText: "Growing creator profile",
        nextGoal: "Create your first stream and activate a subscription plan.",
      };
    }

    return {
      emoji: "🥉",
      name: "Bronze Creator",
      color: "border-orange-400/40 bg-orange-400/10 text-orange-300",
      progressText: "Starter creator profile",
      nextGoal: "Add avatar, bio, and create your first stream.",
    };
  }, [profile, hasPremiumPlan, hasFirstStream]);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setViewerId(user.id);

    const { data: viewerProfile, error: viewerError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (viewerError) {
      alert(viewerError.message);
      setLoading(false);
      return;
    }

    if (viewerProfile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    const { data: creatorProfile, error: creatorError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (creatorError) {
      alert(creatorError.message);
      setLoading(false);
      return;
    }

    if (!creatorProfile || creatorProfile.is_banned) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(creatorProfile);

    const { data: followData } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profileId)
      .maybeSingle();

    setIsFollowing(!!followData);

    const { data: planData } = await supabase
      .from("creator_subscription_plans")
      .select("*")
      .eq("creator_id", profileId)
      .eq("is_active", true)
      .maybeSingle();

    setPlan(planData || null);

    if (user.id === profileId) {
      const { data: streamData } = await supabase
        .from("streams")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      setHasFirstStream(!!streamData?.length);

      const { data: followingData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .limit(1);

      setHasFirstFollow(!!followingData?.length);
    }

    if (user.id !== profileId) {
      const { data: subscriptionStatus } = await supabase.rpc(
        "is_subscribed_to_creator",
        {
          target_creator_id: profileId,
        }
      );

      setIsSubscribed(!!subscriptionStatus);
    }

    setLoading(false);
  }

  async function checkViewerAccess() {
    if (!viewerId) return false;

    const { data: viewerProfile, error } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", viewerId)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return false;
    }

    if (viewerProfile?.is_banned) {
      window.location.href = "/banned";
      return false;
    }

    return true;
  }

  async function logout() {
    const confirmed = confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function startPrivateCall() {
  if (!viewerId || !profile || viewerId === profile.id) return;

  const confirmed = confirm(
    `Start a private one-on-one call with ${
      profile.display_name || profile.username || "this creator"
    }?`
  );

  if (!confirmed) return;

  setCallLoading(true);

  const allowed = await checkViewerAccess();

  if (!allowed) {
    setCallLoading(false);
    return;
  }

  const callTitle = `Private Call with ${
    profile.display_name || profile.username || "Creator"
  }`;

  const expiresAt = new Date(Date.now() + 30_000).toISOString();

  const { data: streamData, error: streamError } = await supabase
    .from("streams")
    .insert([
      {
        user_id: viewerId,
        title: callTitle,
        category: "One-on-One Call",
        description: "Private one-on-one video call.",
        tags: "private,call,one-on-one",
        visibility: "private",
        status: "offline",
        thumbnail_url: null,
      },
    ])
    .select()
    .single();

  if (streamError || !streamData) {
    setCallLoading(false);
    alert(streamError?.message || "Failed to create private call.");
    return;
  }

  const { error: inviteError } = await supabase.from("stream_guests").insert([
    {
      stream_id: streamData.id,
      host_id: viewerId,
      guest_id: profile.id,
      status: "pending",
    },
  ]);

  if (inviteError) {
    setCallLoading(false);
    alert(inviteError.message);
    return;
  }

  const { data: callData, error: callError } = await supabase
    .from("private_call_requests")
    .insert([
      {
        caller_id: viewerId,
        receiver_id: profile.id,
        stream_id: streamData.id,
        status: "pending",
        ring_status: "ringing",
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (callError || !callData) {
    setCallLoading(false);
    alert(callError?.message || "Failed to create call request.");
    return;
  }

  await supabase.from("notifications").insert([
    {
      user_id: profile.id,
      type: "private_call_request",
      title: "Incoming Private Call",
      message: `${
        profile.display_name || profile.username || "Someone"
      } is receiving a private call request.`,
      link: `/incoming-call/${callData.id}`,
      is_read: false,
    },
  ]);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          title: "Incoming Private Call",
          message: `${
            profile.display_name || profile.username || "Someone"
          } is calling you on StreamHub.`,
          url: `/incoming-call/${callData.id}`,
          notificationType: "incoming_call",
          streamId: streamData.id,
          callId: callData.id,
        }),
      });
    } catch (pushError) {
      console.error("Incoming call push failed:", pushError);
    }
  }

  setCallLoading(false);
  window.location.href = `/live/${streamData.id}`;
}

  async function toggleFollow() {
    if (!viewerId || !profile || viewerId === profile.id) return;

    setFollowLoading(true);

    const allowed = await checkViewerAccess();

    if (!allowed) {
      setFollowLoading(false);
      return;
    }

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", profile.id);

      if (error) {
        alert(error.message);
        setFollowLoading(false);
        return;
      }

      setIsFollowing(false);
      setProfile({
        ...profile,
        followers: Math.max((profile.followers || 0) - 1, 0),
      });
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: viewerId,
        following_id: profile.id,
      });

      if (error) {
        alert(error.message);
        setFollowLoading(false);
        return;
      }

      setIsFollowing(true);
      setProfile({
        ...profile,
        followers: (profile.followers || 0) + 1,
      });
    }

    setFollowLoading(false);
  }

  async function toggleSubscription() {
    if (!viewerId || !profile || viewerId === profile.id) return;

    setSubscriptionLoading(true);

    const allowed = await checkViewerAccess();

    if (!allowed) {
      setSubscriptionLoading(false);
      return;
    }

    if (isSubscribed) {
      const confirmed = confirm(
        "Cancel your subscription to this creator? You may lose access to subscriber-only streams."
      );

      if (!confirmed) {
        setSubscriptionLoading(false);
        return;
      }

      const { error } = await supabase.rpc("cancel_creator_subscription", {
        target_creator_id: profile.id,
      });

      if (error) {
        alert(error.message);
        setSubscriptionLoading(false);
        return;
      }

      setIsSubscribed(false);
    } else {
      const { error } = await supabase.rpc("subscribe_to_creator", {
        target_creator_id: profile.id,
      });

      if (error) {
        alert(error.message);
        setSubscriptionLoading(false);
        return;
      }

      setIsSubscribed(true);

      if (!plan) {
        const { data: newPlan } = await supabase
          .from("creator_subscription_plans")
          .select("*")
          .eq("creator_id", profile.id)
          .eq("is_active", true)
          .maybeSingle();

        setPlan(newPlan || null);
      }
    }

    setSubscriptionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <p className="text-gray-400">Loading creator profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
          <h1 className="text-2xl font-black">Profile not available</h1>
          <p className="mt-3 text-gray-400">
            This creator profile does not exist or is unavailable.
          </p>
          <button
            onClick={() => (window.location.href = "/explore")}
            className="mt-6 rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
          >
            Go to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => (window.location.href = "/explore")}
          className="mb-6 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:text-base"
        >
          Back to Explore
        </button>

        <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900">
          <div className="h-28 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 sm:h-36" />

          <div className="p-5 sm:p-8">
            <div className="-mt-16 flex flex-col gap-5 sm:-mt-20 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-gray-900 bg-gray-800 sm:h-36 sm:w-36">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username || "Creator"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl">
                      👤
                    </div>
                  )}
                </div>

                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-black sm:text-4xl">
                      {profile.display_name || profile.username || "Creator"}
                    </h1>

                    {profile.is_verified && (
                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold">
                        Verified
                      </span>
                    )}

                    {hasPremiumPlan && (
                      <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                        ⭐ Premium
                      </span>
                    )}

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${creatorLevel.color}`}
                    >
                      {creatorLevel.emoji} {creatorLevel.name}
                    </span>
                  </div>

                  <p className="mt-1 text-gray-400">@{profile.username}</p>

                  <p className="mt-2 text-sm font-semibold text-yellow-300">
                    {hasPremiumPlan
                      ? `${planName} plan active`
                      : "No premium plan active"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-end">
                {!isOwnProfile && (
                  <>
                    <button
                      onClick={startPrivateCall}
                      disabled={
                        callLoading || followLoading || subscriptionLoading
                      }
                      className="rounded-xl bg-purple-600 px-5 py-3 font-black text-white hover:bg-purple-700 disabled:bg-gray-700"
                    >
                      {callLoading ? "Starting..." : "📞 Private Call"}
                    </button>

                    <button
                      onClick={toggleFollow}
                      disabled={
                        followLoading || subscriptionLoading || callLoading
                      }
                      className={`rounded-xl px-5 py-3 font-bold disabled:bg-gray-700 ${
                        isFollowing
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {followLoading
                        ? "Please wait..."
                        : isFollowing
                        ? "Following"
                        : "Follow"}
                    </button>

                    <button
                      onClick={toggleSubscription}
                      disabled={
                        subscriptionLoading || followLoading || callLoading
                      }
                      className={`rounded-xl px-5 py-3 font-black disabled:bg-gray-700 ${
                        isSubscribed
                          ? "border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                          : "bg-yellow-500 text-black hover:bg-yellow-400"
                      }`}
                    >
                      {subscriptionLoading
                        ? "Please wait..."
                        : isSubscribed
                        ? "Subscribed ✓"
                        : `Subscribe USD ${planPrice}`}
                    </button>
                  </>
                )}

                {isOwnProfile && (
                  <div className="w-full rounded-2xl border border-gray-800 bg-black/30 p-4 lg:min-w-[360px]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black">Account Menu</h2>
                        <p className="mt-1 text-xs text-gray-400">
                          Manage your StreamHub account
                        </p>
                      </div>

                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                        Me
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ProfileAction
                        label="👤 My Profile"
                        href={`/profile/${profile.id}`}
                      />
                      <ProfileAction label="✏️ Edit Profile" href="/profile/edit" />
                      <ProfileAction label="💰 Wallet" href="/wallet" />
                      <ProfileAction label="📞 Calls" href="/calls" />
                      <ProfileAction label="🔔 Notifications" href="/notifications" />
                      <ProfileAction label="🎥 Go Live" href="/go-live" />
                      <ProfileAction label="📅 Schedule Stream" href="/schedule" />
                      <ProfileAction label="⚙️ Settings" href="/notifications/settings" />

                      <button
                        onClick={logout}
                        className="rounded-xl bg-red-600 px-5 py-3 text-left font-black text-white hover:bg-red-700"
                      >
                        🚪 Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <ProfileCompletionCard
                percent={completionPercent}
                completedCount={completedCount}
                totalCount={completionItems.length}
                items={completionItems}
              />
            )}

            <CreatorLevelCard
              level={creatorLevel}
              followers={profile.followers || 0}
              hasPremiumPlan={hasPremiumPlan}
              hasFirstStream={hasFirstStream}
              completionPercent={completionPercent}
            />

            <p className="mt-6 rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm leading-6 text-gray-300 sm:text-base">
              {profile.bio || "No bio added yet."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
              <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                <p className="text-2xl font-black">{profile.followers || 0}</p>
                <p className="text-sm text-gray-400">Followers</p>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                <p className="text-2xl font-black">{profile.following || 0}</p>
                <p className="text-sm text-gray-400">Following</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
              <h2 className="mb-2 text-xl font-black text-purple-300">
                Private One-on-One Call
              </h2>
              <p className="text-sm leading-6 text-gray-300">
                Start a private LiveKit room with this creator. The room is
                hidden from Explore and public watch pages. Only the caller and
                invited creator can join.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">
                      {planName} Subscription
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        hasPremiumPlan
                          ? "bg-green-500/10 text-green-300"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {hasPremiumPlan ? "Active Plan" : "Inactive Plan"}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-gray-300">
                    {plan?.description ||
                      "Support this creator and unlock subscriber-only streams and chat."}
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-500/30 bg-black/40 px-5 py-4 text-left sm:text-right">
                  <p className="text-2xl font-black text-yellow-300">
                    USD {planPrice}
                  </p>
                  <p className="text-xs text-gray-400">Monthly</p>
                </div>
              </div>

              {!isOwnProfile && (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-yellow-500/20 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-300">
                    Status:{" "}
                    <span
                      className={
                        isSubscribed
                          ? "font-bold text-green-400"
                          : "font-bold text-gray-400"
                      }
                    >
                      {isSubscribed ? "Active subscriber" : "Not subscribed"}
                    </span>
                  </p>

                  <button
                    onClick={toggleSubscription}
                    disabled={subscriptionLoading}
                    className={`rounded-xl px-5 py-3 text-sm font-black disabled:bg-gray-700 ${
                      isSubscribed
                        ? "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        : "bg-yellow-500 text-black hover:bg-yellow-400"
                    }`}
                  >
                    {subscriptionLoading
                      ? "Please wait..."
                      : isSubscribed
                      ? "Cancel Subscription"
                      : "Subscribe Now"}
                  </button>
                </div>
              )}

              {isOwnProfile && (
                <div className="mt-5 rounded-xl border border-yellow-500/20 bg-black/40 p-4">
                  <p className="text-sm text-gray-300">
                    Your public premium profile is live here.
                  </p>

                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/profile/${profile.id}`
                      )
                    }
                    className="mt-4 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700"
                  >
                    Copy Public Profile Link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorLevelCard({
  level,
  followers,
  hasPremiumPlan,
  hasFirstStream,
  completionPercent,
}: {
  level: {
    emoji: string;
    name: string;
    color: string;
    progressText: string;
    nextGoal: string;
  };
  followers: number;
  hasPremiumPlan: boolean;
  hasFirstStream: boolean;
  completionPercent: number;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-red-300">
            Creator Level
          </p>

          <h2 className="mt-2 text-2xl font-black">
            {level.emoji} {level.name}
          </h2>

          <p className="mt-2 text-sm text-gray-300">{level.progressText}</p>
        </div>

        <div className={`w-fit rounded-2xl border px-5 py-4 ${level.color}`}>
          <p className="text-sm font-black">{completionPercent}% Complete</p>
          <p className="mt-1 text-xs opacity-80">{followers} followers</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <LevelMetric label="Profile" value={`${completionPercent}%`} />
        <LevelMetric label="First Stream" value={hasFirstStream ? "Done" : "Pending"} />
        <LevelMetric label="Premium Plan" value={hasPremiumPlan ? "Active" : "Inactive"} />
      </div>

      <div className="mt-5 rounded-xl border border-gray-800 bg-black/30 p-4">
        <p className="text-sm text-gray-300">
          <span className="font-bold text-white">Next goal:</span>{" "}
          {level.nextGoal}
        </p>
      </div>
    </div>
  );
}

function LevelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}

function ProfileCompletionCard({
  percent,
  completedCount,
  totalCount,
  items,
}: {
  percent: number;
  completedCount: number;
  totalCount: number;
  items: { label: string; done: boolean; action: string }[];
}) {
  return (
    <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-green-300">
            Profile Completion
          </h2>
          <p className="mt-1 text-sm text-gray-300">
            {completedCount} of {totalCount} completed
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-3xl font-black text-green-300">{percent}%</p>
          <p className="text-xs text-gray-400">Complete</p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/50">
        <div
          className="h-full rounded-full bg-green-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (!item.done) window.location.href = item.action;
            }}
            className={`rounded-xl px-4 py-3 text-left text-sm font-bold ${
              item.done
                ? "border border-green-500/30 bg-green-500/10 text-green-300"
                : "border border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800"
            }`}
          >
            {item.done ? "✅" : "⬜"} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileAction({ label, href }: { label: string; href: string }) {
  return (
    <button
      onClick={() => (window.location.href = href)}
      className="rounded-xl bg-gray-800 px-5 py-3 text-left font-bold text-white hover:bg-gray-700"
    >
      {label}
    </button>
  );
}
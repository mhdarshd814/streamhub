"use client";

import { useEffect, useState } from "react";
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
  price_aed: number;
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
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  useEffect(() => {
    if (profileId) loadProfile();
  }, [profileId]);

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

  const isOwnProfile = viewerId === profile.id;
  const hasPremiumPlan = !!plan?.is_active;
  const planName = plan?.plan_name || "Premium";
  const planPrice = plan?.price_aed ?? 9.99;

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => (window.location.href = "/explore")}
          className="mb-6 rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:text-base"
        >
          Back to Explore
        </button>

        <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900">
          <div className="h-28 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 sm:h-36" />

          <div className="p-5 sm:p-8">
            <div className="-mt-16 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
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
                  </div>

                  <p className="mt-1 text-gray-400">@{profile.username}</p>

                  <p className="mt-2 text-sm font-semibold text-yellow-300">
                    {hasPremiumPlan
                      ? `${planName} plan active`
                      : "No premium plan active"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {!isOwnProfile && (
                  <>
                    <button
                      onClick={toggleFollow}
                      disabled={followLoading || subscriptionLoading}
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
                      disabled={subscriptionLoading || followLoading}
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
                          : `Subscribe AED ${planPrice}`}
                    </button>
                  </>
                )}

                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => (window.location.href = "/wallet")}
                      className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black hover:bg-yellow-400"
                    >
                      Manage Premium
                    </button>

                    <button
                      onClick={() => (window.location.href = "/profile/edit")}
                      className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
                    >
                      Edit Profile
                    </button>
                  </>
                )}
              </div>
            </div>

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
                    AED {planPrice}
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
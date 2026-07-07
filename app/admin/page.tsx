"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type AdminStats = {
  totalUsers: number;
  verifiedCreators: number;
  pendingVerifications: number;
  liveStreams: number;
  adminBroadcasts: number;
  liveAdminBroadcasts: number;
  totalReports: number;
  blockedUsers: number;
  suspendedStreams: number;
  pendingReports: number;
  recentChatMessages: number;
  auditLogs: number;
  payoutRequests: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  estimatedSubscriptionRevenue: number;
};

type TopCreator = {
  creator_id: string;
  subscriber_count: number;
  profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type StatCard = {
  label: string;
  value: number | string;
  color: string;
};

type AdminCard = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    verifiedCreators: 0,
    pendingVerifications: 0,
    liveStreams: 0,
    adminBroadcasts: 0,
    liveAdminBroadcasts: 0,
    totalReports: 0,
    blockedUsers: 0,
    suspendedStreams: 0,
    pendingReports: 0,
    recentChatMessages: 0,
    auditLogs: 0,
    payoutRequests: 0,
    activeSubscriptions: 0,
    cancelledSubscriptions: 0,
    estimatedSubscriptionRevenue: 0,
  });

  useEffect(() => {
    loadAdminDashboard();
  }, []);

  async function loadAdminDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const [
      usersResult,
      verifiedResult,
      verificationResult,
      liveStreamsResult,
      adminBroadcastsResult,
      liveAdminBroadcastsResult,
      reportsResult,
      pendingReportsResult,
      blockedResult,
      suspendedResult,
      chatResult,
      auditResult,
      payoutResult,
      activeSubsResult,
      cancelledSubsResult,
      activeSubsDataResult,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_verified", true),
      supabase.from("creator_verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("streams").select("id", { count: "exact", head: true }).eq("status", "live"),
      supabase.from("streams").select("id", { count: "exact", head: true }).eq("category", "Admin Broadcast"),
      supabase.from("streams").select("id", { count: "exact", head: true }).eq("category", "Admin Broadcast").eq("status", "live"),
      supabase.from("stream_reports").select("id", { count: "exact", head: true }),
      supabase.from("stream_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("user_blocks").select("id", { count: "exact", head: true }),
      supabase.from("streams").select("id", { count: "exact", head: true }).eq("is_suspended", true),
      supabase.from("stream_chat").select("id", { count: "exact", head: true }),
      supabase.from("admin_audit_logs").select("id", { count: "exact", head: true }),
      supabase.from("creator_payout_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("creator_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("creator_subscriptions").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
      supabase
        .from("creator_subscriptions")
        .select(
          `
          id,
          creator_id,
          plan_id,
          creator_subscription_plans:plan_id (
            price_usd
          )
        `
        )
        .eq("status", "active"),
    ]);

    const activeSubscriptions = activeSubsResult.count || 0;
    const cancelledSubscriptions = cancelledSubsResult.count || 0;
    const activeSubscriptionRows = activeSubsDataResult.data || [];

    const estimatedSubscriptionRevenue = activeSubscriptionRows.reduce(
      (total: number, item: any) =>
        total + Number(item.creator_subscription_plans?.price_usd || 0),
      0
    );

    const creatorCounts = new Map<string, number>();

    activeSubscriptionRows.forEach((item: any) => {
      if (!item.creator_id) return;
      creatorCounts.set(
        item.creator_id,
        (creatorCounts.get(item.creator_id) || 0) + 1
      );
    });

    const topCreatorRows = Array.from(creatorCounts.entries())
      .map(([creator_id, subscriber_count]) => ({
        creator_id,
        subscriber_count,
      }))
      .sort((a, b) => b.subscriber_count - a.subscriber_count)
      .slice(0, 5);

    const topCreatorProfiles = await Promise.all(
      topCreatorRows.map(async (creator) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("id", creator.creator_id)
          .maybeSingle();

        return {
          ...creator,
          profile,
        };
      })
    );

    setTopCreators(topCreatorProfiles);

    setStats({
      totalUsers: usersResult.count || 0,
      verifiedCreators: verifiedResult.count || 0,
      pendingVerifications: verificationResult.count || 0,
      liveStreams: liveStreamsResult.count || 0,
      adminBroadcasts: adminBroadcastsResult.count || 0,
      liveAdminBroadcasts: liveAdminBroadcastsResult.count || 0,
      totalReports: reportsResult.count || 0,
      pendingReports: pendingReportsResult.count || 0,
      blockedUsers: blockedResult.count || 0,
      suspendedStreams: suspendedResult.count || 0,
      recentChatMessages: chatResult.count || 0,
      auditLogs: auditResult.count || 0,
      payoutRequests: payoutResult.count || 0,
      activeSubscriptions,
      cancelledSubscriptions,
      estimatedSubscriptionRevenue,
    });

    setLoading(false);
  }

  const statCards: StatCard[] = [
    { label: "Users", value: stats.totalUsers, color: "text-white" },
    { label: "Verified", value: stats.verifiedCreators, color: "text-blue-400" },
    { label: "Verify Req.", value: stats.pendingVerifications, color: "text-cyan-400" },
    { label: "Live", value: stats.liveStreams, color: "text-green-500" },
    { label: "Broadcasts", value: stats.adminBroadcasts, color: "text-red-400" },
    { label: "Live Bcasts", value: stats.liveAdminBroadcasts, color: "text-red-500" },
    { label: "Reports", value: stats.totalReports, color: "text-red-500" },
    { label: "Pending", value: stats.pendingReports, color: "text-yellow-400" },
    { label: "Blocked", value: stats.blockedUsers, color: "text-orange-400" },
    { label: "Suspended", value: stats.suspendedStreams, color: "text-purple-400" },
    { label: "Chats", value: stats.recentChatMessages, color: "text-pink-400" },
    { label: "Payouts", value: stats.payoutRequests, color: "text-green-400" },
    { label: "Audit", value: stats.auditLogs, color: "text-cyan-400" },
    { label: "Active Subs", value: stats.activeSubscriptions, color: "text-yellow-300" },
    { label: "Cancelled Subs", value: stats.cancelledSubscriptions, color: "text-gray-400" },
    {
      label: "Sub Revenue",
      value: `$${stats.estimatedSubscriptionRevenue.toFixed(2)}`,
      color: "text-green-400",
    },
  ];

  const adminCards: AdminCard[] = [
    {
      href: "/admin/broadcast",
      icon: "📡",
      title: "Create Broadcast",
      description:
        "Create official public broadcasts and open the screen-share focused studio.",
    },
    {
      href: "/admin/broadcasts",
      icon: "🗂️",
      title: "Broadcast Management",
      description:
        "List all admin broadcasts, force end live broadcasts, delete old broadcasts, copy watch links, and reopen studios.",
    },
    {
      href: "/admin/users",
      icon: "👥",
      title: "User Management",
      description: "Ban, mute, shadow ban, verify creators, and manage admins.",
    },
    {
      href: "/admin/verification",
      icon: "✅",
      title: "Verification",
      description: "Review creator verification requests and approve trusted creators.",
    },
    {
      href: "/admin/streams",
      icon: "🎥",
      title: "Stream Moderation",
      description: "Suspend, unsuspend, and force end live streams.",
    },
    {
      href: "/admin/chat",
      icon: "💬",
      title: "Chat Moderation",
      description: "Review chat messages, delete harmful messages, and clear user chat history.",
    },
    {
      href: "/admin/reports",
      icon: "🚨",
      title: "Stream Reports",
      description: "Review reports, reject false reports, or suspend unsafe streams.",
    },
    {
      href: "/admin/payouts",
      icon: "💸",
      title: "Payout Requests",
      description:
        "Review creator withdrawal requests, approve payouts, reject invalid requests, and mark completed payouts as paid.",
    },
    {
      href: "/admin/topups",
      icon: "💰",
      title: "Top-Up Requests",
      description:
        "Review wallet top-up requests with payment proof, approve to credit the user's wallet, or reject invalid requests.",
    },
    {
      href: "/admin/audit",
      icon: "🧾",
      title: "Audit Log",
      description: "Track admin actions, bans, suspensions, deleted chat, and safety decisions.",
    },
    {
      href: "/admin/subscriptions",
      icon: "💎",
      title: "Subscriptions",
      description:
        "Monitor active subscriptions, cancellations, creator performance, recurring revenue, and subscription growth.",
    },
    {
      href: "/dashboard",
      icon: "📊",
      title: "Creator Dashboard",
      description: "Return to your normal creator dashboard.",
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>

          <p className="text-red-200">
            Your account does not have admin permission.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
              StreamHub <span className="text-red-500">Admin</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Manage users, verification requests, subscriptions, payouts,
              reports, streams, chat safety, platform moderation, audit records,
              admin broadcasts, and creator permissions.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
            <button
              onClick={loadAdminDashboard}
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin/broadcasts"
              className="rounded-xl bg-red-600 px-5 py-3 text-center font-bold hover:bg-red-700"
            >
              Broadcasts
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Dashboard
            </Link>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-8">
          {statCards.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5"
            >
              <p className="mb-2 truncate text-xs text-gray-400 sm:text-sm">
                {item.label}
              </p>

              <h2
                className={`break-words text-2xl font-black leading-none sm:text-3xl ${item.color}`}
              >
                {item.value}
              </h2>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-red-900/40 bg-red-950/20 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold text-red-300">
                Admin Broadcasts
              </p>
              <h2 className="text-2xl font-black">Official Broadcast Control</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
                Create public admin broadcasts or manage existing ones from a dedicated broadcast management page.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/admin/broadcast"
                className="rounded-xl bg-red-600 px-5 py-3 text-center font-black hover:bg-red-700"
              >
                Create
              </Link>
              <Link
                href="/admin/broadcasts"
                className="rounded-xl bg-gray-800 px-5 py-3 text-center font-black hover:bg-gray-700"
              >
                Manage
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-yellow-300">
                Subscription Overview
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Top Subscribed Creators
              </h2>
            </div>

            <Link
              href="/admin/subscriptions"
              className="rounded-xl bg-yellow-500 px-5 py-3 text-center text-sm font-black text-black hover:bg-yellow-400"
            >
              Open Subscriptions
            </Link>
          </div>

          {topCreators.length === 0 ? (
            <div className="rounded-xl border border-yellow-500/20 bg-black/30 p-5 text-sm text-gray-400">
              No active creator subscriptions yet.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              {topCreators.map((creator, index) => (
                <Link
                  key={creator.creator_id}
                  href={`/profile/${creator.creator_id}`}
                  className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4 transition hover:border-yellow-400 hover:bg-yellow-500/10"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                      {creator.profile?.avatar_url ? (
                        <img
                          src={creator.profile.avatar_url}
                          alt={creator.profile.username || "Creator"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "👤"
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {creator.profile?.display_name ||
                          creator.profile?.username ||
                          "Creator"}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        #{index + 1}
                      </p>
                    </div>
                  </div>

                  <p className="text-2xl font-black text-yellow-300">
                    {creator.subscriber_count}
                  </p>
                  <p className="text-xs text-gray-400">active subscribers</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {adminCards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-[220px] min-w-0 flex-col rounded-2xl border border-gray-800 bg-gray-900 p-6 transition hover:border-red-600 hover:bg-gray-900/80"
            >
              <div className="mb-4 text-4xl">{item.icon}</div>

              <h2 className="mb-3 break-words text-2xl font-black leading-tight tracking-tight">
                {item.title}
              </h2>

              <p className="text-sm leading-6 text-gray-400">
                {item.description}
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

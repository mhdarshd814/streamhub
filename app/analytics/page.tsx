"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  followers: number | null;
  following: number | null;
  is_banned?: boolean | null;
  is_verified?: boolean | null;
  creator_level?: string | null;
};

type Stream = {
  id: string;
  user_id?: string;
  title: string;
  category?: string | null;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  likes?: number | null;
  viewers?: number | null;
  total_views?: number | null;
  peak_viewers?: number | null;
  watch_minutes?: number | null;
  thumbnail_url?: string | null;
  created_at: string;
};

type AnalyticsRow = {
  id: string;
  stream_id: string;
  creator_id: string;
  analytics_date: string;
  views: number | null;
  peak_viewers: number | null;
  watch_minutes: number | null;
  likes: number | null;
  chat_messages: number | null;
};

type TipRow = {
  id: string;
  creator_id?: string;
  receiver_id?: string;
  amount?: number | null;
  amount_aed?: number | null;
  creator_amount_aed?: number | null;
  status: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  creator_id: string;
  subscriber_id?: string;
  amount?: number | null;
  price?: number | null;
  status: string | null;
  created_at: string;
};

type WalletRow = {
  id?: string;
  user_id?: string;
  creator_id?: string;
  balance?: number | null;
  available_balance?: number | null;
  pending_balance?: number | null;
  total_earned?: number | null;
  total_withdrawn?: number | null;
  available_balance_aed?: number | null;
  pending_balance_aed?: number | null;
  lifetime_earnings_aed?: number | null;
};

type FollowRow = {
  id: string;
  follower_id?: string;
  following_id?: string;
  created_at: string;
};

type PrivateCallPayment = {
  id: string;
  stream_id: string;
  caller_id: string;
  creator_id: string;
  amount_aed: number | null;
  created_at: string;
  streams?: {
    title?: string | null;
  } | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

type OptionalTableState = {
  analyticsAvailable: boolean;
  tipsAvailable: boolean;
  subscriptionsAvailable: boolean;
  walletAvailable: boolean;
  followsAvailable: boolean;
  privatePaymentsAvailable: boolean;
};

type ChartPoint = {
  label: string;
  views: number;
  likes: number;
  watchMinutes: number;
  peakViewers: number;
  tipsRevenue: number;
  subscriptionRevenue: number;
  privateCallRevenue: number;
  totalRevenue: number;
  followers: number;
  privateCalls: number;
};

type PrivateCallPerformanceRow = {
  id: string;
  title: string;
  callerName: string;
  amount: number;
  createdAt: string;
  streamStatus: string;
};

export default function CreatorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<AnalyticsRow[]>([]);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [privateCallPayments, setPrivateCallPayments] = useState<PrivateCallPayment[]>([]);
  const [error, setError] = useState("");

  const [optionalTables, setOptionalTables] = useState<OptionalTableState>({
    analyticsAvailable: true,
    tipsAvailable: true,
    subscriptionsAvailable: true,
    walletAvailable: true,
    followsAvailable: true,
    privatePaymentsAvailable: true,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function safeSelect<T>(
    queryBuilder: any,
    tableKey: keyof OptionalTableState
  ): Promise<T[]> {
    const { data, error } = await queryBuilder;

    if (error) {
      console.warn(`${tableKey} skipped:`, error.message);
      setOptionalTables((current) => ({ ...current, [tableKey]: false }));
      return [];
    }

    setOptionalTables((current) => ({ ...current, [tableKey]: true }));
    return (data || []) as T[];
  }

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, followers, following, is_banned, is_verified, creator_level"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      const fallback = await supabase
        .from("profiles")
        .select("id, username, display_name, followers, following, is_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (fallback.error) {
        setError(fallback.error.message);
        setLoading(false);
        return;
      }

      if (fallback.data?.is_banned) {
        window.location.href = "/banned";
        return;
      }

      setProfile(fallback.data || null);
    } else {
      if (profileData?.is_banned) {
        window.location.href = "/banned";
        return;
      }

      setProfile(profileData || null);
    }

    const { data: streamsData, error: streamsError } = await supabase
      .from("streams")
      .select(
        "id, user_id, title, category, status, visibility, likes, viewers, total_views, peak_viewers, watch_minutes, thumbnail_url, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (streamsError) {
      setError(streamsError.message);
      setLoading(false);
      return;
    }

    setStreams((streamsData || []) as Stream[]);

    const dailyAnalytics = await safeSelect<AnalyticsRow>(
      supabase
        .from("stream_daily_analytics")
        .select("*")
        .eq("creator_id", user.id)
        .order("analytics_date", { ascending: true }),
      "analyticsAvailable"
    );

    setAnalyticsRows(dailyAnalytics);

    const tipRows = await safeSelect<TipRow>(
      supabase
        .from("stream_tips")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500),
      "tipsAvailable"
    );

    setTips(tipRows);

    const subscriptionRows = await safeSelect<SubscriptionRow>(
      supabase
        .from("creator_subscriptions")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500),
      "subscriptionsAvailable"
    );

    setSubscriptions(subscriptionRows);

    const walletRowsByCreator = await safeSelect<WalletRow>(
      supabase
        .from("creator_wallets")
        .select("*")
        .eq("creator_id", user.id)
        .limit(1),
      "walletAvailable"
    );

    if (walletRowsByCreator[0]) {
      setWallet(walletRowsByCreator[0]);
    } else {
      const walletRowsByUser = await safeSelect<WalletRow>(
        supabase
          .from("creator_wallets")
          .select("*")
          .eq("user_id", user.id)
          .limit(1),
        "walletAvailable"
      );

      setWallet(walletRowsByUser[0] || null);
    }

    const followRows = await safeSelect<FollowRow>(
      supabase
        .from("follows")
        .select("id, follower_id, following_id, created_at")
        .eq("following_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1000),
      "followsAvailable"
    );

    setFollows(followRows);

    const privatePayments = await safeSelect<PrivateCallPayment>(
      supabase
        .from("private_call_payments")
        .select(
          `
          id,
          stream_id,
          caller_id,
          creator_id,
          amount_aed,
          created_at,
          streams:stream_id (
            title
          ),
          profiles:caller_id (
            username,
            display_name
          )
        `
        )
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      "privatePaymentsAvailable"
    );

    setPrivateCallPayments(privatePayments);

    setLoading(false);
  }

  const analytics = useMemo(() => {
    const publicStreams = streams.filter((stream) => !isPrivateCallStream(stream));
    const privateCallStreams = streams.filter((stream) => isPrivateCallStream(stream));

    const publicStreamIds = new Set(publicStreams.map((stream) => stream.id));

    const publicAnalyticsRows = analyticsRows.filter((row) =>
      publicStreamIds.has(row.stream_id)
    );

    const completedTips = tips.filter((tip) => isCompletedStatus(tip.status));

    const activeSubscriptions = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "active"
    );

    const totalViewsFromAnalytics = publicAnalyticsRows.reduce(
      (sum, row) => sum + Number(row.views || 0),
      0
    );

    const totalViewsFromStreams = publicStreams.reduce(
      (sum, stream) => sum + Number(stream.total_views || stream.viewers || 0),
      0
    );

    const totalViews =
      totalViewsFromAnalytics > 0 ? totalViewsFromAnalytics : totalViewsFromStreams;

    const totalLikesFromAnalytics = publicAnalyticsRows.reduce(
      (sum, row) => sum + Number(row.likes || 0),
      0
    );

    const totalLikesFromStreams = publicStreams.reduce(
      (sum, stream) => sum + Number(stream.likes || 0),
      0
    );

    const totalLikes =
      totalLikesFromAnalytics > 0 ? totalLikesFromAnalytics : totalLikesFromStreams;

    const totalWatchFromAnalytics = publicAnalyticsRows.reduce(
      (sum, row) => sum + Number(row.watch_minutes || 0),
      0
    );

    const totalWatchFromStreams = publicStreams.reduce(
      (sum, stream) => sum + Number(stream.watch_minutes || 0),
      0
    );

    const watchMinutes =
      totalWatchFromAnalytics > 0 ? totalWatchFromAnalytics : totalWatchFromStreams;

    const peakViewersFromAnalytics = publicAnalyticsRows.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const peakViewersFromStreams = publicStreams.reduce(
      (max, stream) =>
        Math.max(max, Number(stream.peak_viewers || stream.viewers || 0)),
      0
    );

    const peakViewers = Math.max(peakViewersFromAnalytics, peakViewersFromStreams);

    const totalTipsRevenue = completedTips.reduce(
      (sum, tip) => sum + getTipValue(tip),
      0
    );

    const subscriptionRevenue = activeSubscriptions.reduce(
      (sum, item) => sum + Number(item.amount || item.price || 0),
      0
    );

    const privateCallRevenue = privateCallPayments.reduce(
      (sum, payment) => sum + Number(payment.amount_aed || 0),
      0
    );

    const walletBalance = Number(
      wallet?.available_balance_aed ??
        wallet?.available_balance ??
        wallet?.balance ??
        wallet?.lifetime_earnings_aed ??
        wallet?.total_earned ??
        0
    );

    const estimatedRevenue = Math.max(
      walletBalance,
      totalTipsRevenue + subscriptionRevenue + privateCallRevenue
    );

    const averageViews =
      publicStreams.length > 0 ? Math.round(totalViews / publicStreams.length) : 0;
    const averageLikes =
      publicStreams.length > 0 ? Math.round(totalLikes / publicStreams.length) : 0;
    const averageWatchMinutes =
      publicStreams.length > 0 ? Math.round(watchMinutes / publicStreams.length) : 0;

    const engagementRate =
      totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;

    const creatorScore = Math.min(
      100,
      Math.round(
        Math.min(totalViews / 10, 25) +
          Math.min(totalLikes * 2, 20) +
          Math.min(watchMinutes / 5, 20) +
          Math.min(peakViewers * 5, 15) +
          Math.min(privateCallRevenue / 10, 10) +
          Math.min(Number(profile?.followers || 0) / 2, 20)
      )
    );

    const ranking = getCreatorRanking(creatorScore, estimatedRevenue, totalViews);

    const topPublicStreams = [...publicStreams]
      .sort((a, b) => getStreamScore(b) - getStreamScore(a))
      .slice(0, 7);

    const privateCallPerformance = buildPrivateCallPerformance(
      privateCallStreams,
      privateCallPayments
    );

    const milestones = [
      {
        title: "First 10 followers",
        current: Number(profile?.followers || 0),
        target: 10,
      },
      {
        title: "100 public stream views",
        current: totalViews,
        target: 100,
      },
      {
        title: "60 public watch minutes",
        current: watchMinutes,
        target: 60,
      },
      {
        title: "$100 revenue",
        current: estimatedRevenue,
        target: 100,
      },
      {
        title: "5 private calls",
        current: privateCallPerformance.length,
        target: 5,
      },
    ];

    const monthlyData = buildMonthlyData({
      analyticsRows: publicAnalyticsRows,
      publicStreams,
      tips: completedTips,
      subscriptions: activeSubscriptions,
      follows,
      privateCallPayments,
      fallbackFollowers: Number(profile?.followers || 0),
    });

    const streamPerformance = topPublicStreams.map((stream) => ({
      title: shorten(stream.title, 18),
      views: Number(stream.total_views || stream.viewers || 0),
      likes: Number(stream.likes || 0),
      watchMinutes: Number(stream.watch_minutes || 0),
      peakViewers: Number(stream.peak_viewers || stream.viewers || 0),
    }));

    const privateCallChart = monthlyData.map((item) => ({
      label: item.label,
      privateCalls: item.privateCalls,
      privateCallRevenue: item.privateCallRevenue,
    }));

    return {
      publicStreams,
      privateCallStreams,
      totalStreams: streams.length,
      publicStreamCount: publicStreams.length,
      privateCallCount: privateCallStreams.length,
      liveStreams: publicStreams.filter((stream) => stream.status === "live").length,
      subscriberStreams: publicStreams.filter(
        (stream) => stream.visibility === "subscribers"
      ).length,
      totalViews,
      totalLikes,
      watchMinutes,
      peakViewers,
      averageViews,
      averageLikes,
      averageWatchMinutes,
      engagementRate,
      totalTipsRevenue,
      subscriptionRevenue,
      privateCallRevenue,
      walletBalance,
      estimatedRevenue,
      activeSubscriptions,
      creatorScore,
      ranking,
      topPublicStreams,
      privateCallPerformance,
      privateCallChart,
      milestones,
      monthlyData,
      streamPerformance,
    };
  }, [
    streams,
    analyticsRows,
    tips,
    subscriptions,
    wallet,
    follows,
    privateCallPayments,
    profile,
  ]);

  const creatorName = profile?.display_name || profile?.username || "Creator";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">📈</div>
          <p className="text-gray-400">Loading creator analytics...</p>
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
              Creator Analytics
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
                {creatorName}'s <span className="text-red-500">Performance</span>
              </h1>

              {profile?.is_verified && (
                <span className="w-fit rounded-full bg-blue-600 px-4 py-2 text-xs font-black">
                  ✓ Verified
                </span>
              )}

              <span className="w-fit rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-black text-gray-300">
                {analytics.ranking.label}
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-400 sm:text-base">
              Public stream analytics and private call analytics are separated properly. Private calls are measured by calls and revenue, not public views or likes.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
            <button
              onClick={loadAnalytics}
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <Stat label="Public Streams" value={analytics.publicStreamCount} />
          <Stat label="Private Calls" value={analytics.privateCallCount} color="text-purple-400" />
          <Stat label="Views" value={analytics.totalViews} color="text-blue-400" />
          <Stat label="Likes" value={analytics.totalLikes} color="text-red-400" />
          <Stat label="Peak" value={analytics.peakViewers} color="text-yellow-400" />
          <Stat label="Watch Min" value={analytics.watchMinutes} color="text-green-400" />
          <Stat label="Revenue" value={`AED ${formatMoney(analytics.estimatedRevenue)}`} color="text-green-400" />
          <Stat label="Score" value={`${analytics.creatorScore}/100`} color="text-pink-400" />
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-4">
          <InsightCard title="Creator Ranking" value={analytics.ranking.label} note={analytics.ranking.note} icon="🏆" />
          <InsightCard title="Avg Public Views" value={analytics.averageViews} note="Per public/subscriber stream" icon="👀" />
          <InsightCard title="Avg Watch Time" value={`${analytics.averageWatchMinutes} min`} note="Public/subscriber streams only" icon="⏱️" />
          <InsightCard title="Private Call Revenue" value={`$${formatMoney(analytics.privateCallRevenue)}`} note="Based on paid private calls" icon="📞" />
        </section>

        <SectionTitle
          title="Stream Analytics"
          note="Only public and subscriber-only streams are included here. Private calls are excluded."
        />

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Public Stream Growth" note="Views, watch minutes and peak viewers by month.">
            <LineGraph
              data={analytics.monthlyData}
              lines={[
                { key: "views", name: "Views", color: "#3b82f6" },
                { key: "watchMinutes", name: "Watch Min", color: "#22c55e" },
                { key: "peakViewers", name: "Peak", color: "#eab308" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Public Stream Performance" note="Top public/subscriber streams ranked by real stream metrics.">
            <BarGraph
              data={analytics.streamPerformance}
              xKey="title"
              bars={[
                { key: "views", name: "Views", color: "#3b82f6" },
                { key: "likes", name: "Likes", color: "#ef4444" },
                { key: "watchMinutes", name: "Watch Min", color: "#22c55e" },
              ]}
            />
          </ChartCard>
        </section>

        <SectionTitle
          title="Private Call Analytics"
          note="Private calls are measured separately because views, likes and public watch metrics do not apply."
        />

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Private Call Revenue" note="Paid private call revenue by month.">
            <BarGraph
              data={analytics.privateCallChart}
              bars={[
                { key: "privateCallRevenue", name: "Revenue", color: "#a855f7" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Private Call Count" note="Number of private calls by month.">
            <BarGraph
              data={analytics.privateCallChart}
              bars={[
                { key: "privateCalls", name: "Private Calls", color: "#8b5cf6" },
              ]}
            />
          </ChartCard>
        </section>

        <SectionTitle
          title="Revenue Analytics"
          note="Revenue combines tips, subscriptions and paid private calls."
        />

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Earnings History" note="Total creator revenue by month.">
            <LineGraph
              data={analytics.monthlyData}
              lines={[
                { key: "totalRevenue", name: "Total Revenue", color: "#22c55e" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Revenue Breakdown" note="Tips, subscriptions and private call revenue.">
            <BarGraph
              data={analytics.monthlyData}
              bars={[
                { key: "tipsRevenue", name: "Tips", color: "#ef4444" },
                { key: "subscriptionRevenue", name: "Subscriptions", color: "#eab308" },
                { key: "privateCallRevenue", name: "Private Calls", color: "#a855f7" },
              ]}
            />
          </ChartCard>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RevenueCard title="Tips Revenue" value={analytics.totalTipsRevenue} />
          <RevenueCard title="Subscription Revenue" value={analytics.subscriptionRevenue} />
          <RevenueCard title="Private Call Revenue" value={analytics.privateCallRevenue} />
          <RevenueCard title="Estimated Revenue" value={analytics.estimatedRevenue} highlight />
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:col-span-2">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Top Public Streams</h2>
              <p className="mt-1 text-sm text-gray-400">
                Private calls are intentionally excluded from this ranking.
              </p>
            </div>

            {analytics.topPublicStreams.length === 0 ? (
              <EmptyState icon="🎬" text="No public or subscriber stream analytics yet." />
            ) : (
              <div className="space-y-3">
                {analytics.topPublicStreams.map((stream, index) => (
                  <div
                    key={stream.id}
                    className="rounded-2xl border border-gray-800 bg-black/40 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-sm font-black">
                        #{index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-black sm:text-lg">
                          {stream.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category || "General"} • 👀{" "}
                          {stream.total_views || stream.viewers || 0} • ❤️{" "}
                          {stream.likes || 0} • Peak{" "}
                          {stream.peak_viewers || stream.viewers || 0} • ⏱️{" "}
                          {stream.watch_minutes || 0} min
                        </p>
                      </div>

                      <Link
                        href={`/live/${stream.id}`}
                        className="rounded-xl bg-gray-800 px-4 py-2 text-center text-sm font-bold hover:bg-gray-700"
                      >
                        Studio
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-5 text-2xl font-black">Creator Milestones</h2>

            <div className="space-y-4">
              {analytics.milestones.map((milestone) => {
                const percent = Math.min(
                  100,
                  Math.round((Number(milestone.current || 0) / milestone.target) * 100)
                );

                return (
                  <div key={milestone.title}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{milestone.title}</p>
                      <p className="text-xs text-gray-400">
                        {formatMoney(Number(milestone.current || 0))}/{milestone.target}
                      </p>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-red-600"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-purple-500/20 bg-purple-500/10">
          <div className="border-b border-purple-500/20 p-5 sm:p-6">
            <h2 className="text-2xl font-black">Private Call Performance</h2>
            <p className="mt-1 text-sm text-gray-300">
              Paid private calls are tracked by caller, revenue and date.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-black/40 text-gray-300">
                <tr>
                  <th className="px-5 py-4">Call</th>
                  <th className="px-5 py-4">Caller</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {analytics.privateCallPerformance.map((call) => (
                  <tr key={call.id} className="border-t border-purple-500/10">
                    <td className="max-w-[260px] truncate px-5 py-4 font-bold">
                      {call.title}
                    </td>
                    <td className="px-5 py-4 text-gray-300">{call.callerName}</td>
                    <td className="px-5 py-4 font-black text-purple-300">
                      AED {formatMoney(call.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-200">
                        {call.streamStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400">
                      {new Date(call.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}

                {analytics.privateCallPerformance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                      No paid private call performance yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Live Public Streams" value={analytics.liveStreams} />
          <MiniStat label="Public/Sub Streams" value={analytics.publicStreamCount} />
          <MiniStat label="Private Rooms" value={analytics.privateCallCount} />
          <MiniStat label="Subscriber Streams" value={analytics.subscriberStreams} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">Separated Stream Breakdown</h2>
            <p className="mt-1 text-sm text-gray-400">
              Public streams and private calls are listed together here, but scoring only applies properly to public stream metrics.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Visibility</th>
                  <th className="px-5 py-4">Views</th>
                  <th className="px-5 py-4">Peak</th>
                  <th className="px-5 py-4">Watch Min</th>
                  <th className="px-5 py-4">Likes</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {streams.map((stream) => {
                  const privateCall = isPrivateCallStream(stream);

                  return (
                    <tr key={stream.id} className="border-t border-gray-800">
                      <td className="max-w-[280px] truncate px-5 py-4 font-bold">
                        {stream.title}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            privateCall
                              ? "rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300"
                              : "rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300"
                          }
                        >
                          {privateCall ? "Private Call" : "Stream"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            stream.status === "live"
                              ? "rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400"
                              : "rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-400"
                          }
                        >
                          {stream.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-gray-300">
                        {stream.visibility || "public"}
                      </td>

                      <td className="px-5 py-4">
                        {privateCall ? "N/A" : stream.total_views || stream.viewers || 0}
                      </td>

                      <td className="px-5 py-4">
                        {privateCall ? "N/A" : stream.peak_viewers || stream.viewers || 0}
                      </td>

                      <td className="px-5 py-4">
                        {privateCall ? "N/A" : stream.watch_minutes || 0}
                      </td>

                      <td className="px-5 py-4">
                        {privateCall ? "N/A" : stream.likes || 0}
                      </td>

                      <td className="px-5 py-4 text-gray-400">
                        {new Date(stream.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}

                {streams.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                      No streams or private calls created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {(!optionalTables.analyticsAvailable ||
          !optionalTables.tipsAvailable ||
          !optionalTables.subscriptionsAvailable ||
          !optionalTables.followsAvailable ||
          !optionalTables.privatePaymentsAvailable) && (
          <section className="mt-8 rounded-2xl border border-yellow-700/40 bg-yellow-500/10 p-5 text-sm leading-6 text-yellow-100">
            Some optional analytics sources were not readable. The page did not crash, but unavailable sections are using fallback data where possible.
          </section>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">{note}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <p className="mb-2 truncate text-xs text-gray-400 sm:text-sm">{label}</p>
      <h2 className={`break-words text-2xl font-black leading-none sm:text-3xl ${color}`}>
        {value}
      </h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="mb-2 text-xs text-gray-400 sm:text-sm">{label}</p>
      <h3 className="text-2xl font-black">{value}</h3>
    </div>
  );
}

function InsightCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string | number;
  note: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-400">{title}</p>
        <span className="text-3xl">{icon}</span>
      </div>
      <h2 className="break-words text-3xl font-black">{value}</h2>
      <p className="mt-2 text-sm text-gray-500">{note}</p>
    </div>
  );
}

function RevenueCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-green-700 bg-green-950/30 p-5"
          : "rounded-2xl border border-gray-800 bg-gray-900 p-5"
      }
    >
      <p className="mb-2 text-sm text-gray-400">{title}</p>
      <h2 className={highlight ? "text-3xl font-black text-green-400" : "text-3xl font-black"}>
        AED {formatMoney(value)}
      </h2>
    </div>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{note}</p>
      </div>

      <div className="h-[320px] rounded-2xl bg-black/30 p-3">{children}</div>
    </div>
  );
}

function LineGraph({
  data,
  lines,
}: {
  data: ChartPoint[];
  lines: { key: keyof ChartPoint; name: string; color: string }[];
}) {
  if (data.length === 0) {
    return <EmptyState icon="📉" text="No chart data available yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="label" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip />
        <Legend />
        {lines.map((line) => (
          <Line
            key={String(line.key)}
            type="monotone"
            dataKey={String(line.key)}
            name={line.name}
            stroke={line.color}
            strokeWidth={3}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarGraph({
  data,
  bars,
  xKey = "label",
}: {
  data: any[];
  bars: { key: string; name: string; color: string }[];
  xKey?: string;
}) {
  if (data.length === 0) {
    return <EmptyState icon="📊" text="No chart data available yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey={xKey} stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center text-gray-400">
      <div className="mb-3 text-4xl">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function buildMonthlyData({
  analyticsRows,
  publicStreams,
  tips,
  subscriptions,
  follows,
  privateCallPayments,
  fallbackFollowers,
}: {
  analyticsRows: AnalyticsRow[];
  publicStreams: Stream[];
  tips: TipRow[];
  subscriptions: SubscriptionRow[];
  follows: FollowRow[];
  privateCallPayments: PrivateCallPayment[];
  fallbackFollowers: number;
}): ChartPoint[] {
  const months = getLastSixMonths();

  return months.map((month) => {
    const analyticsForMonth = analyticsRows.filter((row) =>
      isSameMonth(row.analytics_date, month.date)
    );

    const fallbackStreamsForMonth = publicStreams.filter((stream) =>
      isSameMonth(stream.created_at, month.date)
    );

    const tipsForMonth = tips.filter((tip) => isSameMonth(tip.created_at, month.date));

    const subscriptionsForMonth = subscriptions.filter((item) =>
      isSameMonth(item.created_at, month.date)
    );

    const privatePaymentsForMonth = privateCallPayments.filter((payment) =>
      isSameMonth(payment.created_at, month.date)
    );

    const followersUpToMonth =
      follows.length > 0
        ? follows.filter(
            (follow) =>
              new Date(follow.created_at).getTime() <= month.endDate.getTime()
          ).length
        : month.isCurrentMonth
          ? fallbackFollowers
          : 0;

    const tipsRevenue = tipsForMonth.reduce(
      (sum, tip) => sum + getTipValue(tip),
      0
    );

    const subscriptionRevenue = subscriptionsForMonth.reduce(
      (sum, item) => sum + Number(item.amount || item.price || 0),
      0
    );

    const privateCallRevenue = privatePaymentsForMonth.reduce(
      (sum, payment) => sum + Number(payment.amount_aed || 0),
      0
    );

    const viewsFromAnalytics = analyticsForMonth.reduce(
      (sum, row) => sum + Number(row.views || 0),
      0
    );

    const likesFromAnalytics = analyticsForMonth.reduce(
      (sum, row) => sum + Number(row.likes || 0),
      0
    );

    const watchFromAnalytics = analyticsForMonth.reduce(
      (sum, row) => sum + Number(row.watch_minutes || 0),
      0
    );

    const peakFromAnalytics = analyticsForMonth.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const viewsFromStreams = fallbackStreamsForMonth.reduce(
      (sum, stream) => sum + Number(stream.total_views || stream.viewers || 0),
      0
    );

    const likesFromStreams = fallbackStreamsForMonth.reduce(
      (sum, stream) => sum + Number(stream.likes || 0),
      0
    );

    const watchFromStreams = fallbackStreamsForMonth.reduce(
      (sum, stream) => sum + Number(stream.watch_minutes || 0),
      0
    );

    const peakFromStreams = fallbackStreamsForMonth.reduce(
      (max, stream) =>
        Math.max(max, Number(stream.peak_viewers || stream.viewers || 0)),
      0
    );

    return {
      label: month.label,
      views: viewsFromAnalytics > 0 ? viewsFromAnalytics : viewsFromStreams,
      likes: likesFromAnalytics > 0 ? likesFromAnalytics : likesFromStreams,
      watchMinutes: watchFromAnalytics > 0 ? watchFromAnalytics : watchFromStreams,
      peakViewers: Math.max(peakFromAnalytics, peakFromStreams),
      tipsRevenue,
      subscriptionRevenue,
      privateCallRevenue,
      totalRevenue: tipsRevenue + subscriptionRevenue + privateCallRevenue,
      followers: followersUpToMonth,
      privateCalls: privatePaymentsForMonth.length,
    };
  });
}

function buildPrivateCallPerformance(
  privateCallStreams: Stream[],
  privateCallPayments: PrivateCallPayment[]
): PrivateCallPerformanceRow[] {
  const streamMap = new Map(privateCallStreams.map((stream) => [stream.id, stream]));

  if (privateCallPayments.length > 0) {
    return privateCallPayments.map((payment) => {
      const stream = streamMap.get(payment.stream_id);

      return {
        id: payment.id,
        title: payment.streams?.title || stream?.title || "Private call",
        callerName:
          payment.profiles?.display_name ||
          payment.profiles?.username ||
          "Caller",
        amount: Number(payment.amount_aed || 0),
        createdAt: payment.created_at,
        streamStatus: stream?.status || "paid",
      };
    });
  }

  return privateCallStreams.map((stream) => ({
    id: stream.id,
    title: stream.title || "Private call",
    callerName: "Caller",
    amount: 0,
    createdAt: stream.created_at,
    streamStatus: stream.status || "created",
  }));
}

function getLastSixMonths() {
  const now = new Date();

  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    return {
      date,
      endDate,
      label: date.toLocaleString([], { month: "short" }),
      isCurrentMonth:
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear(),
    };
  });
}

function isSameMonth(value: string, monthDate: Date) {
  const date = new Date(value);

  return (
    date.getMonth() === monthDate.getMonth() &&
    date.getFullYear() === monthDate.getFullYear()
  );
}

function getTipValue(tip: TipRow) {
  return Number(tip.creator_amount_aed ?? tip.amount_aed ?? tip.amount ?? 0);
}

function isCompletedStatus(status: string | null) {
  if (!status) return true;

  return ["completed", "paid", "success", "succeeded", "approved"].includes(
    status.toLowerCase()
  );
}

function isPrivateCallStream(stream: Stream) {
  const title = String(stream.title || "").toLowerCase();
  const category = String(stream.category || "").toLowerCase();

  return (
    stream.visibility === "private" ||
    title.includes("private one-on-one call") ||
    title.includes("private call") ||
    category.includes("private call")
  );
}

function getStreamScore(stream: Stream) {
  return (
    Number(stream.total_views || stream.viewers || 0) +
    Number(stream.likes || 0) * 3 +
    Number(stream.peak_viewers || stream.viewers || 0) * 2 +
    Number(stream.watch_minutes || 0)
  );
}

function getCreatorRanking(score: number, revenue: number, views: number) {
  if (score >= 85 || revenue >= 1000 || views >= 10000) {
    return {
      label: "Elite Creator",
      note: "Strong performance across audience, content and revenue.",
    };
  }

  if (score >= 65 || revenue >= 500 || views >= 5000) {
    return {
      label: "Pro Creator",
      note: "Good traction. Improve consistency and monetization.",
    };
  }

  if (score >= 40 || revenue >= 100 || views >= 1000) {
    return {
      label: "Rising Creator",
      note: "Early traction. Focus on regular streams and follower growth.",
    };
  }

  return {
    label: "New Creator",
    note: "You need more public streams, viewers, private calls and revenue.",
  };
}

function shorten(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
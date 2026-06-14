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
  balance?: number | null;
  available_balance?: number | null;
  pending_balance?: number | null;
  total_earned?: number | null;
  total_withdrawn?: number | null;
};

type FollowRow = {
  id: string;
  follower_id?: string;
  following_id?: string;
  created_at: string;
};

type OptionalTableState = {
  analyticsAvailable: boolean;
  tipsAvailable: boolean;
  subscriptionsAvailable: boolean;
  walletAvailable: boolean;
  followsAvailable: boolean;
};

type ChartPoint = {
  label: string;
  views: number;
  likes: number;
  watchMinutes: number;
  peakViewers: number;
  tipsRevenue: number;
  subscriptionRevenue: number;
  totalRevenue: number;
  followers: number;
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
  const [error, setError] = useState("");

  const [optionalTables, setOptionalTables] = useState<OptionalTableState>({
    analyticsAvailable: true,
    tipsAvailable: true,
    subscriptionsAvailable: true,
    walletAvailable: true,
    followsAvailable: true,
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

    const walletRows = await safeSelect<WalletRow>(
      supabase
        .from("creator_wallets")
        .select("*")
        .eq("user_id", user.id)
        .limit(1),
      "walletAvailable"
    );

    setWallet(walletRows[0] || null);

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

    setLoading(false);
  }

  const analytics = useMemo(() => {
    const completedTips = tips.filter((tip) =>
      isCompletedStatus(tip.status)
    );

    const activeSubscriptions = subscriptions.filter(
      (item) => String(item.status || "").toLowerCase() === "active"
    );

    const totalViewsFromAnalytics = analyticsRows.reduce(
      (sum, row) => sum + Number(row.views || 0),
      0
    );

    const totalViewsFromStreams = streams.reduce(
      (sum, stream) => sum + Number(stream.total_views || stream.viewers || 0),
      0
    );

    const totalViews =
      totalViewsFromAnalytics > 0 ? totalViewsFromAnalytics : totalViewsFromStreams;

    const totalLikesFromAnalytics = analyticsRows.reduce(
      (sum, row) => sum + Number(row.likes || 0),
      0
    );

    const totalLikesFromStreams = streams.reduce(
      (sum, stream) => sum + Number(stream.likes || 0),
      0
    );

    const totalLikes =
      totalLikesFromAnalytics > 0 ? totalLikesFromAnalytics : totalLikesFromStreams;

    const totalWatchFromAnalytics = analyticsRows.reduce(
      (sum, row) => sum + Number(row.watch_minutes || 0),
      0
    );

    const totalWatchFromStreams = streams.reduce(
      (sum, stream) => sum + Number(stream.watch_minutes || 0),
      0
    );

    const watchMinutes =
      totalWatchFromAnalytics > 0 ? totalWatchFromAnalytics : totalWatchFromStreams;

    const peakViewersFromAnalytics = analyticsRows.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const peakViewersFromStreams = streams.reduce(
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

    const walletBalance = Number(
      wallet?.available_balance ?? wallet?.balance ?? wallet?.total_earned ?? 0
    );

    const estimatedRevenue = Math.max(
      walletBalance,
      totalTipsRevenue + subscriptionRevenue
    );

    const totalStreams = streams.length;
    const liveStreams = streams.filter((stream) => stream.status === "live").length;
    const publicStreams = streams.filter((stream) => stream.visibility !== "private").length;
    const privateStreams = streams.filter((stream) => stream.visibility === "private").length;
    const subscriberStreams = streams.filter(
      (stream) => stream.visibility === "subscribers"
    ).length;

    const averageViews = totalStreams > 0 ? Math.round(totalViews / totalStreams) : 0;
    const averageLikes = totalStreams > 0 ? Math.round(totalLikes / totalStreams) : 0;
    const averageWatchMinutes =
      totalStreams > 0 ? Math.round(watchMinutes / totalStreams) : 0;

    const engagementRate =
      totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;

    const creatorScore = Math.min(
      100,
      Math.round(
        Math.min(totalViews / 10, 25) +
          Math.min(totalLikes * 2, 20) +
          Math.min(watchMinutes / 5, 20) +
          Math.min(peakViewers * 5, 15) +
          Math.min(Number(profile?.followers || 0) / 2, 20)
      )
    );

    const ranking = getCreatorRanking(creatorScore, estimatedRevenue, totalViews);

    const topStreams = [...streams]
      .sort((a, b) => getStreamScore(b) - getStreamScore(a))
      .slice(0, 7);

    const milestones = [
      {
        title: "First 10 followers",
        current: Number(profile?.followers || 0),
        target: 10,
      },
      {
        title: "100 total views",
        current: totalViews,
        target: 100,
      },
      {
        title: "60 watch minutes",
        current: watchMinutes,
        target: 60,
      },
      {
        title: "AED 100 revenue",
        current: estimatedRevenue,
        target: 100,
      },
      {
        title: "10 created streams",
        current: totalStreams,
        target: 10,
      },
    ];

    const monthlyData = buildMonthlyData({
      analyticsRows,
      tips: completedTips,
      subscriptions: activeSubscriptions,
      follows,
      fallbackFollowers: Number(profile?.followers || 0),
    });

    const streamPerformance = topStreams.map((stream) => ({
      title: shorten(stream.title, 18),
      views: Number(stream.total_views || stream.viewers || 0),
      likes: Number(stream.likes || 0),
      watchMinutes: Number(stream.watch_minutes || 0),
      peakViewers: Number(stream.peak_viewers || stream.viewers || 0),
    }));

    return {
      totalStreams,
      liveStreams,
      publicStreams,
      privateStreams,
      subscriberStreams,
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
      walletBalance,
      estimatedRevenue,
      activeSubscriptions,
      creatorScore,
      ranking,
      topStreams,
      milestones,
      monthlyData,
      streamPerformance,
    };
  }, [streams, analyticsRows, tips, subscriptions, wallet, follows, profile]);

  const creatorName = profile?.display_name || profile?.username || "Creator";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">📈</div>
          <p className="text-gray-400">Loading advanced creator analytics...</p>
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
              Advanced Creator Dashboard
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
                {creatorName}'s <span className="text-red-500">Analytics</span>
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
              Follower growth, revenue history, stream performance, monthly breakdown, milestones and creator ranking.
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
          <Stat label="Streams" value={analytics.totalStreams} />
          <Stat label="Views" value={analytics.totalViews} color="text-blue-400" />
          <Stat label="Likes" value={analytics.totalLikes} color="text-red-400" />
          <Stat label="Peak" value={analytics.peakViewers} color="text-purple-400" />
          <Stat label="Watch Min" value={analytics.watchMinutes} color="text-yellow-400" />
          <Stat label="Followers" value={profile?.followers || 0} color="text-cyan-400" />
          <Stat label="Revenue" value={`AED ${formatMoney(analytics.estimatedRevenue)}`} color="text-green-400" />
          <Stat label="Score" value={`${analytics.creatorScore}/100`} color="text-pink-400" />
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-4">
          <InsightCard title="Creator Ranking" value={analytics.ranking.label} note={analytics.ranking.note} icon="🏆" />
          <InsightCard title="Avg Views" value={analytics.averageViews} note="Per stream average" icon="👀" />
          <InsightCard title="Avg Likes" value={analytics.averageLikes} note="Per stream average" icon="❤️" />
          <InsightCard title="Avg Watch Time" value={`${analytics.averageWatchMinutes} min`} note="Per stream average" icon="⏱️" />
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Follower Growth Chart" note={optionalTables.followsAvailable ? "Based on follows created over time." : "Fallback snapshot because follows table/column was not readable."}>
            <LineGraph
              data={analytics.monthlyData}
              lines={[
                { key: "followers", name: "Followers", color: "#22d3ee" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Earnings History Chart" note="Tips plus active subscription revenue by month.">
            <LineGraph
              data={analytics.monthlyData}
              lines={[
                { key: "totalRevenue", name: "Total Revenue", color: "#22c55e" },
              ]}
            />
          </ChartCard>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Tips Revenue Chart" note={optionalTables.tipsAvailable ? "Based on stream_tips." : "stream_tips table was not readable."}>
            <BarGraph
              data={analytics.monthlyData}
              bars={[
                { key: "tipsRevenue", name: "Tips Revenue", color: "#ef4444" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Subscription Revenue Chart" note={optionalTables.subscriptionsAvailable ? "Based on active creator_subscriptions." : "creator_subscriptions table was not readable."}>
            <BarGraph
              data={analytics.monthlyData}
              bars={[
                { key: "subscriptionRevenue", name: "Subscription Revenue", color: "#a855f7" },
              ]}
            />
          </ChartCard>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Stream Performance Chart" note="Top streams ranked by views, likes, watch minutes and peak viewers.">
            <BarGraph
              data={analytics.streamPerformance}
              xKey="title"
              bars={[
                { key: "views", name: "Views", color: "#3b82f6" },
                { key: "likes", name: "Likes", color: "#ef4444" },
                { key: "watchMinutes", name: "Watch Min", color: "#eab308" },
              ]}
            />
          </ChartCard>

          <ChartCard title="Monthly Revenue Breakdown" note="Tips, subscriptions and combined revenue.">
            <BarGraph
              data={analytics.monthlyData}
              bars={[
                { key: "tipsRevenue", name: "Tips", color: "#ef4444" },
                { key: "subscriptionRevenue", name: "Subscriptions", color: "#a855f7" },
                { key: "totalRevenue", name: "Total", color: "#22c55e" },
              ]}
            />
          </ChartCard>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:col-span-2">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Top Performing Streams</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Ranked by views, likes, peak viewers and watch minutes.
                </p>
              </div>
            </div>

            {analytics.topStreams.length === 0 ? (
              <EmptyState icon="🎬" text="No streams found yet." />
            ) : (
              <div className="space-y-3">
                {analytics.topStreams.map((stream, index) => (
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

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RevenueCard title="Tips Revenue" value={analytics.totalTipsRevenue} />
          <RevenueCard title="Subscription Revenue" value={analytics.subscriptionRevenue} />
          <RevenueCard title="Wallet Balance" value={analytics.walletBalance} />
          <RevenueCard title="Estimated Revenue" value={analytics.estimatedRevenue} highlight />
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Live Streams" value={analytics.liveStreams} />
          <MiniStat label="Public Streams" value={analytics.publicStreams} />
          <MiniStat label="Private Rooms" value={analytics.privateStreams} />
          <MiniStat label="Subscriber Streams" value={analytics.subscriberStreams} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">Stream Breakdown</h2>
            <p className="mt-1 text-sm text-gray-400">
              Full stream-level performance table.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Title</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Visibility</th>
                  <th className="px-5 py-4">Views</th>
                  <th className="px-5 py-4">Peak</th>
                  <th className="px-5 py-4">Watch Min</th>
                  <th className="px-5 py-4">Likes</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {streams.map((stream) => (
                  <tr key={stream.id} className="border-t border-gray-800">
                    <td className="max-w-[280px] truncate px-5 py-4 font-bold">
                      {stream.title}
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
                      {stream.total_views || stream.viewers || 0}
                    </td>

                    <td className="px-5 py-4">
                      {stream.peak_viewers || stream.viewers || 0}
                    </td>

                    <td className="px-5 py-4">{stream.watch_minutes || 0}</td>

                    <td className="px-5 py-4">{stream.likes || 0}</td>

                    <td className="px-5 py-4 font-bold text-red-400">
                      {getStreamScore(stream)}
                    </td>

                    <td className="px-5 py-4 text-gray-400">
                      {new Date(stream.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}

                {streams.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-gray-400">
                      No streams created yet.
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
          !optionalTables.followsAvailable) && (
          <section className="mt-8 rounded-2xl border border-yellow-700/40 bg-yellow-500/10 p-5 text-sm leading-6 text-yellow-100">
            Some optional analytics sources were not readable. The page did not crash, but those charts are using fallback data where possible.
          </section>
        )}
      </div>
    </main>
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
  tips,
  subscriptions,
  follows,
  fallbackFollowers,
}: {
  analyticsRows: AnalyticsRow[];
  tips: TipRow[];
  subscriptions: SubscriptionRow[];
  follows: FollowRow[];
  fallbackFollowers: number;
}): ChartPoint[] {
  const months = getLastSixMonths();

  return months.map((month) => {
    const analyticsForMonth = analyticsRows.filter((row) =>
      isSameMonth(row.analytics_date, month.date)
    );

    const tipsForMonth = tips.filter((tip) => isSameMonth(tip.created_at, month.date));

    const subscriptionsForMonth = subscriptions.filter((item) =>
      isSameMonth(item.created_at, month.date)
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

    return {
      label: month.label,
      views: analyticsForMonth.reduce((sum, row) => sum + Number(row.views || 0), 0),
      likes: analyticsForMonth.reduce((sum, row) => sum + Number(row.likes || 0), 0),
      watchMinutes: analyticsForMonth.reduce(
        (sum, row) => sum + Number(row.watch_minutes || 0),
        0
      ),
      peakViewers: analyticsForMonth.reduce(
        (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
        0
      ),
      tipsRevenue,
      subscriptionRevenue,
      totalRevenue: tipsRevenue + subscriptionRevenue,
      followers: followersUpToMonth,
    };
  });
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
        date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(),
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
    note: "You need more streams, viewers, watch time and engagement.",
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
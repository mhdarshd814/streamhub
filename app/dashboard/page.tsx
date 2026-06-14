"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  following: number | null;
  is_verified?: boolean | null;
  is_banned?: boolean | null;
  creator_level?: string | null;
};

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  likes: number | null;
  viewers: number | null;
  total_views?: number | null;
  peak_viewers?: number | null;
  watch_minutes?: number | null;
  thumbnail_url?: string | null;
  created_at: string;
};

type ScheduledStream = {
  id: string;
  creator_id: string;
  title: string;
  category: string;
  description: string | null;
  scheduled_start: string;
  notify_followers: boolean;
  status: string;
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

type ReminderRow = {
  id: string;
  scheduled_stream_id: string;
  user_id: string;
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
  created_at?: string | null;
};

type OptionalTableState = {
  walletAvailable: boolean;
  tipsAvailable: boolean;
  subscriptionsAvailable: boolean;
  scheduledAvailable: boolean;
  remindersAvailable: boolean;
  analyticsAvailable: boolean;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [scheduledStreams, setScheduledStreams] = useState<ScheduledStream[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [optionalTables, setOptionalTables] = useState<OptionalTableState>({
    walletAvailable: true,
    tipsAvailable: true,
    subscriptionsAvailable: true,
    scheduledAvailable: true,
    remindersAvailable: true,
    analyticsAvailable: true,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function safeSelect<T>(
    table: string,
    queryBuilder: any,
    tableKey: keyof OptionalTableState
  ): Promise<T[]> {
    const { data, error } = await queryBuilder;

    if (error) {
      console.warn(`${table} dashboard query skipped:`, error.message);
      setOptionalTables((current) => ({ ...current, [tableKey]: false }));
      return [];
    }

    setOptionalTables((current) => ({ ...current, [tableKey]: true }));
    return (data || []) as T[];
  }

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, followers, following, is_verified, is_banned, creator_level"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      const fallbackProfile = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, followers, following, is_verified, is_banned"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (fallbackProfile.error) {
        alert(fallbackProfile.error.message);
        setLoading(false);
        return;
      }

      if (fallbackProfile.data?.is_banned) {
        window.location.href = "/banned";
        return;
      }

      setProfile(fallbackProfile.data || null);
    } else {
      if (profileData?.is_banned) {
        window.location.href = "/banned";
        return;
      }

      setProfile(profileData || null);
    }

    const { data: streamsData, error: streamsError } = await supabase
      .from("streams")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (streamsError) {
      alert(streamsError.message);
      setLoading(false);
      return;
    }

    setStreams((streamsData || []) as Stream[]);

    const scheduledData = await safeSelect<ScheduledStream>(
      "scheduled_streams",
      supabase
        .from("scheduled_streams")
        .select("*")
        .eq("creator_id", user.id)
        .order("scheduled_start", { ascending: true }),
      "scheduledAvailable"
    );

    setScheduledStreams(scheduledData);

    if (scheduledData.length > 0) {
      const scheduledIds = scheduledData.map((item) => item.id);

      const reminderData = await safeSelect<ReminderRow>(
        "stream_reminders",
        supabase
          .from("stream_reminders")
          .select("id, scheduled_stream_id, user_id")
          .in("scheduled_stream_id", scheduledIds),
        "remindersAvailable"
      );

      setReminders(reminderData);
    } else {
      setReminders([]);
    }

    const walletRows = await safeSelect<WalletRow>(
      "creator_wallets",
      supabase
        .from("creator_wallets")
        .select("*")
        .eq("user_id", user.id)
        .limit(1),
      "walletAvailable"
    );

    setWallet(walletRows[0] || null);

    const tipsByCreator = await safeSelect<TipRow>(
      "stream_tips",
      supabase
        .from("stream_tips")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      "tipsAvailable"
    );

    setTips(tipsByCreator);

    const activeSubscriptions = await safeSelect<SubscriptionRow>(
      "creator_subscriptions",
      supabase
        .from("creator_subscriptions")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      "subscriptionsAvailable"
    );

    setSubscriptions(activeSubscriptions);

    const analyticsRows = await safeSelect<AnalyticsRow>(
      "stream_daily_analytics",
      supabase
        .from("stream_daily_analytics")
        .select("*")
        .eq("creator_id", user.id)
        .order("analytics_date", { ascending: true }),
      "analyticsAvailable"
    );

    setAnalyticsData(analyticsRows);

    setLoading(false);
  }

  async function deleteStream(id: string) {
    const confirmed = confirm("Delete this stream? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(id);

    const { error } = await supabase.from("streams").delete().eq("id", id);

    setDeletingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setStreams((current) => current.filter((stream) => stream.id !== id));
  }

  async function cancelSchedule(id: string) {
    const confirmed = confirm("Cancel this scheduled stream?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("scheduled_streams")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setScheduledStreams((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "cancelled" } : item
      )
    );
  }

  function openLiveRoom(id: string) {
    window.location.href = `/live/${id}`;
  }

  function editStream(id: string) {
    window.location.href = `/stream/edit/${id}`;
  }

  function openWatch(stream: Stream) {
    if (stream.visibility === "private") {
      alert("Private calls cannot be watched publicly.");
      return;
    }

    if (stream.status !== "live") {
      alert("This stream is currently offline.");
      return;
    }

    window.location.href = `/watch/${stream.id}`;
  }

  const stats = useMemo(() => {
    const totalLikes = streams.reduce(
      (total, stream) => total + Number(stream.likes || 0),
      0
    );

    const totalViews = streams.reduce(
      (total, stream) =>
        total + Number(stream.total_views || stream.viewers || 0),
      0
    );

    const analyticsViews = analyticsData.reduce(
      (total, row) => total + Number(row.views || 0),
      0
    );

    const analyticsWatchMinutes = analyticsData.reduce(
      (total, row) => total + Number(row.watch_minutes || 0),
      0
    );

    const analyticsLikes = analyticsData.reduce(
      (total, row) => total + Number(row.likes || 0),
      0
    );

    const totalWatchMinutesFromStreams = streams.reduce(
      (total, stream) => total + Number(stream.watch_minutes || 0),
      0
    );

    const totalWatchMinutes =
      analyticsWatchMinutes > 0 ? analyticsWatchMinutes : totalWatchMinutesFromStreams;

    const peakViewersFromStreams = streams.reduce(
      (max, stream) =>
        Math.max(max, Number(stream.peak_viewers || stream.viewers || 0)),
      0
    );

    const peakViewersFromAnalytics = analyticsData.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const peakViewers = Math.max(peakViewersFromStreams, peakViewersFromAnalytics);

    const liveStreams = streams.filter((stream) => stream.status === "live").length;
    const offlineStreams = streams.filter((stream) => stream.status !== "live").length;
    const publicStreams = streams.filter((stream) => stream.visibility !== "private").length;
    const privateStreams = streams.filter((stream) => stream.visibility === "private").length;
    const subscriberStreams = streams.filter((stream) => stream.visibility === "subscribers").length;

    const finalTotalViews = analyticsViews > 0 ? analyticsViews : totalViews;
    const finalTotalLikes = analyticsLikes > 0 ? analyticsLikes : totalLikes;

    const averageLikes =
      streams.length > 0 ? Math.round(finalTotalLikes / streams.length) : 0;

    const averageViews =
      streams.length > 0 ? Math.round(finalTotalViews / streams.length) : 0;

    const averageWatchMinutes =
      streams.length > 0 ? Math.round(totalWatchMinutes / streams.length) : 0;

    const engagementScore =
      finalTotalViews > 0 ? Math.round((finalTotalLikes / finalTotalViews) * 100) : 0;

    const activeScheduled = scheduledStreams.filter(
      (item) =>
        item.status === "scheduled" &&
        new Date(item.scheduled_start).getTime() > Date.now()
    );

    const nextScheduled = [...activeScheduled].sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    )[0];

    const totalReminders = reminders.length;

    const completedTips = tips.filter(
      (tip) =>
        !tip.status ||
        ["completed", "paid", "success", "succeeded", "approved"].includes(
          tip.status
        )
    );

    const totalTips = completedTips.reduce((total, tip) => {
      const value =
        tip.creator_amount_aed ??
        tip.amount_aed ??
        tip.amount ??
        0;

      return total + Number(value || 0);
    }, 0);

    const activeSubscriptions = subscriptions.filter(
      (item) => item.status === "active"
    );

    const subscriptionRevenue = activeSubscriptions.reduce(
      (total, item) => total + Number(item.amount || item.price || 0),
      0
    );

    const walletBalance = Number(
      wallet?.available_balance ?? wallet?.balance ?? wallet?.total_earned ?? 0
    );

    const estimatedRevenue = Math.max(walletBalance, totalTips + subscriptionRevenue);

    const topStreams = [...streams]
      .sort((a, b) => {
        const aScore =
          Number(a.likes || 0) +
          Number(a.total_views || a.viewers || 0) +
          Number(a.peak_viewers || 0);

        const bScore =
          Number(b.likes || 0) +
          Number(b.total_views || b.viewers || 0) +
          Number(b.peak_viewers || 0);

        return bScore - aScore;
      })
      .slice(0, 5);

    const topStream = topStreams[0];

    const creatorHealthScore = Math.min(
      100,
      Math.round(
        engagementScore * 0.3 +
          Math.min(finalTotalViews / 100, 30) +
          Math.min(finalTotalLikes / 10, 20) +
          Math.min(profile?.followers || 0, 30)
      )
    );

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthAnalytics = analyticsData.filter((row) => {
      const date = new Date(row.analytics_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const monthlyViews = thisMonthAnalytics.reduce(
      (total, row) => total + Number(row.views || 0),
      0
    );

    const monthlyWatchMinutes = thisMonthAnalytics.reduce(
      (total, row) => total + Number(row.watch_minutes || 0),
      0
    );

    const monthlyPeakViewers = thisMonthAnalytics.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const monthlyTips = completedTips
      .filter((tip) => {
        const date = new Date(tip.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((total, tip) => {
        const value =
          tip.creator_amount_aed ??
          tip.amount_aed ??
          tip.amount ??
          0;

        return total + Number(value || 0);
      }, 0);

    const monthlySubscriptions = activeSubscriptions.filter((item) => {
      const date = new Date(item.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    return {
      totalLikes: finalTotalLikes,
      totalViews: finalTotalViews,
      totalWatchMinutes,
      peakViewers,
      liveStreams,
      offlineStreams,
      publicStreams,
      privateStreams,
      subscriberStreams,
      averageLikes,
      averageViews,
      averageWatchMinutes,
      engagementScore,
      activeScheduled,
      nextScheduled,
      totalReminders,
      totalTips,
      activeSubscriptions,
      subscriptionRevenue,
      walletBalance,
      estimatedRevenue,
      topStream,
      topStreams,
      creatorHealthScore,
      monthlyViews,
      monthlyWatchMinutes,
      monthlyPeakViewers,
      monthlyTips,
      monthlySubscriptions,
    };
  }, [streams, scheduledStreams, reminders, tips, subscriptions, wallet, analyticsData, profile]);

  const creatorName = profile?.display_name || profile?.username || "Creator";
  const creatorLevel =
    profile?.creator_level || (profile?.is_verified ? "Verified" : "Standard");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">📊</div>
          <p className="text-gray-400">Loading creator dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400 sm:text-base">
              Creator Command Center
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="break-words text-3xl font-black sm:text-4xl lg:text-5xl">
                Welcome back, <span className="text-red-500">{creatorName}</span>
              </h1>

              {profile?.is_verified && (
                <span className="w-fit rounded-full bg-blue-600 px-4 py-2 text-xs font-black sm:text-sm">
                  ✓ Verified Creator
                </span>
              )}

              <span className="w-fit rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-black text-gray-300 sm:text-sm">
                {creatorLevel} Level
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-400 sm:text-base lg:text-lg">
              Manage streams, scheduled events, revenue signals, reminders, audience growth and creator performance from one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={loadDashboard}
              className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:py-4 sm:text-base"
            >
              Refresh
            </button>

            <button
              onClick={() => (window.location.href = "/schedule")}
              className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700 sm:px-6 sm:py-4 sm:text-base"
            >
              Schedule
            </button>

            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700 sm:px-6 sm:py-4 sm:text-base"
            >
              + Create
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:mb-10 lg:grid-cols-5 lg:gap-5">
          <QuickAction icon="🎥" title="Create Stream" text="Start live, private or subscriber stream." href="/go-live" />
          <QuickAction icon="📅" title="Schedule" text="Plan upcoming streams." href="/schedule" />
          <QuickAction icon="🗓️" title="Upcoming" text="View scheduled creator streams." href="/streams/upcoming" />
          <QuickAction icon="📞" title="Private Calls" text="Manage one-on-one calls." href="/calls" />
          <QuickAction icon="💰" title="Wallet" text="Earnings, tips and payouts." href="/wallet" />
          <QuickAction icon="📈" title="Analytics" text="Views, growth and performance." href="/analytics" />
          <QuickAction icon="🔔" title="Notifications" text="Activity and reminder alerts." href="/notifications" />
          <QuickAction icon="⭐" title="Following" text="Your creator feed." href="/following" />
          <QuickAction icon="🔍" title="Explore" text="Discover creators." href="/explore" />
          <QuickAction icon="⚙️" title="Settings" text="Edit your profile." href="/profile/edit" />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4 lg:gap-6">
          <StatCard label="Total Streams" value={streams.length} note={`${stats.publicStreams} public • ${stats.privateStreams} private • ${stats.subscriberStreams} subscriber`} />
          <StatCard label="Total Views" value={stats.totalViews} note={`Avg ${stats.averageViews} per stream`} valueClass="text-purple-400" />
          <StatCard label="Total Likes" value={stats.totalLikes} note={`Avg ${stats.averageLikes} per stream`} valueClass="text-red-500" />
          <StatCard label="Followers" value={profile?.followers || 0} note={`Following ${profile?.following || 0}`} valueClass="text-green-500" />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4 lg:gap-6">
          <StatCard label="Live Now" value={stats.liveStreams} valueClass="text-green-500" />
          <StatCard label="Scheduled" value={stats.activeScheduled.length} note={`${stats.totalReminders} reminders set`} valueClass="text-yellow-400" />
          <StatCard label="Peak Viewers" value={stats.peakViewers} valueClass="text-yellow-400" />
          <StatCard label="Engagement" value={`${stats.engagementScore}%`} note="Likes divided by views" valueClass="text-blue-400" />
        </div>

        <div className="mb-10 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">
                Creator Analytics V2
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Daily views, peak viewers and watch-time performance.
              </p>
            </div>

            <div className="w-fit rounded-xl bg-red-600 px-4 py-2 text-sm font-bold">
              Score: {stats.creatorHealthScore}/100
            </div>
          </div>

          <div className="h-[320px] rounded-2xl bg-black/30 p-3">
            {analyticsData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-gray-400">
                No analytics rows yet. Data will appear after stream_daily_analytics starts receiving records.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="analytics_date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={3} />
                  <Line type="monotone" dataKey="peak_viewers" stroke="#facc15" strokeWidth={3} />
                  <Line type="monotone" dataKey="watch_minutes" stroke="#22c55e" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Watch Minutes" value={stats.totalWatchMinutes} valueClass="text-green-500" />
            <StatCard label="Peak Viewers" value={stats.peakViewers} valueClass="text-yellow-400" />
            <StatCard label="Tips Revenue" value={`AED ${formatMoney(stats.totalTips)}`} valueClass="text-green-400" />
            <StatCard label="Subscriptions" value={stats.activeSubscriptions.length} valueClass="text-purple-400" />
          </div>
        </div>

        <div className="mb-10 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
          <div className="mb-6">
            <h2 className="text-2xl font-black sm:text-3xl">Monthly Creator Summary</h2>
            <p className="mt-1 text-sm text-gray-400">Current month creator performance snapshot.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Monthly Views" value={stats.monthlyViews} valueClass="text-purple-400" />
            <StatCard label="Watch Minutes" value={stats.monthlyWatchMinutes} valueClass="text-green-500" />
            <StatCard label="Monthly Peak" value={stats.monthlyPeakViewers} valueClass="text-yellow-400" />
            <StatCard label="Monthly Tips" value={`AED ${formatMoney(stats.monthlyTips)}`} valueClass="text-green-400" />
            <StatCard label="New Subs" value={stats.monthlySubscriptions} valueClass="text-purple-400" />
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:mb-10 lg:grid-cols-3 lg:gap-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">Estimated Revenue</p>
                <h2 className="mt-2 text-3xl font-black text-green-400 sm:text-4xl">
                  AED {formatMoney(stats.estimatedRevenue)}
                </h2>
              </div>
              <div className="text-4xl">💰</div>
            </div>

            <div className="space-y-2 text-sm text-gray-400">
              <p>Tips: AED {formatMoney(stats.totalTips)}</p>
              <p>Active subscriptions: {stats.activeSubscriptions.length}</p>
              <p>Wallet balance: AED {formatMoney(stats.walletBalance)}</p>
            </div>

            {!optionalTables.walletAvailable && !optionalTables.tipsAvailable && (
              <p className="mt-4 rounded-xl border border-yellow-700/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                Wallet/tips tables were not readable. Revenue is showing fallback values only.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">Watch Time</p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                  {stats.totalWatchMinutes} min
                </h2>
              </div>
              <div className="text-4xl">⏱️</div>
            </div>

            <p className="text-sm text-gray-400">
              Avg {stats.averageWatchMinutes} min per stream. This becomes more useful once replay/watch tracking is fully connected.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = "/verification")}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left transition hover:border-red-600 sm:p-6 lg:p-7"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">Creator Status</p>
                <h2
                  className={
                    profile?.is_verified
                      ? "mt-2 text-3xl font-black text-blue-400 sm:text-4xl"
                      : "mt-2 text-3xl font-black text-gray-400 sm:text-4xl"
                  }
                >
                  {profile?.is_verified ? "Verified" : "Standard"}
                </h2>
              </div>
              <div className="text-4xl">✅</div>
            </div>

            <p className="text-sm text-gray-400">
              {profile?.is_verified
                ? "Your badge is active."
                : "Tap to request verification and improve creator trust."}
            </p>
          </button>
        </div>

        <div className="mb-8 grid gap-6 lg:mb-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black sm:text-3xl">Next Scheduled Stream</h2>
                <p className="mt-1 text-sm text-gray-400">Your next planned stream and reminder demand.</p>
              </div>
              <button
                onClick={() => (window.location.href = "/schedule")}
                className="shrink-0 rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700"
              >
                New
              </button>
            </div>

            {stats.nextScheduled ? (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-black">{stats.nextScheduled.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{stats.nextScheduled.category}</p>
                  </div>
                  <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                    {stats.nextScheduled.status}
                  </span>
                </div>

                {stats.nextScheduled.description && (
                  <p className="mt-3 text-sm leading-6 text-gray-300">
                    {stats.nextScheduled.description}
                  </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-900 p-3 text-sm text-gray-300">
                    ⏰ {formatDateTime(stats.nextScheduled.scheduled_start)}
                  </div>
                  <div className="rounded-xl bg-gray-900 p-3 text-sm text-gray-300">
                    🔔 {getReminderCount(stats.nextScheduled.id, reminders)} reminders
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => (window.location.href = "/go-live")}
                    className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700"
                  >
                    Create Matching Stream
                  </button>
                  <button
                    onClick={() => cancelSchedule(stats.nextScheduled!.id)}
                    className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700"
                  >
                    Cancel Schedule
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-6 text-center text-gray-400">
                <p className="mb-3 text-4xl">📭</p>
                <p>No upcoming scheduled streams.</p>
                <button
                  onClick={() => (window.location.href = "/schedule")}
                  className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                >
                  Schedule Stream
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:p-7">
            <div className="mb-5">
              <h2 className="text-2xl font-black sm:text-3xl">Top 5 Streams</h2>
              <p className="mt-1 text-sm text-gray-400">Ranked by likes, views and peak viewers.</p>
            </div>

            {stats.topStreams.length > 0 ? (
              <div className="space-y-3">
                {stats.topStreams.map((stream, index) => (
                  <div key={stream.id} className="rounded-2xl border border-gray-800 bg-black/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-sm font-black">
                        #{index + 1}
                      </div>
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black">{stream.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category} • ❤️ {stream.likes || 0} • 👀 {stream.total_views || stream.viewers || 0} • Peak {stream.peak_viewers || stream.viewers || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-6 text-center text-gray-400">
                <p className="mb-3 text-4xl">🎬</p>
                <p>No performance data yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 lg:mb-10">
          <div className="flex flex-col gap-4 border-b border-gray-800 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Upcoming Schedule</h2>
              <p className="mt-1 text-sm text-gray-400 sm:text-base">Planned streams with reminder interest.</p>
            </div>

            <button
              onClick={() => (window.location.href = "/schedule")}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
            >
              Schedule New
            </button>
          </div>

          {scheduledStreams.length === 0 ? (
            <div className="p-8 text-center text-gray-400 sm:p-10">
              <p className="mb-3 text-5xl">📅</p>
              <p>No scheduled streams yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {scheduledStreams.slice(0, 5).map((item) => (
                <div key={item.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          item.status === "scheduled"
                            ? "rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300"
                            : "rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300"
                        }
                      >
                        {item.status}
                      </span>
                      <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-300">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="break-words text-lg font-bold sm:text-xl">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      ⏰ {formatDateTime(item.scheduled_start)} • 🔔 {getReminderCount(item.id, reminders)} reminders
                    </p>
                  </div>

                  {item.status === "scheduled" && (
                    <button
                      onClick={() => cancelSchedule(item.id)}
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-red-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex flex-col gap-4 border-b border-gray-800 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black sm:text-3xl">Stream Library</h2>
              <p className="mt-1 text-sm text-gray-400 sm:text-base">Manage every stream, monitor performance and reopen your studio.</p>
            </div>

            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
            >
              New Stream
            </button>
          </div>

          {streams.length === 0 ? (
            <div className="p-8 text-center sm:p-10">
              <p className="mb-4 text-5xl">🎬</p>
              <h3 className="mb-2 text-2xl font-bold">No streams created yet</h3>
              <p className="mb-6 text-gray-400">Create your first stream room and start building your audience.</p>

              <button
                onClick={() => (window.location.href = "/go-live")}
                className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
              >
                Create Stream
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {streams.map((stream) => {
                const isLive = stream.status === "live";
                const isPrivate = stream.visibility === "private";
                const isSubscribers = stream.visibility === "subscribers";

                return (
                  <div key={stream.id} className="flex flex-col gap-5 p-4 transition hover:bg-gray-800/50 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-800 sm:h-20 sm:w-28 sm:shrink-0">
                        {stream.thumbnail_url ? (
                          <img src={stream.thumbnail_url} alt={stream.title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-gray-500">No Image</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={isLive ? "rounded-full bg-red-600 px-3 py-1 text-xs font-black" : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400"}>
                            {isLive ? "LIVE" : "OFFLINE"}
                          </span>

                          <span className={isPrivate ? "rounded-full bg-purple-600 px-3 py-1 text-xs font-black" : isSubscribers ? "rounded-full bg-yellow-600 px-3 py-1 text-xs font-black" : "rounded-full bg-green-600 px-3 py-1 text-xs font-black"}>
                            {isPrivate ? "PRIVATE" : isSubscribers ? "SUBSCRIBERS" : "PUBLIC"}
                          </span>
                        </div>

                        <h3 className="break-words text-lg font-bold sm:text-xl">{stream.title}</h3>

                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category} • ❤️ {stream.likes || 0} • 👀 {stream.total_views || stream.viewers || 0} • Peak {stream.peak_viewers || stream.viewers || 0} • ⏱️ {stream.watch_minutes || 0} min
                        </p>

                        <p className="mt-1 text-xs text-gray-500">Created {formatDateTime(stream.created_at)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                      <button onClick={() => openLiveRoom(stream.id)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700">
                        Studio
                      </button>

                      {!isPrivate && (
                        <button
                          onClick={() => openWatch(stream)}
                          disabled={!isLive}
                          className={
                            isLive
                              ? "rounded-lg bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-700"
                              : "cursor-not-allowed rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-gray-500"
                          }
                        >
                          Watch
                        </button>
                      )}

                      <button onClick={() => editStream(stream.id)} className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-bold hover:bg-gray-600">
                        Edit
                      </button>

                      <button onClick={() => deleteStream(stream.id)} disabled={deletingId === stream.id} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700 disabled:text-gray-500">
                        {deletingId === stream.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  text,
  href,
}: {
  icon: string;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <button
      onClick={() => (window.location.href = href)}
      className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition hover:border-red-600 sm:p-5 lg:p-6"
    >
      <div className="mb-3 text-2xl">{icon}</div>
      <h2 className="mb-2 text-base font-bold sm:text-lg">{title}</h2>
      <p className="text-xs text-gray-400 sm:text-sm">{text}</p>
    </button>
  );
}

function StatCard({
  label,
  value,
  note,
  valueClass = "",
}: {
  label: string;
  value: string | number;
  note?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-7">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black sm:text-4xl ${valueClass}`}>
        {value}
      </h2>
      {note && <p className="mt-2 text-xs text-gray-500 sm:text-sm">{note}</p>}
    </div>
  );
}

function getReminderCount(scheduledStreamId: string, reminders: ReminderRow[]) {
  return reminders.filter((item) => item.scheduled_stream_id === scheduledStreamId).length;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
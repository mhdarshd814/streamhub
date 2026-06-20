"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);

const Line = dynamic(() => import("recharts").then((mod) => mod.Line), {
  ssr: false,
});

const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);

const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), {
  ssr: false,
});

const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), {
  ssr: false,
});

const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), {
  ssr: false,
});

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
  creator_id?: string;
  balance?: number | null;
  available_balance?: number | null;
  available_balance_usd?: number | null;
  pending_balance?: number | null;
  pending_balance_usd?: number | null;
  total_earned?: number | null;
  lifetime_earnings_usd?: number | null;
  total_withdrawn?: number | null;
};

type TipRow = {
  id: string;
  creator_id?: string;
  receiver_id?: string;
  amount?: number | null;
  amount_usd?: number | null;
  creator_amount_usd?: number | null;
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


type PrivateCallRow = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string | null;
  status: string | null;
  ring_status?: string | null;
  missed?: boolean | null;
  created_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  expires_at?: string | null;
};

type PrivateCallPaymentRow = {
  id: string;
  caller_id?: string | null;
  creator_id?: string | null;
  receiver_id?: string | null;
  stream_id?: string | null;
  amount?: number | null;
  amount_usd?: number | null;
  status?: string | null;
  created_at: string;
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
  const [privateCalls, setPrivateCalls] = useState<PrivateCallRow[]>([]);
  const [privateCallPayments, setPrivateCallPayments] = useState<PrivateCallPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    setIsDesktop(desktop);
    loadDashboard(desktop);
  }, []);

  async function safeSelect<T>(queryBuilder: any): Promise<T[]> {
    const { data, error } = await queryBuilder;

    if (error) {
      console.warn("Dashboard query skipped:", error.message);
      return [];
    }

    return (data || []) as T[];
  }

  async function loadDashboard(loadDesktopOnly = isDesktop) {
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
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    setProfile(profileData || null);

    const [
      streamsResult,
      scheduledResult,
      walletCreatorResult,
      walletUserResult,
      tipsResult,
      subscriptionsResult,
      privateCallsResult,
      privatePaymentsResult,
      analyticsResult,
    ] = await Promise.all([
      safeSelect<Stream>(
        supabase.from("streams").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(loadDesktopOnly ? 80 : 25)
      ),
      safeSelect<ScheduledStream>(
        supabase.from("scheduled_streams").select("*").eq("creator_id", user.id).order("scheduled_start", { ascending: true }).limit(20)
      ),
      safeSelect<WalletRow>(
        supabase.from("creator_wallets").select("*").eq("creator_id", user.id).limit(1)
      ),
      safeSelect<WalletRow>(
        supabase.from("creator_wallets").select("*").eq("user_id", user.id).limit(1)
      ),
      safeSelect<TipRow>(
        supabase.from("stream_tips").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(loadDesktopOnly ? 60 : 15)
      ),
      safeSelect<SubscriptionRow>(
        supabase.from("creator_subscriptions").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(loadDesktopOnly ? 60 : 15)
      ),
      safeSelect<PrivateCallRow>(
        supabase.from("private_call_requests").select("*").or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(loadDesktopOnly ? 60 : 20)
      ),
      safeSelect<PrivateCallPaymentRow>(
        supabase.from("private_call_payments").select("*").or(`creator_id.eq.${user.id},caller_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(loadDesktopOnly ? 60 : 20)
      ),
      loadDesktopOnly
        ? safeSelect<AnalyticsRow>(
            supabase.from("stream_daily_analytics").select("*").eq("creator_id", user.id).order("analytics_date", { ascending: true }).limit(90)
          )
        : Promise.resolve([]),
    ]);

    setStreams(streamsResult);
    setScheduledStreams(scheduledResult);
    setWallet(walletCreatorResult[0] || walletUserResult[0] || null);
    setTips(tipsResult);
    setSubscriptions(subscriptionsResult);
    setPrivateCalls(privateCallsResult);
    setPrivateCallPayments(privatePaymentsResult);
    setAnalyticsData(analyticsResult);

    if (scheduledResult.length > 0) {
      const scheduledIds = scheduledResult.map((item) => item.id);

      const reminderData = await safeSelect<ReminderRow>(
        supabase.from("stream_reminders").select("id, scheduled_stream_id, user_id").in("scheduled_stream_id", scheduledIds)
      );

      setReminders(reminderData);
    } else {
      setReminders([]);
    }

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

    const totalWatchMinutesFromStreams = streams.reduce(
      (total, stream) => total + Number(stream.watch_minutes || 0),
      0
    );

    const totalWatchMinutes =
      analyticsWatchMinutes > 0
        ? analyticsWatchMinutes
        : totalWatchMinutesFromStreams;

    const peakViewersFromStreams = streams.reduce(
      (max, stream) =>
        Math.max(max, Number(stream.peak_viewers || stream.viewers || 0)),
      0
    );

    const peakViewersFromAnalytics = analyticsData.reduce(
      (max, row) => Math.max(max, Number(row.peak_viewers || 0)),
      0
    );

    const peakViewers = Math.max(
      peakViewersFromStreams,
      peakViewersFromAnalytics
    );

    const liveStreams = streams.filter((stream) => stream.status === "live").length;
    const publicStreams = streams.filter((stream) => stream.visibility !== "private").length;
    const privateStreams = streams.filter((stream) => stream.visibility === "private").length;

    const finalTotalViews = analyticsViews > 0 ? analyticsViews : totalViews;

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

    const completedTips = tips.filter(
      (tip) =>
        !tip.status ||
        ["completed", "paid", "success", "succeeded", "approved"].includes(
          tip.status
        )
    );

    const totalTips = completedTips.reduce((total, tip) => {
      const value = tip.creator_amount_usd ?? tip.amount_usd ?? tip.amount ?? 0;
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
      wallet?.available_balance_usd ??
        wallet?.available_balance ??
        wallet?.balance ??
        wallet?.lifetime_earnings_usd ??
        wallet?.total_earned ??
        0
    );

    const completedPrivateCallPayments = privateCallPayments.filter(
      (payment) =>
        !payment.status ||
        ["completed", "paid", "success", "succeeded", "approved"].includes(
          payment.status
        )
    );

    const privateCallRevenue = completedPrivateCallPayments.reduce(
      (total, payment) =>
        total + Number(payment.amount_usd ?? payment.amount ?? 0),
      0
    );

    const estimatedRevenue = Math.max(
      walletBalance,
      totalTips + subscriptionRevenue + privateCallRevenue
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const acceptedPrivateCalls = privateCalls.filter(
      (call) => call.status === "accepted"
    );

    const pendingPrivateCalls = privateCalls.filter(
      (call) => call.status === "pending"
    );

    const declinedPrivateCalls = privateCalls.filter(
      (call) => call.status === "declined"
    );

    const missedPrivateCalls = privateCalls.filter(
      (call) =>
        call.status === "missed" ||
        call.ring_status === "expired" ||
        call.missed === true
    );

    const todayPrivateCalls = privateCalls.filter(
      (call) => new Date(call.created_at).getTime() >= todayStart.getTime()
    );

    const paidPrivateCalls = privateCallPayments.length;
    const freePrivateCalls = Math.max(
      0,
      acceptedPrivateCalls.length - paidPrivateCalls
    );

    const latestPrivateCalls = privateCalls.slice(0, 5);

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

    return {
      totalLikes,
      totalViews: finalTotalViews,
      totalWatchMinutes,
      peakViewers,
      liveStreams,
      publicStreams,
      privateStreams,
      activeScheduled,
      nextScheduled,
      totalTips,
      activeSubscriptions,
      subscriptionRevenue,
      walletBalance,
      privateCallRevenue,
      estimatedRevenue,
      privateCalls,
      acceptedPrivateCalls,
      pendingPrivateCalls,
      declinedPrivateCalls,
      missedPrivateCalls,
      todayPrivateCalls,
      paidPrivateCalls,
      freePrivateCalls,
      latestPrivateCalls,
      topStreams,
    };
  }, [
    streams,
    scheduledStreams,
    tips,
    subscriptions,
    wallet,
    analyticsData,
    privateCalls,
    privateCallPayments,
  ]);

  const creatorName = profile?.display_name || profile?.username || "Creator";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">📊</div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-32 pt-5 text-white sm:px-6 lg:px-8 lg:pb-10 lg:pt-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-red-400">
              Creator Dashboard
            </p>

            <h1 className="break-words text-3xl font-black sm:text-4xl lg:text-5xl">
              Welcome, <span className="text-red-500">{creatorName}</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Mobile dashboard is simplified for speed. Full analytics appear on desktop.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={() => loadDashboard(isDesktop)}
              className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-700"
            >
              Go Live
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          <StatCard label="Streams" value={streams.length} note={`${stats.publicStreams} public • ${stats.privateStreams} private`} />
          <StatCard label="Live Now" value={stats.liveStreams} valueClass="text-green-500" />
          <StatCard label="Views" value={stats.totalViews} valueClass="text-purple-400" />
          <StatCard label="Followers" value={profile?.followers || 0} valueClass="text-blue-400" />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          <StatCard label="Likes" value={stats.totalLikes} valueClass="text-red-500" />
          <StatCard label="Peak Viewers" value={stats.peakViewers} valueClass="text-yellow-400" />
          <StatCard label="Watch Minutes" value={stats.totalWatchMinutes} valueClass="text-green-400" />
          <StatCard label="Revenue" value={`$${formatMoney(stats.estimatedRevenue)}`} valueClass="text-green-400" />
        </div>

        <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold text-purple-300">
                Private Call Analytics
              </p>
              <h2 className="text-2xl font-black sm:text-3xl">
                One-on-One Call Performance
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Free calls are counted here. Paid calls are counted here and in revenue only when payment rows exist.
              </p>
            </div>

            <button
              onClick={() => (window.location.href = "/calls")}
              className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-black hover:bg-purple-700"
            >
              Open Calls
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total Calls"
              value={stats.privateCalls.length}
              note={`${stats.todayPrivateCalls.length} today`}
              valueClass="text-purple-300"
            />
            <StatCard
              label="Accepted"
              value={stats.acceptedPrivateCalls.length}
              note={`${stats.freePrivateCalls} free • ${stats.paidPrivateCalls} paid`}
              valueClass="text-green-400"
            />
            <StatCard
              label="Pending"
              value={stats.pendingPrivateCalls.length}
              valueClass="text-yellow-300"
            />
            <StatCard
              label="Missed / Declined"
              value={stats.missedPrivateCalls.length + stats.declinedPrivateCalls.length}
              note={`${stats.missedPrivateCalls.length} missed • ${stats.declinedPrivateCalls.length} declined`}
              valueClass="text-red-400"
            />
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-black/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">Recent Private Calls</h3>
              <p className="text-xs font-bold text-purple-200">
                Revenue: ${formatMoney(stats.privateCallRevenue)}
              </p>
            </div>

            {stats.latestPrivateCalls.length === 0 ? (
              <div className="rounded-xl border border-gray-800 bg-black/30 p-5 text-center text-sm text-gray-400">
                No private calls yet. Free calls will appear here after acceptance.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.latestPrivateCalls.map((call) => {
                  const isAccepted = call.status === "accepted";
                  const isDeclined = call.status === "declined";
                  const isMissed =
                    call.status === "missed" ||
                    call.ring_status === "expired" ||
                    call.missed === true;

                  return (
                    <div
                      key={call.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-black/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black">
                          {call.stream_id ? `Room ${call.stream_id.slice(0, 8)}` : "Private call"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(call.created_at)}
                        </p>
                      </div>

                      <span
                        className={
                          isAccepted
                            ? "w-fit rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-400"
                            : isDeclined || isMissed
                              ? "w-fit rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300"
                              : "w-fit rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300"
                        }
                      >
                        {(call.status || "pending").toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
          <MobileAction icon="🎥" label="Go Live" href="/go-live" />
          <MobileAction icon="📞" label="Calls" href="/calls" />
          <MobileAction icon="💰" label="Wallet" href="/wallet" />
          <MobileAction icon="✏️" label="Edit Profile" href="/profile/edit" />
        </div>

        {isDesktop && (
          <div className="mb-10 hidden rounded-2xl border border-gray-800 bg-gray-900 p-7 lg:block">
            <div className="mb-6">
              <h2 className="text-3xl font-black">Desktop Analytics</h2>
              <p className="mt-1 text-sm text-gray-400">
                Recharts loads only on desktop to keep Android lighter.
              </p>
            </div>

            <div className="h-[320px] rounded-2xl bg-black/30 p-3">
              {analyticsData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-gray-400">
                  No analytics rows yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="analytics_date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="#ef4444"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="peak_viewers"
                      stroke="#facc15"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="watch_minutes"
                      stroke="#22c55e"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Next Schedule</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Your next planned stream.
                </p>
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
                <h3 className="break-words text-xl font-black">
                  {stats.nextScheduled.title}
                </h3>

                <p className="mt-2 text-sm text-gray-400">
                  {stats.nextScheduled.category} •{" "}
                  {formatDateTime(stats.nextScheduled.scheduled_start)}
                </p>

                <p className="mt-2 text-sm text-gray-400">
                  🔔 {getReminderCount(stats.nextScheduled.id, reminders)} reminders
                </p>

                <button
                  onClick={() => cancelSchedule(stats.nextScheduled!.id)}
                  className="mt-4 rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-red-600"
                >
                  Cancel Schedule
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-6 text-center text-gray-400">
                <p className="mb-3 text-4xl">📭</p>
                <p>No upcoming scheduled streams.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Top Streams</h2>
              <p className="mt-1 text-sm text-gray-400">
                Ranked by likes, views and peak viewers.
              </p>
            </div>

            {stats.topStreams.length > 0 ? (
              <div className="space-y-3">
                {stats.topStreams.map((stream, index) => (
                  <div
                    key={stream.id}
                    className="rounded-2xl border border-gray-800 bg-black/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-sm font-black">
                        #{index + 1}
                      </div>

                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black">
                          {stream.title}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category} • ❤️ {stream.likes || 0} • 👀{" "}
                          {stream.total_views || stream.viewers || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-black/40 p-6 text-center text-gray-400">
                <p className="mb-3 text-4xl">🎬</p>
                <p>No stream data yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="flex flex-col gap-4 border-b border-gray-800 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black">My Streams</h2>
              <p className="mt-1 text-sm text-gray-400">
                Create, reopen, watch or delete your streams.
              </p>
            </div>

            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700"
            >
              New Stream
            </button>
          </div>

          {streams.length === 0 ? (
            <div className="p-8 text-center">
              <p className="mb-4 text-5xl">🎬</p>
              <h3 className="mb-2 text-2xl font-bold">No streams yet</h3>
              <p className="mb-6 text-gray-400">
                Create your first live or private call room.
              </p>

              <button
                onClick={() => (window.location.href = "/go-live")}
                className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
              >
                Go Live
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {streams.map((stream) => {
                const isLive = stream.status === "live";
                const isPrivate = stream.visibility === "private";

                return (
                  <div
                    key={stream.id}
                    className="flex flex-col gap-5 p-4 transition hover:bg-gray-800/50 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-800 sm:h-20 sm:w-28 sm:shrink-0">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-500">No Image</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              isLive
                                ? "rounded-full bg-red-600 px-3 py-1 text-xs font-black"
                                : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-400"
                            }
                          >
                            {isLive ? "LIVE" : "OFFLINE"}
                          </span>

                          <span
                            className={
                              isPrivate
                                ? "rounded-full bg-purple-600 px-3 py-1 text-xs font-black"
                                : "rounded-full bg-green-600 px-3 py-1 text-xs font-black"
                            }
                          >
                            {isPrivate ? "PRIVATE CALL" : "PUBLIC"}
                          </span>
                        </div>

                        <h3 className="break-words text-lg font-bold sm:text-xl">
                          {stream.title}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-400">
                          {stream.category} • ❤️ {stream.likes || 0} • 👀{" "}
                          {stream.total_views || stream.viewers || 0}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                      <button
                        onClick={() => openLiveRoom(stream.id)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700"
                      >
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

                      <button
                        onClick={() => deleteStream(stream.id)}
                        disabled={deletingId === stream.id}
                        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700 disabled:text-gray-500"
                      >
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

function MobileAction({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <button
      onClick={() => (window.location.href = href)}
      className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left active:scale-95"
    >
      <div className="mb-3 text-2xl">{icon}</div>
      <h2 className="text-sm font-black">{label}</h2>
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
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black sm:text-4xl ${valueClass}`}>
        {value}
      </h2>
      {note && <p className="mt-2 text-xs text-gray-500 sm:text-sm">{note}</p>}
    </div>
  );
}

function getReminderCount(scheduledStreamId: string, reminders: ReminderRow[]) {
  return reminders.filter((item) => item.scheduled_stream_id === scheduledStreamId)
    .length;
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


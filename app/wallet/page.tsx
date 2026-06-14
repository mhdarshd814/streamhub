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

type Wallet = {
  id: string;
  creator_id: string;
  available_balance_aed: number;
  pending_balance_aed: number;
  lifetime_earnings_aed: number;
};

type Tip = {
  id: string;
  amount_aed: number;
  platform_fee_aed: number;
  creator_amount_aed: number;
  message: string | null;
  status: string;
  provider: string;
  created_at: string;
  streams?: {
    title?: string | null;
  } | null;
};

type PayoutRequest = {
  id: string;
  amount_aed: number;
  status: string;
  payout_note: string | null;
  admin_note: string | null;
  created_at: string;
};

type PrivateCallPayment = {
  id: string;
  stream_id: string;
  caller_id: string;
  creator_id: string;
  amount_aed: number;
  created_at: string;
  streams?: {
    title?: string | null;
  } | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

type SubscriptionPlan = {
  id: string;
  creator_id: string;
  plan_name: string;
  price_aed: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type Tier = {
  name: string;
  price: number;
  benefit: string;
  icon: string;
};

type RevenuePoint = {
  label: string;
  tips: number;
  subscriptions: number;
  privateCalls: number;
  creatorRevenue: number;
  platformFees: number;
  grossRevenue: number;
};

const TIERS: Tier[] = [
  { name: "Supporter", price: 5, benefit: "Basic Support", icon: "🤝" },
  { name: "Premium", price: 10, benefit: "Subscriber Chat", icon: "⭐" },
  { name: "VIP", price: 25, benefit: "Premium Access", icon: "💎" },
  { name: "Pro Creator", price: 50, benefit: "All Benefits", icon: "🚀" },
];

const PLAN_PRICES: Record<string, number> = TIERS.reduce(
  (acc, tier) => {
    acc[tier.name] = tier.price;
    return acc;
  },
  {} as Record<string, number>
);

const PLAN_NAMES = TIERS.map((tier) => tier.name);

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [privateCallPayments, setPrivateCallPayments] = useState<PrivateCallPayment[]>([]);

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [planName, setPlanName] = useState("Premium");
  const [planDescription, setPlanDescription] = useState(
    "Monthly creator subscription with subscriber-only stream access."
  );
  const [activeSubscriberCount, setActiveSubscriberCount] = useState(0);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (profile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    await supabase.from("creator_wallets").upsert(
      { creator_id: user.id },
      { onConflict: "creator_id" }
    );

    const { data: walletData, error: walletError } = await supabase
      .from("creator_wallets")
      .select("*")
      .eq("creator_id", user.id)
      .maybeSingle();

    if (walletError) {
      alert(walletError.message);
      setLoading(false);
      return;
    }

    setWallet(walletData);

    const { data: tipData } = await supabase
      .from("stream_tips")
      .select(
        `
        id,
        amount_aed,
        platform_fee_aed,
        creator_amount_aed,
        message,
        status,
        provider,
        created_at,
        streams:stream_id (
          title
        )
      `
      )
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setTips((tipData || []) as Tip[]);

    const { data: payoutData } = await supabase
      .from("creator_payout_requests")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setPayouts(payoutData || []);

    const { data: callPaymentData } = await supabase
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
      .limit(100);

    setPrivateCallPayments((callPaymentData || []) as PrivateCallPayment[]);

    const { data: planData } = await supabase
      .from("creator_subscription_plans")
      .select("*")
      .eq("creator_id", user.id)
      .maybeSingle();

    if (planData) {
      setPlan(planData);

      const safePlanName = PLAN_NAMES.includes(planData.plan_name)
        ? planData.plan_name
        : "Premium";

      setPlanName(safePlanName);

      setPlanDescription(
        planData.description ||
          "Monthly creator subscription with subscriber-only stream access."
      );
    }

    const { count, error: subscriberCountError } = await supabase
      .from("creator_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("status", "active");

    if (!subscriberCountError) {
      setActiveSubscriberCount(count || 0);
    }

    setLoading(false);
  }

  async function saveSubscriptionPlan() {
    const price = PLAN_PRICES[planName];

    if (!price) {
      alert("Please select a valid plan.");
      return;
    }

    setSavingPlan(true);

    const { data, error } = await supabase.rpc(
      "upsert_creator_subscription_plan",
      {
        new_plan_name: planName,
        new_price_aed: price,
        new_description: planDescription.trim() || null,
      }
    );

    setSavingPlan(false);

    if (error) {
      alert(error.message || "Failed to save subscription plan.");
      return;
    }

    setPlan(data);
    alert("Subscription plan updated successfully.");
    await loadWallet();
  }

  async function requestPayout() {
    if (!wallet) return;

    const amount = Number(payoutAmount);

    if (!amount || amount <= 0) {
      alert("Enter a valid payout amount.");
      return;
    }

    if (amount > wallet.available_balance_aed) {
      alert("You cannot request more than your available balance.");
      return;
    }

    const confirmed = confirm(
      `Request payout of AED ${amount}?\n\nThis amount will move from Available Balance to Pending Balance until admin review.`
    );

    if (!confirmed) return;

    setSubmitting(true);

    const { error } = await supabase.rpc("request_creator_payout", {
      payout_amount_aed: amount,
      payout_note_text: payoutNote.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      alert(error.message || "Failed to request payout.");
      return;
    }

    setPayoutAmount("");
    setPayoutNote("");
    alert("Payout request submitted. Balance moved to pending.");
    await loadWallet();
  }

  const stats = useMemo(() => {
    const selectedPrice = PLAN_PRICES[planName] || 10;

    const completedTips = tips.filter((tip) => isCompletedStatus(tip.status));

    const tipsGross = completedTips.reduce(
      (total, tip) => total + Number(tip.amount_aed || 0),
      0
    );

    const tipsCreatorRevenue = completedTips.reduce(
      (total, tip) => total + Number(tip.creator_amount_aed || 0),
      0
    );

    const platformFees = completedTips.reduce(
      (total, tip) => total + Number(tip.platform_fee_aed || 0),
      0
    );

    const privateCallRevenue = privateCallPayments.reduce(
      (total, payment) => total + Number(payment.amount_aed || 0),
      0
    );

    const subscriptionMonthlyRevenue = activeSubscriberCount * selectedPrice;

    const estimatedMonthlyRevenue =
      subscriptionMonthlyRevenue + getLast30DaysTips(completedTips) + getLast30DaysCalls(privateCallPayments);

    const estimatedQuarterRevenue = estimatedMonthlyRevenue * 3;
    const estimatedAnnualRevenue = estimatedMonthlyRevenue * 12;

    const pendingPayouts = payouts.filter((payout) =>
      ["pending", "requested", "review"].includes(String(payout.status || "").toLowerCase())
    );

    const approvedPayouts = payouts.filter((payout) =>
      ["approved", "paid", "completed", "success", "succeeded"].includes(
        String(payout.status || "").toLowerCase()
      )
    );

    const rejectedPayouts = payouts.filter((payout) =>
      ["rejected", "declined", "cancelled", "canceled"].includes(
        String(payout.status || "").toLowerCase()
      )
    );

    const totalWithdrawn = approvedPayouts.reduce(
      (total, payout) => total + Number(payout.amount_aed || 0),
      0
    );

    const pendingWithdrawal = pendingPayouts.reduce(
      (total, payout) => total + Number(payout.amount_aed || 0),
      0
    );

    const revenueChart = buildRevenueChart({
      tips: completedTips,
      privateCallPayments,
      activeSubscriberCount,
      selectedPrice,
    });

    const revenueSharing = [
      {
        label: "Creator Revenue",
        value: tipsCreatorRevenue + privateCallRevenue + subscriptionMonthlyRevenue,
      },
      {
        label: "Platform Fees",
        value: platformFees,
      },
      {
        label: "Withdrawn",
        value: totalWithdrawn,
      },
      {
        label: "Pending Payout",
        value: pendingWithdrawal,
      },
    ];

    return {
      selectedPrice,
      tipsGross,
      tipsCreatorRevenue,
      platformFees,
      privateCallRevenue,
      subscriptionMonthlyRevenue,
      estimatedMonthlyRevenue,
      estimatedQuarterRevenue,
      estimatedAnnualRevenue,
      pendingPayouts,
      approvedPayouts,
      rejectedPayouts,
      totalWithdrawn,
      pendingWithdrawal,
      revenueChart,
      revenueSharing,
    };
  }, [tips, privateCallPayments, activeSubscriberCount, planName, payouts]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading wallet...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Creator Wallet
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              Earnings <span className="text-red-500">Dashboard</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Payout requests, withdrawal history, revenue sharing, tips, paid private calls, subscriptions and earnings forecasting.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadWallet}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
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
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Available Balance"
            value={`AED ${formatMoney(wallet?.available_balance_aed || 0)}`}
            color="text-green-400"
          />

          <Stat
            label="Pending Balance"
            value={`AED ${formatMoney(wallet?.pending_balance_aed || 0)}`}
            color="text-yellow-400"
          />

          <Stat
            label="Lifetime Earnings"
            value={`AED ${formatMoney(wallet?.lifetime_earnings_aed || 0)}`}
            color="text-red-400"
          />

          <Stat
            label="Total Withdrawn"
            value={`AED ${formatMoney(stats.totalWithdrawn)}`}
            color="text-purple-300"
          />
        </div>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-4 text-2xl font-black">Payout Requests UI</h2>

            <p className="mb-5 text-sm leading-6 text-gray-400">
              Submit payout requests for admin review. Funds move from available to pending until approved.
            </p>

            <label className="mb-2 block text-sm font-bold text-gray-300">
              Amount AED
            </label>

            <input
              type="number"
              min="1"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="Example: 100"
              className="mb-4 w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-white outline-none focus:border-red-600"
            />

            <label className="mb-2 block text-sm font-bold text-gray-300">
              Payout Note
            </label>

            <textarea
              value={payoutNote}
              onChange={(e) => setPayoutNote(e.target.value)}
              placeholder="Bank details or payout note..."
              rows={4}
              className="mb-5 w-full resize-none rounded-xl border border-gray-800 bg-black px-4 py-3 text-white outline-none focus:border-red-600"
            />

            <button
              onClick={requestPayout}
              disabled={submitting}
              className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-700 disabled:bg-gray-700"
            >
              {submitting ? "Submitting..." : "Request Payout"}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6 lg:col-span-2">
            <h2 className="mb-4 text-2xl font-black">Earnings Forecasting</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <ForecastCard
                label="Estimated Monthly"
                value={`AED ${formatMoney(stats.estimatedMonthlyRevenue)}`}
                note="Subscriptions + recent tips + recent private calls"
              />
              <ForecastCard
                label="Estimated Quarter"
                value={`AED ${formatMoney(stats.estimatedQuarterRevenue)}`}
                note="Monthly forecast × 3"
              />
              <ForecastCard
                label="Estimated Annual"
                value={`AED ${formatMoney(stats.estimatedAnnualRevenue)}`}
                note="Monthly forecast × 12"
              />
            </div>

            <div className="mt-6 h-[300px] rounded-2xl bg-black/30 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="creatorRevenue" name="Creator Revenue" stroke="#22c55e" strokeWidth={3} />
                  <Line type="monotone" dataKey="grossRevenue" name="Gross Revenue" stroke="#ef4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-4 text-2xl font-black">Revenue Sharing Dashboard</h2>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <MiniStat label="Tips Gross" value={`AED ${formatMoney(stats.tipsGross)}`} />
              <MiniStat label="Platform Fees" value={`AED ${formatMoney(stats.platformFees)}`} />
              <MiniStat label="Creator Tips" value={`AED ${formatMoney(stats.tipsCreatorRevenue)}`} />
              <MiniStat label="Private Calls" value={`AED ${formatMoney(stats.privateCallRevenue)}`} />
            </div>

            <div className="h-[300px] rounded-2xl bg-black/30 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueSharing}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="value" name="AED" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-4 text-2xl font-black">Monthly Revenue Breakdown</h2>

            <div className="h-[380px] rounded-2xl bg-black/30 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tips" name="Tips" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="subscriptions" name="Subscriptions" fill="#eab308" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="privateCalls" name="Private Calls" fill="#a855f7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold text-yellow-300">
                Premium Creator
              </p>

              <h2 className="text-3xl font-black">Subscription Management</h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
                Choose one tier. Pricing is fixed per tier to keep the platform clean and consistent.
              </p>

              <Link
                href={`/profile/${wallet?.creator_id}`}
                className="mt-4 inline-block rounded-xl border border-yellow-500/30 bg-black/30 px-5 py-3 text-sm font-bold text-yellow-300 hover:bg-yellow-500/10"
              >
                View Public Premium Profile
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4">
                <p className="text-sm text-gray-400">Active Subscribers</p>
                <h3 className="mt-2 text-3xl font-black text-yellow-300">
                  {activeSubscriberCount}
                </h3>
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4">
                <p className="text-sm text-gray-400">
                  Monthly Subscription Revenue
                </p>
                <h3 className="mt-2 text-3xl font-black text-green-400">
                  AED {formatMoney(stats.subscriptionMonthlyRevenue)}
                </h3>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="mb-3 text-sm font-bold text-gray-300">
              Select Subscription Tier
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TIERS.map((tier) => {
                const selected = planName === tier.name;

                return (
                  <button
                    key={tier.name}
                    type="button"
                    onClick={() => setPlanName(tier.name)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-yellow-400 bg-yellow-500/20 shadow-lg shadow-yellow-500/10"
                        : "border-yellow-500/10 bg-black/40 hover:border-yellow-500/40 hover:bg-yellow-500/10"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-2xl">{tier.icon}</span>

                      {selected && (
                        <span className="rounded-full bg-yellow-500 px-2.5 py-1 text-xs font-black text-black">
                          Selected
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white">{tier.name}</h3>

                    <p className="mt-1 text-2xl font-black text-yellow-300">
                      AED {tier.price}
                    </p>

                    <p className="text-xs text-gray-400">per month</p>

                    <p className="mt-3 text-sm font-semibold text-gray-300">
                      {tier.benefit}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-300">
                Plan Description
              </label>

              <textarea
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                placeholder="Describe what subscribers receive..."
                rows={4}
                className="w-full resize-none rounded-xl border border-yellow-500/20 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={saveSubscriptionPlan}
                disabled={savingPlan}
                className="w-full rounded-xl bg-yellow-500 px-8 py-3 font-black text-black hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-400 lg:w-auto"
              >
                {savingPlan ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <TableCard title="Withdrawal History">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Your Note</th>
                  <th className="px-5 py-4">Admin Note</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {stats.approvedPayouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}

                {stats.approvedPayouts.length === 0 && (
                  <EmptyTableRow colSpan={5} text="No completed withdrawals yet." />
                )}
              </tbody>
            </table>
          </TableCard>

          <TableCard title="All Payout Requests">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Your Note</th>
                  <th className="px-5 py-4">Admin Note</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>

              <tbody>
                {payouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}

                {payouts.length === 0 && (
                  <EmptyTableRow colSpan={5} text="No payout requests yet." />
                )}
              </tbody>
            </table>
          </TableCard>
        </section>

        <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 sm:p-6">
          <h2 className="mb-4 text-2xl font-black">Paid Private Calls</h2>

          {privateCallPayments.length === 0 ? (
            <p className="rounded-xl border border-purple-500/10 bg-black/30 p-5 text-center text-gray-400">
              No paid private calls received yet.
            </p>
          ) : (
            <div className="space-y-3">
              {privateCallPayments.map((payment) => {
                const callerName =
                  payment.profiles?.display_name ||
                  payment.profiles?.username ||
                  "Caller";

                return (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-purple-500/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">
                          {payment.streams?.title || "Private call"}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          Paid by {callerName} • {new Date(payment.created_at).toLocaleString()}
                        </p>
                      </div>

                      <p className="text-xl font-black text-purple-300">
                        AED {formatMoney(payment.amount_aed || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <h2 className="mb-4 text-2xl font-black">Recent Tips</h2>

          {tips.length === 0 ? (
            <p className="text-gray-400">No tips received yet.</p>
          ) : (
            <div className="space-y-3">
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className="rounded-xl border border-gray-800 bg-black p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">
                        {tip.streams?.title || "Stream Tip"}
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        {tip.message || "No message"}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(tip.created_at).toLocaleString()} • {tip.provider}
                      </p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-xl font-black text-green-400">
                        AED {formatMoney(tip.creator_amount_aed || 0)}
                      </p>

                      <p className="text-xs text-gray-500">
                        Fee AED {formatMoney(tip.platform_fee_aed || 0)}
                      </p>

                      <span className="mt-2 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300">
                        {tip.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`break-words text-3xl font-black sm:text-4xl ${color}`}>
        {value}
      </h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
      <p className="mb-2 text-xs text-gray-400 sm:text-sm">{label}</p>
      <h3 className="break-words text-xl font-black">{value}</h3>
    </div>
  );
}

function ForecastCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <h3 className="mt-2 break-words text-2xl font-black text-green-400">
        {value}
      </h3>
      <p className="mt-2 text-xs leading-5 text-gray-500">{note}</p>
    </div>
  );
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 p-5 sm:p-6">
        <h2 className="text-2xl font-black">{title}</h2>
      </div>

      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function PayoutRow({ payout }: { payout: PayoutRequest }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="px-5 py-4 font-bold">
        AED {formatMoney(payout.amount_aed || 0)}
      </td>

      <td className="px-5 py-4">
        <span className={getPayoutStatusClass(payout.status)}>
          {payout.status}
        </span>
      </td>

      <td className="max-w-[220px] px-5 py-4 text-gray-400">
        {payout.payout_note || "-"}
      </td>

      <td className="max-w-[220px] px-5 py-4 text-gray-400">
        {payout.admin_note || "-"}
      </td>

      <td className="px-5 py-4 text-gray-500">
        {new Date(payout.created_at).toLocaleString()}
      </td>
    </tr>
  );
}

function EmptyTableRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-gray-400">
        {text}
      </td>
    </tr>
  );
}

function buildRevenueChart({
  tips,
  privateCallPayments,
  activeSubscriberCount,
  selectedPrice,
}: {
  tips: Tip[];
  privateCallPayments: PrivateCallPayment[];
  activeSubscriberCount: number;
  selectedPrice: number;
}): RevenuePoint[] {
  const months = getLastSixMonths();

  return months.map((month) => {
    const monthTips = tips.filter((tip) => isSameMonth(tip.created_at, month.date));
    const monthCalls = privateCallPayments.filter((payment) =>
      isSameMonth(payment.created_at, month.date)
    );

    const tipsGross = monthTips.reduce(
      (total, tip) => total + Number(tip.amount_aed || 0),
      0
    );

    const tipsCreator = monthTips.reduce(
      (total, tip) => total + Number(tip.creator_amount_aed || 0),
      0
    );

    const platformFees = monthTips.reduce(
      (total, tip) => total + Number(tip.platform_fee_aed || 0),
      0
    );

    const privateCalls = monthCalls.reduce(
      (total, payment) => total + Number(payment.amount_aed || 0),
      0
    );

    const subscriptions = month.isCurrentMonth
      ? activeSubscriberCount * selectedPrice
      : 0;

    return {
      label: month.label,
      tips: tipsCreator,
      subscriptions,
      privateCalls,
      creatorRevenue: tipsCreator + subscriptions + privateCalls,
      platformFees,
      grossRevenue: tipsGross + subscriptions + privateCalls,
    };
  });
}

function getLastSixMonths() {
  const now = new Date();

  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);

    return {
      date,
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

function isCompletedStatus(status: string | null) {
  if (!status) return true;

  return ["completed", "paid", "success", "succeeded", "approved"].includes(
    status.toLowerCase()
  );
}

function getLast30DaysTips(tips: Tip[]) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return tips
    .filter((tip) => new Date(tip.created_at).getTime() >= cutoff)
    .reduce((total, tip) => total + Number(tip.creator_amount_aed || 0), 0);
}

function getLast30DaysCalls(privateCallPayments: PrivateCallPayment[]) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return privateCallPayments
    .filter((payment) => new Date(payment.created_at).getTime() >= cutoff)
    .reduce((total, payment) => total + Number(payment.amount_aed || 0), 0);
}

function getPayoutStatusClass(status: string) {
  const safeStatus = String(status || "").toLowerCase();

  if (["approved", "paid", "completed", "success", "succeeded"].includes(safeStatus)) {
    return "rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400";
  }

  if (["rejected", "declined", "cancelled", "canceled"].includes(safeStatus)) {
    return "rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400";
  }

  return "rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400";
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Wallet = {
  id: string;
  creator_id: string;
  available_balance_usd: number;
  pending_balance_usd: number;
  lifetime_earnings_usd: number;
};

type Tip = {
  id: string;
  amount_usd: number;
  platform_fee_usd: number;
  creator_amount_usd: number;
  message: string | null;
  status: string;
  provider: string;
  created_at: string;
  streams?: { title?: string | null } | null;
};

type PayoutRequest = {
  id: string;
  amount_usd: number;
  status: string;
  payout_note: string | null;
  admin_note: string | null;
  created_at: string;
};

type PrivateCallPayment = {
  id: string;
  amount_usd: number;
  created_at: string;
  streams?: { title?: string | null } | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

export default function WalletPage() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [privateCallPayments, setPrivateCallPayments] = useState<PrivateCallPayment[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        amount_usd,
        platform_fee_usd,
        creator_amount_usd,
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
      .limit(25);

    setTips((tipData || []) as Tip[]);

    const { data: payoutData } = await supabase
      .from("creator_payout_requests")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    setPayouts((payoutData || []) as PayoutRequest[]);

    const { data: callPaymentData } = await supabase
      .from("private_call_payments")
      .select(
        `
        id,
        amount_usd,
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
      .limit(25);

    setPrivateCallPayments((callPaymentData || []) as PrivateCallPayment[]);

    setLoading(false);
  }

  async function submitTopupRequest() {
    const amount = Number(topupAmount);

    if (!amount || amount <= 0) {
      alert("Enter a valid top-up amount.");
      return;
    }

    if (amount > 5000) {
      alert("Top-up requests over $5000 aren't supported yet. Please contact support.");
      return;
    }

    if (!topupNote.trim()) {
      alert(
        "Please add a note describing how you sent the funds (e.g. bank transfer reference, crypto transaction ID)."
      );
      return;
    }

    const confirmed = confirm(
      `Submit a top-up request for USD ${amount}? This will be reviewed by our team before your wallet is credited.`
    );
    if (!confirmed) return;

    setTopupSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setTopupSubmitting(false);
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("wallet_topup_requests").insert({
      user_id: user.id,
      amount_usd: amount,
      topup_note: topupNote.trim(),
      status: "pending",
    });

    setTopupSubmitting(false);

    if (error) {
      alert(error.message || "Failed to submit top-up request.");
      return;
    }

    setTopupAmount("");
    setTopupNote("");
    alert("Top-up request submitted. Your wallet will be credited once reviewed.");
  }

  async function requestPayout() {
    if (!wallet) return;

    const amount = Number(payoutAmount);

    if (!amount || amount <= 0) {
      alert("Enter a valid payout amount.");
      return;
    }

    if (amount > wallet.available_balance_usd) {
      alert("You cannot request more than your available balance.");
      return;
    }

    const confirmed = confirm(`Request payout of USD ${amount}?`);
    if (!confirmed) return;

    setSubmitting(true);

    const { error } = await supabase.rpc("request_creator_payout", {
      payout_amount_usd: amount,
      payout_note_text: payoutNote.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      alert(error.message || "Failed to request payout.");
      return;
    }

    setPayoutAmount("");
    setPayoutNote("");
    await loadWallet();
  }

  const stats = useMemo(() => {
    const completedTips = tips.filter((tip) => isCompletedStatus(tip.status));

    const tipsRevenue = completedTips.reduce(
      (total, tip) => total + Number(tip.creator_amount_usd || 0),
      0
    );

    const tipFees = completedTips.reduce(
      (total, tip) => total + Number(tip.platform_fee_usd || 0),
      0
    );

    const privateCallRevenue = privateCallPayments.reduce(
      (total, payment) => total + Number(payment.amount_usd || 0),
      0
    );

    const approvedPayouts = payouts.filter((payout) =>
      ["approved", "paid", "completed", "success", "succeeded"].includes(
        String(payout.status || "").toLowerCase()
      )
    );

    const pendingPayouts = payouts.filter((payout) =>
      ["pending", "requested", "review"].includes(
        String(payout.status || "").toLowerCase()
      )
    );

    const totalWithdrawn = approvedPayouts.reduce(
      (total, payout) => total + Number(payout.amount_usd || 0),
      0
    );

    const pendingWithdrawal = pendingPayouts.reduce(
      (total, payout) => total + Number(payout.amount_usd || 0),
      0
    );

    return {
      tipsRevenue,
      tipFees,
      privateCallRevenue,
      totalWithdrawn,
      pendingWithdrawal,
      totalRecentRevenue: tipsRevenue + privateCallRevenue,
    };
  }, [tips, privateCallPayments, payouts]);

  if (loading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-6 text-white">
        <p className="text-muted">Loading wallet...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-4 pb-32 pt-5 text-white sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow mb-1.5">
              Creator Wallet
            </p>

            <h1 className="font-display text-2xl font-black sm:text-3xl">
              Earnings <span className="text-accent">Wallet</span>
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Mobile-first wallet with balance, payouts, tips and private call earnings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={loadWallet} className="btn-secondary">
              Refresh
            </button>

            <Link href="/dashboard" className="btn-secondary text-center">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            label="Available"
            value={`$${formatMoney(wallet?.available_balance_usd || 0)}`}
            color="text-success"
          />

          <Stat
            label="Pending"
            value={`$${formatMoney(wallet?.pending_balance_usd || 0)}`}
            color="text-warning"
          />

          <Stat
            label="Lifetime"
            value={`$${formatMoney(wallet?.lifetime_earnings_usd || 0)}`}
            color="text-accent"
          />

          <Stat
            label="Withdrawn"
            value={`$${formatMoney(stats.totalWithdrawn)}`}
            color="text-info"
          />
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4">
          <MiniStat label="Tips" value={`$${formatMoney(stats.tipsRevenue)}`} />
          <MiniStat label="Private Calls" value={`$${formatMoney(stats.privateCallRevenue)}`} />
          <MiniStat label="Platform Fees" value={`$${formatMoney(stats.tipFees)}`} />
          <MiniStat label="Pending Payouts" value={`$${formatMoney(stats.pendingWithdrawal)}`} />
        </div>

        <section className="mb-8 rounded-2xl border border-success/20 bg-success-soft p-5 sm:p-6">
          <h2 className="font-display mb-1.5 text-xl font-black">Add Funds</h2>

          <p className="mb-4 text-sm leading-6 text-muted">
            Send payment externally (bank transfer, crypto, etc.), then submit
            a request below with proof of payment. Our team will review and
            credit your wallet.
          </p>

          <label className="mb-2 block text-sm font-bold text-muted">
            Amount USD
          </label>

          <input
            type="number"
            min="1"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Example: 20"
            className="mb-4 w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-white outline-none focus:border-success"
          />

          <label className="mb-2 block text-sm font-bold text-muted">
            Payment proof / note
          </label>

          <textarea
            value={topupNote}
            onChange={(e) => setTopupNote(e.target.value)}
            placeholder="e.g. Bank transfer ref #12345, or crypto tx hash..."
            rows={3}
            className="mb-5 w-full resize-none rounded-xl border border-hairline bg-canvas px-4 py-3 text-white outline-none focus:border-success"
          />

          <button
            onClick={submitTopupRequest}
            disabled={topupSubmitting}
            className="w-full rounded-xl bg-success px-5 py-3 font-bold hover:opacity-90 disabled:bg-surface-raised disabled:opacity-100"
          >
            {topupSubmitting ? "Submitting..." : "Submit Top-Up Request"}
          </button>
        </section>

        <section className="card-section mb-8">
          <h2 className="font-display mb-1.5 text-xl font-black">Request Payout</h2>

          <p className="mb-4 text-sm leading-6 text-muted">
            Request payout from your available balance.
          </p>

          <label className="mb-2 block text-sm font-bold text-muted">
            Amount USD
          </label>

          <input
            type="number"
            min="1"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            placeholder="Example: 100"
            className="input-field mb-4"
          />

          <label className="mb-2 block text-sm font-bold text-muted">
            Note
          </label>

          <textarea
            value={payoutNote}
            onChange={(e) => setPayoutNote(e.target.value)}
            placeholder="Optional payout note..."
            rows={3}
            className="input-field mb-5 resize-none"
          />

          <button
            onClick={requestPayout}
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Submitting..." : "Request Payout"}
          </button>
        </section>

        <section className="mb-8 rounded-2xl border border-info/20 bg-info-soft p-5 sm:p-6">
          <h2 className="font-display mb-4 text-xl font-black">Private Call Earnings</h2>

          {privateCallPayments.length === 0 ? (
            <p className="rounded-xl border border-info/10 bg-canvas/30 p-5 text-center text-muted">
              No paid private calls yet.
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
                    className="rounded-xl border border-info/10 bg-canvas/30 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">
                          {payment.streams?.title || "Private call"}
                        </p>

                        <p className="mt-1 text-sm text-muted">
                          Paid by {callerName} •{" "}
                          {new Date(payment.created_at).toLocaleString()}
                        </p>
                      </div>

                      <p className="text-xl font-black text-info">
                        USD {formatMoney(payment.amount_usd || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card-section mb-8">
          <h2 className="font-display mb-4 text-xl font-black">Recent Tips</h2>

          {tips.length === 0 ? (
            <p className="text-muted">No tips received yet.</p>
          ) : (
            <div className="space-y-3">
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className="rounded-xl border border-hairline bg-canvas p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">
                        {tip.streams?.title || "Stream Tip"}
                      </p>

                      <p className="mt-1 text-sm text-muted">
                        {tip.message || "No message"}
                      </p>

                      <p className="mt-2 text-xs text-faint">
                        {new Date(tip.created_at).toLocaleString()} •{" "}
                        {tip.provider}
                      </p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-xl font-black text-success">
                        USD {formatMoney(tip.creator_amount_usd || 0)}
                      </p>

                      <p className="text-xs text-faint">
                        Fee USD {formatMoney(tip.platform_fee_usd || 0)}
                      </p>

                      <span className="badge-neutral mt-2">
                        {tip.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card-section">
          <h2 className="font-display mb-4 text-xl font-black">Payout History</h2>

          {payouts.length === 0 ? (
            <p className="text-muted">No payout requests yet.</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="rounded-xl border border-hairline bg-canvas p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">
                        USD {formatMoney(payout.amount_usd || 0)}
                      </p>

                      <p className="mt-1 text-sm text-muted">
                        {payout.payout_note || "No note"}
                      </p>

                      {payout.admin_note && (
                        <p className="mt-1 text-sm text-warning">
                          Admin: {payout.admin_note}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-faint">
                        {new Date(payout.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span className={getPayoutStatusClass(payout.status)}>
                      {payout.status}
                    </span>
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
    <div className="card-section">
      <p className="mb-2 text-sm text-muted">{label}</p>
      <h2 className={`font-display break-words text-2xl font-black sm:text-4xl ${color}`}>
        {value}
      </h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-section">
      <p className="mb-2 text-xs text-muted sm:text-sm">{label}</p>
      <h3 className="font-display break-words text-xl font-black">{value}</h3>
    </div>
  );
}

function isCompletedStatus(status: string | null) {
  if (!status) return true;

  return ["completed", "paid", "success", "succeeded", "approved"].includes(
    status.toLowerCase()
  );
}

function getPayoutStatusClass(status: string) {
  const safeStatus = String(status || "").toLowerCase();

  if (["approved", "paid", "completed", "success", "succeeded"].includes(safeStatus)) {
    return "badge-success";
  }

  if (["rejected", "declined", "cancelled", "canceled"].includes(safeStatus)) {
    return "badge-danger";
  }

  return "badge-warning";
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

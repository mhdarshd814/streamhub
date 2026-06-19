"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Payout = {
  id: string;
  creator_id: string;
  amount_usd: number;
  status: "pending" | "approved" | "rejected" | "paid";
  payout_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function AdminPayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("creator_payout_requests")
      .select(
        `
        *,
        profiles:creator_id (
          username,
          display_name,
          avatar_url
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setPayouts((data || []) as Payout[]);
    setLoading(false);
  }

  async function updatePayoutStatus(
    payout: Payout,
    status: "approved" | "rejected" | "paid"
  ) {
    const adminNote = window.prompt(
      `Add admin note for ${status} payout:`,
      payout.admin_note || ""
    );

    if (adminNote === null) return;

    const confirmed = confirm(
      `Confirm ${status.toUpperCase()} payout of USD ${payout.amount_usd}?`
    );

    if (!confirmed) return;

    setProcessingId(payout.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("creator_payout_requests")
      .update({
        status,
        admin_note: adminNote.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    setProcessingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: payout.creator_id,
        type: "payout_update",
        title: "Payout Request Updated",
        message: `Your USD ${payout.amount_usd} payout request was marked as ${status}.`,
        link: "/wallet",
        is_read: false,
      },
    ]);

    await loadPayouts();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading payout requests...</p>
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

  const pendingCount = payouts.filter((item) => item.status === "pending").length;
  const approvedCount = payouts.filter((item) => item.status === "approved").length;
  const paidCount = payouts.filter((item) => item.status === "paid").length;
  const rejectedCount = payouts.filter((item) => item.status === "rejected").length;

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Finance
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              Payout <span className="text-red-500">Requests</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Review creator payout requests, approve or reject them, and mark
              completed payouts as paid.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadPayouts}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pending" value={pendingCount} color="text-yellow-400" />
          <Stat label="Approved" value={approvedCount} color="text-blue-400" />
          <Stat label="Paid" value={paidCount} color="text-green-400" />
          <Stat label="Rejected" value={rejectedCount} color="text-red-400" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">All Requests</h2>
          </div>

          {payouts.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              No payout requests yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {payouts.map((payout) => {
                const creatorName =
                  payout.profiles?.display_name ||
                  payout.profiles?.username ||
                  payout.creator_id;

                return (
                  <div key={payout.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300">
                            {payout.status}
                          </span>

                          <span className="text-sm text-gray-500">
                            {new Date(payout.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="break-words text-2xl font-black">
                          USD {payout.amount_usd}
                        </h3>

                        <p className="mt-2 text-sm text-gray-400">
                          Creator: {creatorName}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-gray-400">
                          <span className="font-bold text-gray-300">
                            Creator Note:
                          </span>{" "}
                          {payout.payout_note || "-"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-gray-400">
                          <span className="font-bold text-gray-300">
                            Admin Note:
                          </span>{" "}
                          {payout.admin_note || "-"}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[380px]">
                        <button
                          onClick={() => updatePayoutStatus(payout, "approved")}
                          disabled={
                            processingId === payout.id ||
                            payout.status === "approved" ||
                            payout.status === "paid"
                          }
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => updatePayoutStatus(payout, "paid")}
                          disabled={
                            processingId === payout.id ||
                            payout.status === "paid" ||
                            payout.status === "rejected"
                          }
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-500"
                        >
                          Mark Paid
                        </button>

                        <button
                          onClick={() => updatePayoutStatus(payout, "rejected")}
                          disabled={
                            processingId === payout.id ||
                            payout.status === "paid" ||
                            payout.status === "rejected"
                          }
                          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black ${color}`}>{value}</h2>
    </div>
  );
}

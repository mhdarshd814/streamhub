"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type TopupRequest = {
  id: string;
  user_id: string;
  amount_usd: number;
  status: "pending" | "approved" | "rejected";
  topup_note: string | null;
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

export default function AdminTopupsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
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
      .from("wallet_topup_requests")
      .select(
        `
        *,
        profiles:user_id (
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

    setRequests((data || []) as TopupRequest[]);
    setLoading(false);
  }

  async function updateRequestStatus(
    request: TopupRequest,
    status: "approved" | "rejected"
  ) {
    const adminNote = window.prompt(
      `Add admin note for ${status} top-up:`,
      request.admin_note || ""
    );

    if (adminNote === null) return;

    const confirmed = confirm(
      `Confirm ${status.toUpperCase()} top-up of USD ${request.amount_usd}? ${
        status === "approved" ? "This will credit the user's wallet immediately." : ""
      }`
    );

    if (!confirmed) return;

    setProcessingId(request.id);

    const rpcName =
      status === "approved" ? "approve_wallet_topup" : "reject_wallet_topup";

    const { error } = await supabase.rpc(rpcName, {
      p_request_id: request.id,
      p_admin_note: adminNote.trim() || null,
    });

    setProcessingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: request.user_id,
        type: "topup_update",
        title: "Wallet Top-Up Update",
        message:
          status === "approved"
            ? `Your USD ${request.amount_usd} top-up was approved and credited to your wallet.`
            : `Your USD ${request.amount_usd} top-up request was rejected.`,
        link: "/wallet",
        is_read: false,
      },
    ]);

    await loadRequests();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading top-up requests...</p>
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

  const pendingCount = requests.filter((item) => item.status === "pending").length;
  const approvedCount = requests.filter((item) => item.status === "approved").length;
  const rejectedCount = requests.filter((item) => item.status === "rejected").length;

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Finance
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              Top-Up <span className="text-red-500">Requests</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Review wallet top-up requests. Approving credits the user's
              wallet immediately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadRequests}
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

        <div className="mb-8 grid grid-cols-3 gap-3">
          <Stat label="Pending" value={pendingCount} color="text-yellow-400" />
          <Stat label="Approved" value={approvedCount} color="text-green-400" />
          <Stat label="Rejected" value={rejectedCount} color="text-red-400" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">All Requests</h2>
          </div>

          {requests.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              No top-up requests yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {requests.map((request) => {
                const userName =
                  request.profiles?.display_name ||
                  request.profiles?.username ||
                  request.user_id;

                return (
                  <div key={request.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300">
                            {request.status}
                          </span>

                          <span className="text-sm text-gray-500">
                            {new Date(request.created_at).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="break-words text-2xl font-black">
                          USD {request.amount_usd}
                        </h3>

                        <p className="mt-2 text-sm text-gray-400">
                          User: {userName}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-gray-400">
                          <span className="font-bold text-gray-300">
                            Payment Proof:
                          </span>{" "}
                          {request.topup_note || "-"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-gray-400">
                          <span className="font-bold text-gray-300">
                            Admin Note:
                          </span>{" "}
                          {request.admin_note || "-"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 lg:w-[280px]">
                        <button
                          onClick={() => updateRequestStatus(request, "approved")}
                          disabled={
                            processingId === request.id ||
                            request.status !== "pending"
                          }
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-500"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => updateRequestStatus(request, "rejected")}
                          disabled={
                            processingId === request.id ||
                            request.status !== "pending"
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

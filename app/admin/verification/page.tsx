"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

type VerificationRequest = {
  id: string;
  user_id: string;
  reason: string;
  social_link: string | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: Profile | null;
};

export default function AdminVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [search, setSearch] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("creator_verification_requests")
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const cleanRequests = (data || []) as VerificationRequest[];
    const notes: Record<string, string> = {};

    cleanRequests.forEach((request) => {
      notes[request.id] = request.admin_note || "";
    });

    setRequests(cleanRequests);
    setAdminNotes(notes);
    setLoading(false);
  }

  async function reviewRequest(requestId: string, approve: boolean) {
    const note = adminNotes[requestId]?.trim() || "";

    if (!approve && !note) {
      alert("Add an admin note before rejecting.");
      return;
    }

    const confirmed = confirm(
      approve
        ? "Approve this creator verification request?"
        : "Reject this creator verification request?"
    );

    if (!confirmed) return;

    setUpdatingId(requestId);

    const { error } = await supabase.rpc("admin_review_creator_verification", {
      request_id_input: requestId,
      approve_input: approve,
      admin_note_input: note || (approve ? "Approved by admin" : "Rejected"),
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadRequests();
  }

  const filteredRequests = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return requests;

    return requests.filter((request) => {
      const profile = request.profiles;

      return (
        request.reason.toLowerCase().includes(value) ||
        request.status.toLowerCase().includes(value) ||
        request.social_link?.toLowerCase().includes(value) ||
        request.admin_note?.toLowerCase().includes(value) ||
        request.user_id.toLowerCase().includes(value) ||
        profile?.username?.toLowerCase().includes(value) ||
        profile?.display_name?.toLowerCase().includes(value)
      );
    });
  }, [requests, search]);

  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const rejectedCount = requests.filter(
    (request) => request.status === "rejected"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading verification requests...</p>
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
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              Verification <span className="text-red-500">Requests</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Review creator verification requests, approve trusted creators, or
              reject weak applications with an admin note.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
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
              Admin Home
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Total Requests</p>
            <h2 className="text-3xl font-black">{requests.length}</h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Pending</p>
            <h2 className="text-3xl font-black text-yellow-400">
              {pendingCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Approved</p>
            <h2 className="text-3xl font-black text-green-500">
              {approvedCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Rejected</p>
            <h2 className="text-3xl font-black text-red-500">
              {rejectedCount}
            </h2>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by creator, reason, status, social link, or user ID..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl">
              Creator Requests
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing {filteredRequests.length} request(s).
            </p>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No verification requests found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredRequests.map((request) => {
                const profile = request.profiles;
                const creatorName =
                  profile?.display_name || profile?.username || "Unknown User";

                return (
                  <div key={request.id} className="p-4 sm:p-6">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <img
                          src={profile?.avatar_url || "/default-avatar.png"}
                          alt={creatorName}
                          className="h-14 w-14 rounded-full object-cover"
                        />

                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-xl font-black">
                              {creatorName}
                            </h3>

                            {profile?.is_verified && (
                              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black">
                                ALREADY VERIFIED
                              </span>
                            )}

                            <span
                              className={
                                request.status === "pending"
                                  ? "rounded-full bg-yellow-600 px-3 py-1 text-xs font-black"
                                  : request.status === "approved"
                                  ? "rounded-full bg-green-600 px-3 py-1 text-xs font-black"
                                  : "rounded-full bg-red-600 px-3 py-1 text-xs font-black"
                              }
                            >
                              {request.status}
                            </span>
                          </div>

                          <p className="text-sm text-gray-400">
                            @{profile?.username || "no-username"}
                          </p>

                          <p className="mt-1 break-all text-xs text-gray-500">
                            User ID: {request.user_id}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Submitted{" "}
                            {new Date(request.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {profile?.username && (
                        <Link
                          href={`/user/${profile.username}`}
                          className="rounded-xl bg-gray-800 px-5 py-3 text-center text-sm font-bold hover:bg-gray-700"
                        >
                          View Profile
                        </Link>
                      )}
                    </div>

                    <div className="mb-5 rounded-2xl bg-gray-800 p-4">
                      <p className="mb-2 text-sm font-bold text-gray-300">
                        Reason
                      </p>
                      <p className="break-words text-sm leading-6 text-gray-200">
                        {request.reason}
                      </p>
                    </div>

                    {request.social_link && (
                      <div className="mb-5 rounded-2xl bg-gray-800 p-4">
                        <p className="mb-2 text-sm font-bold text-gray-300">
                          Social / Proof Link
                        </p>
                        <p className="break-all text-sm text-red-400">
                          {request.social_link}
                        </p>
                      </div>
                    )}

                    <div className="mb-5">
                      <label className="mb-2 block text-sm font-bold text-gray-300">
                        Admin Note
                      </label>

                      <textarea
                        value={adminNotes[request.id] || ""}
                        onChange={(e) =>
                          setAdminNotes((current) => ({
                            ...current,
                            [request.id]: e.target.value,
                          }))
                        }
                        disabled={request.status !== "pending"}
                        placeholder="Add review note..."
                        className="h-28 w-full resize-none rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:text-gray-500"
                      />
                    </div>

                    {request.reviewed_at && (
                      <p className="mb-5 text-xs text-gray-500">
                        Reviewed {new Date(request.reviewed_at).toLocaleString()}
                      </p>
                    )}

                    {request.status === "pending" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          onClick={() => reviewRequest(request.id, true)}
                          disabled={updatingId === request.id}
                          className="rounded-xl bg-green-600 px-6 py-3 font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                          {updatingId === request.id
                            ? "Updating..."
                            : "Approve Verification"}
                        </button>

                        <button
                          onClick={() => reviewRequest(request.id, false)}
                          disabled={updatingId === request.id}
                          className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:opacity-50"
                        >
                          {updatingId === request.id
                            ? "Updating..."
                            : "Reject Request"}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gray-800 px-5 py-4 text-sm font-bold text-gray-400">
                        Request already reviewed.
                      </div>
                    )}
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

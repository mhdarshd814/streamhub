"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type VerificationRequest = {
  id: string;
  user_id: string;
  reason: string;
  social_link: string | null;
  status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_verified: boolean | null;
  is_banned: boolean | null;
};

export default function VerificationPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reason, setReason] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVerificationPage();
  }, []);

  async function loadVerificationPage() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_verified, is_banned")
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

    const { data, error } = await supabase
      .from("creator_verification_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRequests((data || []) as VerificationRequest[]);
    setLoading(false);
  }

  async function submitRequest() {
    if (!profile) {
      alert("Profile not loaded.");
      return;
    }

    if (profile.is_verified) {
      alert("Your account is already verified.");
      return;
    }

    if (!reason.trim()) {
      alert("Please explain why your creator account should be verified.");
      return;
    }

    if (reason.trim().length < 30) {
      alert("Please provide a stronger reason. Minimum 30 characters.");
      return;
    }

    const hasPendingRequest = requests.some(
      (request) => request.status === "pending"
    );

    if (hasPendingRequest) {
      alert("You already have a pending verification request.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("creator_verification_requests").insert([
      {
        user_id: profile.id,
        reason: reason.trim(),
        social_link: socialLink.trim() || null,
        status: "pending",
      },
    ]);

    setSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setReason("");
    setSocialLink("");
    await loadVerificationPage();

    alert("Verification request submitted successfully.");
  }

  const hasPendingRequest = requests.some(
    (request) => request.status === "pending"
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading verification page...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Creator Verification
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              Request <span className="text-red-500">Verification</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Apply for the verified creator badge. Admins will review your
              request and approve or reject it.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Dashboard
          </button>
        </div>

        {profile?.is_verified ? (
          <div className="rounded-2xl border border-blue-700 bg-blue-950/30 p-8 text-center">
            <p className="mb-4 text-6xl">✅</p>

            <h2 className="mb-3 text-3xl font-black">Already Verified</h2>

            <p className="text-blue-200">
              Your creator account already has the verified badge.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-8">
              <h2 className="mb-5 text-2xl font-black">
                Verification Request
              </h2>

              {hasPendingRequest && (
                <div className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-950/30 p-4">
                  <p className="font-bold text-yellow-300">
                    You already have a pending request.
                  </p>
                  <p className="mt-1 text-sm text-yellow-100/70">
                    Wait for admin review before submitting another request.
                  </p>
                </div>
              )}

              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Why should your account be verified?
              </label>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={hasPendingRequest}
                placeholder="Explain your creator activity, audience, content type, or why verification is needed..."
                className="mb-5 h-40 w-full resize-none rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:text-gray-500"
              />

              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Social link / proof link optional
              </label>

              <input
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                disabled={hasPendingRequest}
                placeholder="https://youtube.com/your-channel or Instagram/TikTok profile"
                className="mb-6 w-full rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:text-gray-500"
              />

              <button
                onClick={submitRequest}
                disabled={submitting || hasPendingRequest}
                className="w-full rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <h2 className="mb-4 text-2xl font-black">Your Status</h2>

              <div className="space-y-4">
                <div className="rounded-xl bg-gray-800 p-4">
                  <p className="mb-1 text-sm text-gray-400">Account</p>
                  <p className="font-bold">
                    {profile?.display_name || profile?.username || "Creator"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-800 p-4">
                  <p className="mb-1 text-sm text-gray-400">
                    Verification Status
                  </p>
                  <p className="font-bold text-gray-300">Not Verified</p>
                </div>

                <div className="rounded-xl bg-gray-800 p-4">
                  <p className="mb-1 text-sm text-gray-400">
                    Previous Requests
                  </p>
                  <p className="font-bold">{requests.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black">Request History</h2>
            <p className="mt-1 text-sm text-gray-400">
              Track your previous verification requests.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No verification requests yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {requests.map((request) => (
                <div key={request.id} className="p-4 sm:p-6">
                  <div className="mb-3 flex flex-wrap gap-2">
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

                    <span className="rounded-full bg-gray-700 px-3 py-1 text-xs font-black">
                      {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="break-words text-sm leading-6 text-gray-300">
                    {request.reason}
                  </p>

                  {request.social_link && (
                    <p className="mt-3 break-all text-sm text-red-400">
                      {request.social_link}
                    </p>
                  )}

                  {request.admin_note && (
                    <div className="mt-4 rounded-xl bg-gray-800 p-4">
                      <p className="mb-1 text-sm font-bold text-gray-300">
                        Admin Note
                      </p>
                      <p className="text-sm text-gray-400">
                        {request.admin_note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

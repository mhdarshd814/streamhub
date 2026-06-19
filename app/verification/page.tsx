"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_verified: boolean | null;
  is_banned: boolean | null;
};

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
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        <p className="text-gray-400">Loading verification page...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR VERIFICATION</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Request Verification</h1>
        </div>

        {profile?.is_verified ? (
          <div className="premium-glass rounded-3xl p-16 text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-3xl font-black">Already Verified</h2>
            <p className="text-gray-400">Your creator account has the verified badge.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="premium-glass rounded-3xl p-8">
              <h2 className="text-2xl font-black mb-6">Submit Verification Request</h2>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={hasPendingRequest}
                placeholder="Explain your creator activity, audience, content type, or why verification is needed..."
                className="w-full h-40 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500"
              />

              <input
                value={socialLink}
                onChange={(e) => setSocialLink(e.target.value)}
                disabled={hasPendingRequest}
                placeholder="Social link or proof link (optional)"
                className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500"
              />

              <button
                onClick={submitRequest}
                disabled={submitting || hasPendingRequest}
                className="mt-8 w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500 disabled:bg-gray-700"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>

            <div className="premium-glass rounded-3xl p-8">
              <h2 className="text-2xl font-black mb-6">Your Status</h2>

              <div className="space-y-6">
                <div className="rounded-2xl bg-gray-900 p-5">
                  <p className="text-sm text-gray-400">Account</p>
                  <p className="font-bold text-xl">{profile?.display_name || profile?.username}</p>
                </div>

                <div className="rounded-2xl bg-gray-900 p-5">
                  <p className="text-sm text-gray-400">Verification Status</p>
                  <p className="font-bold text-xl text-gray-300">Not Verified</p>
                </div>

                <div className="rounded-2xl bg-gray-900 p-5">
                  <p className="text-sm text-gray-400">Previous Requests</p>
                  <p className="font-bold text-xl">{requests.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
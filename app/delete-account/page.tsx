"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setEmail(user.email);
      }
    }

    loadUser();
  }, []);

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      alert("Type DELETE to confirm permanent account deletion.");
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete your StreamHub account. This action cannot be undone."
    );

    if (!confirmed) return;

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Session expired. Please login again.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Account deletion failed.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-red-900/40 bg-gray-900 p-6">
        <h1 className="text-4xl font-black text-red-500">Delete Account</h1>

        <p className="mt-4 leading-7 text-gray-300">
          Permanently delete your StreamHub account and profile data. This action
          cannot be undone.
        </p>

        <div className="mt-6 rounded-2xl border border-red-700/50 bg-red-950/30 p-5 text-sm leading-6 text-red-200">
          Your login access will be removed immediately. Some records may be
          retained only where required for security, fraud prevention, legal
          compliance, or payment history.
        </div>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-xl border border-gray-700 bg-black p-4 text-gray-300 outline-none"
          />

          <input
            type="text"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-black p-4 outline-none focus:border-red-500"
          />

          <button
            onClick={deleteAccount}
            disabled={loading || confirmText !== "DELETE"}
            className="w-full rounded-xl bg-red-600 px-5 py-4 font-black hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Deleting Account..." : "Permanently Delete My Account"}
          </button>
        </div>
      </div>
    </main>
  );
}

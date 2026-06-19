"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email || "");
        setUserId(user.id);
      }
    }

    loadUser();
  }, []);

  async function submitRequest() {
    if (!email.trim()) {
      alert("Please enter your email address.");
      return;
    }

    const { error } = await supabase.from("account_deletion_requests").insert([
      {
        user_id: userId || null,
        email: email.trim(),
        status: "pending",
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-4xl font-black text-red-500">Delete Account</h1>

        <p className="mt-4 text-gray-400 leading-7">
          Submit a request to delete your StreamHub account and related user data.
          Account deletion requests are reviewed and processed as required for
          security, fraud prevention, and legal compliance.
        </p>

        {submitted ? (
          <div className="mt-8 rounded-2xl bg-green-600/10 p-5 text-green-400">
            Your account deletion request has been submitted.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <input
              type="email"
              placeholder="Your account email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-black p-4 outline-none focus:border-red-500"
            />

            <button
              onClick={submitRequest}
              className="w-full rounded-xl bg-red-600 px-5 py-4 font-black hover:bg-red-700"
            >
              Request Account Deletion
            </button>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          You can also email: mymindovermaterz@gmail.com
        </p>
      </div>
    </main>
  );
}

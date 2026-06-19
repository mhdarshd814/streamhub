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
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="premium-glass rounded-3xl p-10">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-4xl mb-6">🗑️</div>
            <h1 className="text-4xl font-black">Delete Account</h1>
            <p className="mt-3 text-gray-400">Request permanent deletion of your StreamHub account and data.</p>
          </div>

          {submitted ? (
            <div className="text-center py-12">
              <div className="text-green-400 text-5xl mb-6">✅</div>
              <h2 className="text-2xl font-bold">Request Submitted</h2>
              <p className="mt-4 text-gray-400">Your account deletion request has been received. It will be reviewed shortly.</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 leading-relaxed mb-8">
                Account deletion requests are reviewed for security, fraud prevention, and legal compliance. This action is irreversible.
              </p>

              <input
                type="email"
                placeholder="Your account email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 outline-none focus:border-red-500"
              />

              <button
                onClick={submitRequest}
                className="mt-6 w-full py-5 rounded-2xl bg-red-600 font-black text-xl hover:bg-red-500"
              >
                Request Account Deletion
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">Support: mymindovermaterz@gmail.com</p>
      </div>
    </main>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    if (!data.session) {
      setLoading(false);
      alert("Login failed. No session was created.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      alert("Session was not saved. Please try again.");
      return;
    }

    window.location.replace("/live-feed");
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-3 text-gray-400">Login to continue.</p>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8">
          <h2 className="mb-6 text-3xl font-bold">Login</h2>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none focus:border-red-500"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none focus:border-red-500"
            />

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold hover:bg-red-700 disabled:bg-gray-700"
            >
              {loading ? "Opening StreamHub..." : "Login"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/signup";
            }}
            className="mt-6 w-full text-center font-bold text-red-500"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
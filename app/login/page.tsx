"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/live-feed";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 shadow-lg shadow-red-600/30">
            <span className="text-4xl font-black">▶</span>
          </div>

          <h1 className="text-5xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-3 text-gray-400">
            Sign in and jump straight into Live Feed.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8">
          <h2 className="mb-6 text-3xl font-bold">Login</h2>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none focus:border-red-500"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none focus:border-red-500"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold hover:bg-red-700 disabled:bg-gray-700"
            >
              {loading ? "Signing In..." : "Login"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400">Don't have an account?</p>

            <button
              onClick={() => {
                window.location.href = "/signup";
              }}
              className="mt-2 font-bold text-red-500 hover:text-red-400"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
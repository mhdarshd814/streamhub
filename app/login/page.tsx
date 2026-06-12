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

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-600 mb-5 shadow-lg shadow-red-600/30">
            <span className="text-4xl font-black">▶</span>
          </div>

          <h1 className="text-5xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="text-gray-400 mt-3">
            Welcome back to your creator dashboard.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8">
          <h2 className="text-3xl font-bold mb-6">
            Login
          </h2>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none focus:border-red-500"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none focus:border-red-500"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-red-600 py-4 rounded-xl font-bold text-lg hover:bg-red-700 disabled:bg-gray-700"
            >
              {loading ? "Signing In..." : "Login"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Don't have an account?
            </p>

            <button
              onClick={() => {
                window.location.href = "/signup";
              }}
              className="mt-2 text-red-500 font-bold hover:text-red-400"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import toast from "react-hot-toast";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function getNextRoute(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const hasBasicProfile =
      !!data?.username && (!!data?.display_name || !!data?.avatar_url);

    return hasBasicProfile ? "/live-feed" : "/profile/edit";
  }

  async function handleLogin() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (!data.session?.user) {
      setLoading(false);
      toast.error("Login failed. No session was created.");
      return;
    }

    const nextRoute = await getNextRoute(data.session.user.id);

    toast.success("Welcome back");

    setTimeout(() => {
      window.location.replace(nextRoute);
    }, 350);
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-black px-6 text-white">
      <div className="slide-up w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30 premium-glow">
            <img
              src="/icon-512.png"
              alt="StreamHub"
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className="text-5xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-3 text-gray-400">
            Login to watch, stream, and call creators.
          </p>
        </div>

        <div className="premium-card rounded-3xl p-8">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
              Welcome back
            </p>
            <h2 className="mt-2 text-3xl font-black">Login</h2>
            <p className="mt-2 text-sm text-gray-400">
              Continue to your live feed.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading ? "Opening StreamHub..." : "Login"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
            New users should complete their profile after login. Empty profiles
            look cheap and reduce trust.
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/signup";
            }}
            className="mt-6 w-full text-center font-black text-red-500 hover:text-red-400"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
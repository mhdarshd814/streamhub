"use client";

import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function waitForStableSession() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user && session.access_token) {
        return session;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return null;
  }

  async function getNextRoute(userId: string) {
    const next = searchParams.get("next");

    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }

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

    const stableSession = await waitForStableSession();

    if (!data.session?.user || !stableSession?.user) {
      setLoading(false);
      toast.error("Login did not complete. Please try again.");
      return;
    }

    const nextRoute = await getNextRoute(stableSession.user.id);

    toast.success("Welcome back");

    window.location.replace(nextRoute);
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-black px-5 py-4 text-white">
      <div className="slide-up w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30 premium-glow">
            <img
              src="/icon-512.png"
              alt="StreamHub"
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className="text-4xl font-black">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Login to watch, stream, and call creators.
          </p>
        </div>

        <div className="premium-card rounded-3xl p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
              Welcome back
            </p>
            <h2 className="mt-2 text-3xl font-black">Login</h2>
            <p className="mt-1 text-sm text-gray-400">
              Continue to your live feed.
            </p>
          </div>

          <div className="space-y-3.5">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-red-600 py-3.5 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading ? "Opening StreamHub..." : "Login"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-400">
            New users should complete their profile after login. Empty profiles
            look cheap and reduce trust.
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/signup";
            }}
            className="mt-5 w-full text-center font-black text-red-500 hover:text-red-400"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
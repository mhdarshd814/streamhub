"use client";

import Link from "next/link";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function safeNextRoute(value: string | null) {
    if (value && value.startsWith("/") && !value.startsWith("//")) {
      return value;
    }
    return null;
  }

  async function getNextRoute(userId: string) {
    const next = safeNextRoute(searchParams.get("next"));
    if (next) return next;

    try {
      const profileQuery = supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2500)
      );

      const result: any = await Promise.race([profileQuery, timeout]);
      const data = result?.data || null;

      const hasBasicProfile =
        !!data?.username && (!!data?.display_name || !!data?.avatar_url);

      return hasBasicProfile ? "/live-feed" : "/profile/edit";
    } catch {
      return "/live-feed";
    }
  }

  async function handleLogin() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    if (loading) return;

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

    const userId = data.user?.id;

    if (!userId) {
      setLoading(false);
      toast.error("Login succeeded but user session was not returned.");
      return;
    }

    const nextRoute = await getNextRoute(userId);

    toast.success("Welcome back");
    window.location.replace(nextRoute);
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-black px-5 py-4 text-white">
      <div className="slide-up w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="premium-glow mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30">
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
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20 disabled:opacity-70"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleLogin();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20 disabled:opacity-70"
            />

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-red-500 hover:text-red-400"
              >
                Forgot password?
              </Link>
            </div>

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
            Complete your profile to unlock the full StreamHub experience.
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => window.location.assign("/signup")}
            className="mt-5 w-full text-center font-black text-red-500 hover:text-red-400 disabled:opacity-60"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
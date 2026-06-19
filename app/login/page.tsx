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
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      const hasBasicProfile = !!data?.username || !!data?.display_name || !!data?.avatar_url;
      return hasBasicProfile ? "/live-feed" : "/profile/edit";
    } catch {
      return "/live-feed";
    }
  }

  async function handleLogin() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error("Please enter email and password");
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
      toast.error("Login succeeded but session issue occurred");
      return;
    }

    const nextRoute = await getNextRoute(userId);

    toast.success("Welcome back to StreamHub");
    window.location.replace(nextRoute);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-5 py-8 text-white">
      <div className="slide-up w-full max-w-md">
        {/* Logo & Branding */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-red-600 to-rose-600 shadow-2xl shadow-red-600/50 premium-glow">
            <img 
              src="/icon-512.png" 
              alt="StreamHub" 
              className="h-full w-full object-cover rounded-[2rem]" 
            />
          </div>

          <h1 className="text-5xl font-black tracking-tighter">
            Stream<span className="text-red-500">Hub</span>
          </h1>
          <p className="mt-2 text-lg text-gray-400">Creators Live Together</p>
        </div>

        {/* Login Card */}
        <div className="premium-glass rounded-3xl p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-red-400">Welcome Back</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Sign In</h2>
            <p className="mt-2 text-sm text-gray-400">
              Access live streams, private calls &amp; earnings
            </p>
          </div>

          <div className="space-y-5">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              autoComplete="email"
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none transition focus:border-red-500 focus:bg-white/10"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none transition focus:border-red-500 focus:bg-white/10"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-2xl bg-red-600 py-4 text-lg font-black text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500 active:scale-[0.985] disabled:bg-gray-700"
            >
              {loading ? "Connecting..." : "Sign In"}
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => window.location.assign("/signup")}
              disabled={loading}
              className="text-red-400 hover:text-red-300 font-medium transition"
            >
              Don&apos;t have an account? Create one
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          By signing in you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}
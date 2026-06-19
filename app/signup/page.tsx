"use client";

import toast from "react-hot-toast";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function cleanUsername(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
  }

  async function handleSignup() {
    const safeUsername = cleanUsername(username);
    const cleanEmail = email.trim();

    if (!safeUsername || !cleanEmail || !password) {
      toast.error("Please complete all fields.");
      return;
    }

    if (safeUsername.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", safeUsername)
      .maybeSingle();

    if (existingProfile) {
      setLoading(false);
      toast.error("Username is already taken.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: safeUsername,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account created. Check your email to verify.");

    setTimeout(() => {
      window.location.href = "/login";
    }, 900);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-5 py-8 text-white">
      <div className="slide-up w-full max-w-md">
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
          <p className="mt-2 text-lg text-gray-400">Create your creator account</p>
        </div>

        <div className="premium-glass rounded-3xl p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-red-400">Join the movement</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Create Account</h2>
          </div>

          <div className="space-y-5">
            <input
              placeholder="Username"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none transition focus:border-red-500 focus:bg-white/10"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none transition focus:border-red-500 focus:bg-white/10"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base outline-none transition focus:border-red-500 focus:bg-white/10"
            />

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full rounded-2xl bg-red-600 py-4 text-lg font-black text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500 active:scale-[0.985] disabled:bg-gray-700"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">Already have an account?</p>
            <button
              onClick={() => window.location.href = "/login"}
              className="mt-1 text-red-400 hover:text-red-300 font-medium transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
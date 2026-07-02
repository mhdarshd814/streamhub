"use client";

import toast from "react-hot-toast";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

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

    if (!acceptedPolicies) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue.");
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
            Create your account and build your live audience.
          </p>
        </div>

        <div className="premium-card rounded-3xl p-6">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
              Start streaming
            </p>
            <h2 className="mt-2 text-3xl font-black">Create Account</h2>
            <p className="mt-1 text-sm text-gray-400">
              Pick a clean username. Improve your profile after login.
            </p>
          </div>

          <div className="space-y-3.5">
            <input
              placeholder="Username"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSignup();
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20"
            />

            <label className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-300">
              <input
                type="checkbox"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 accent-red-600"
              />
              <span>
                I have read and agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer" className="font-bold text-red-400 underline hover:text-red-300">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy-policy" target="_blank" rel="noreferrer" className="font-bold text-red-400 underline hover:text-red-300">
                  Privacy Policy
                </a>.
              </span>
            </label>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading || !acceptedPolicies}
              className="w-full rounded-xl bg-red-600 py-3.5 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-400">
            After signup, verify your email first. Then login and complete your
            profile so creators and viewers can recognize you.
          </div>

          <div className="mt-5 text-center">
            <p className="text-sm text-gray-400">Already have an account?</p>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="mt-1.5 font-black text-red-500 hover:text-red-400"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

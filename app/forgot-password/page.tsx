"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      toast.error("Please enter your email address.");
      return;
    }

    if (loading || sent) return;

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: "https://streamhubhq.com/reset-password",
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("Password reset email sent.");

    setTimeout(() => {
      router.replace("/login");
    }, 2500);
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-black px-5 py-4 text-white">
      <div className="w-full max-w-md">
        <div className="premium-card rounded-3xl p-6">
          <h1 className="text-3xl font-black">Forgot password?</h1>

          <p className="mt-2 text-sm text-gray-400">
            Enter your email and we will send you a password reset link.
          </p>

          <div className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              autoComplete="email"
              disabled={loading || sent}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !sent) {
                  handleReset();
                }
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20 disabled:opacity-70"
            />

            <button
              type="button"
              onClick={handleReset}
              disabled={loading || sent}
              className="w-full rounded-xl bg-red-600 py-3.5 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading
                ? "Sending..."
                : sent
                  ? "Email Sent - Returning to Login..."
                  : "Send Reset Link"}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm font-semibold text-red-500 hover:text-red-400"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
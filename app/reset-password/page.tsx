"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      toast.error("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (loading) return;

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUpdated(true);
    toast.success("Password updated successfully.");
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center bg-black px-5 py-4 text-white">
      <div className="w-full max-w-md">
        <div className="premium-card rounded-3xl p-6">
          <h1 className="text-3xl font-black">Reset password</h1>

          <p className="mt-2 text-sm text-gray-400">
            Enter your new StreamHub password below.
          </p>

          <div className="mt-6 space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={password}
              autoComplete="new-password"
              disabled={loading || updated}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20 disabled:opacity-70"
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              autoComplete="new-password"
              disabled={loading || updated}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !updated) {
                  handleUpdatePassword();
                }
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-600/20 disabled:opacity-70"
            />

            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={loading || updated}
              className="w-full rounded-xl bg-red-600 py-3.5 text-lg font-black text-white shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              {loading
                ? "Updating password..."
                : updated
                  ? "Password Updated"
                  : "Update Password"}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm font-semibold text-red-500 hover:text-red-400"
            >
              Back to login
            </Link>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-800 bg-black/30 p-3.5 text-sm leading-6 text-gray-400">
            This page only works from a valid password reset email link.
          </div>
        </div>
      </div>
    </div>
  );
}
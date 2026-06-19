"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function BannedPage() {
  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
      }
    }

    checkUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-red-800 bg-red-950/30 p-6 text-center sm:p-8">
        <div className="mb-5 text-6xl">⛔</div>

        <h1 className="mb-3 text-3xl font-black sm:text-4xl">
          Account Banned
        </h1>

        <p className="mb-8 text-sm leading-6 text-red-200 sm:text-base">
          Your StreamHub account has been restricted by the moderation team. You
          cannot watch streams, join private rooms, chat, like, or create
          streams.
        </p>

        <button
          onClick={logout}
          className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </main>
  );
}

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
      <div className="premium-glass w-full max-w-xl rounded-3xl p-8 text-center shadow-2xl">
        <div className="mb-8 text-7xl">⛔</div>

        <h1 className="mb-4 text-4xl font-black">Account Banned</h1>

        <p className="mb-8 text-red-200 leading-relaxed">
          Your StreamHub account has been restricted by the moderation team. 
          You cannot watch streams, join private rooms, chat, like, or create content.
        </p>

        <div className="space-y-3">
          <button
            onClick={logout}
            className="w-full rounded-2xl bg-red-600 py-4 text-lg font-black hover:bg-red-500"
          >
            Logout
          </button>

          <p className="text-xs text-gray-500">
            Contact support if you believe this was a mistake.
          </p>
        </div>
      </div>
    </main>
  );
}
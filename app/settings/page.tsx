"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SettingsPage() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setEmail(user?.email || null);
    });

    return () => {
      mounted = false;
    };
  }, []);

  function go(path: string) {
    window.location.href = path;
  }

  async function logout() {
    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
    } catch {
      // Even if sign-out errors, fall through to login.
    }

    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7">
          <h1 className="text-3xl font-black">Settings</h1>
          {email && (
            <p className="mt-1 truncate text-sm text-gray-400">
              Signed in as {email}
            </p>
          )}
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <p className="border-b border-gray-800 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-500">
            Legal
          </p>

          <SettingsRow label="Privacy Policy" onClick={() => go("/privacy")} />
          <SettingsRow label="Terms of Service" onClick={() => go("/terms")} />
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <p className="border-b border-gray-800 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-500">
            Account
          </p>

          <SettingsRow
            label="Delete Account"
            destructive
            onClick={() => go("/delete-account")}
          />

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-red-400 active:bg-white/5 disabled:opacity-50"
          >
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
            <span className="text-gray-600">›</span>
          </button>
        </div>

        <p className="px-1 text-center text-xs text-gray-600">
          StreamHub for Android
        </p>
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  onClick,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        destructive
          ? "flex w-full items-center justify-between border-b border-gray-800 px-5 py-4 text-left text-sm font-bold text-red-400 active:bg-white/5"
          : "flex w-full items-center justify-between border-b border-gray-800 px-5 py-4 text-left text-sm font-bold text-white active:bg-white/5"
      }
    >
      <span>{label}</span>
      <span className="text-gray-600">›</span>
    </button>
  );
}

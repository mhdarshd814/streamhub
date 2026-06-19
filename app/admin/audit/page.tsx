"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type AuditLog = {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  created_at: string;
};

export default function AdminAuditPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLogs((data || []) as AuditLog[]);
    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return logs;

    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(value) ||
        log.target_type.toLowerCase().includes(value) ||
        log.target_id?.toLowerCase().includes(value) ||
        log.admin_id?.toLowerCase().includes(value) ||
        log.details?.toLowerCase().includes(value)
      );
    });
  }, [logs, search]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading audit logs...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">
            Your account does not have admin permission.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              Audit <span className="text-red-500">Log</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Track admin moderation actions, bans, stream suspensions, and chat
              deletions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              onClick={loadAuditLogs}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin Home
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Loaded Logs</p>
            <h2 className="text-3xl font-black">{logs.length}</h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Visible Results</p>
            <h2 className="text-3xl font-black text-red-500">
              {filteredLogs.length}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
            <p className="mb-2 text-sm text-gray-400">Latest Action</p>
            <h2 className="truncate text-xl font-black text-blue-400">
              {logs[0]?.action || "None"}
            </h2>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, target type, target ID, admin ID, or details..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl">
              Recent Admin Actions
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing latest 300 audit records.
            </p>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No audit logs found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                        {log.action}
                      </span>

                      <span className="rounded-full bg-gray-700 px-3 py-1 text-xs font-black">
                        {log.target_type}
                      </span>
                    </div>

                    <p className="break-words text-lg font-black">
                      {log.details || "No details provided"}
                    </p>

                    <p className="mt-3 break-all text-xs text-gray-500">
                      Target ID: {log.target_id || "N/A"}
                    </p>

                    <p className="mt-1 break-all text-xs text-gray-500">
                      Admin ID: {log.admin_id || "N/A"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

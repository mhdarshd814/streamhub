"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type AttendanceRow = {
  id: string;
  stream_id: string | null;
  call_request_id: string | null;
  participant_id: string;
  participant_role: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function AdminAttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("session_attendance")
      .select(
        `
        *,
        profiles:participant_id (
          username,
          display_name,
          avatar_url
        )
      `
      )
      .order("joined_at", { ascending: false })
      .limit(300);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRows((data || []) as AttendanceRow[]);
    setLoading(false);
  }

  function formatDuration(seconds?: number | null) {
    const total = Number(seconds || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Still active";
    return new Date(value).toLocaleString();
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const name =
        row.profiles?.display_name ||
        row.profiles?.username ||
        row.participant_id;

      const matchesSearch =
        !search.trim() ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        row.participant_id.toLowerCase().includes(search.toLowerCase()) ||
        String(row.stream_id || "").toLowerCase().includes(search.toLowerCase()) ||
        String(row.call_request_id || "").toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" || row.participant_role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [rows, search, roleFilter]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const active = filteredRows.filter((row) => !row.left_at).length;
    const viewers = filteredRows.filter((row) => row.participant_role === "viewer").length;
    const privateCallRows = filteredRows.filter((row) => row.call_request_id).length;

    const durations = filteredRows
      .map((row) => Number(row.duration_seconds || 0))
      .filter((value) => value > 0);

    const totalSeconds = durations.reduce((sum, value) => sum + value, 0);
    const avgSeconds = durations.length ? Math.round(totalSeconds / durations.length) : 0;
    const longestSeconds = durations.length ? Math.max(...durations) : 0;

    return {
      total,
      active,
      viewers,
      privateCallRows,
      avgSeconds,
      longestSeconds,
    };
  }, [filteredRows]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <p className="text-gray-400">Loading attendance...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-3xl border border-red-900/40 bg-gray-900 p-8 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-gray-400">Admin access required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold text-red-400">
              Admin Audit
            </p>
            <h1 className="text-4xl font-black">
              Attendance Tracking
            </h1>
            <p className="mt-3 max-w-3xl text-gray-400">
              Track who joined streams and private calls, when they left, and how long they stayed.
            </p>
          </div>

          <button
            onClick={loadAttendance}
            className="rounded-xl bg-red-600 px-5 py-3 font-black hover:bg-red-700"
          >
            Refresh
          </button>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Total Sessions" value={stats.total} />
          <Stat label="Active Now" value={stats.active} color="text-green-400" />
          <Stat label="Viewers" value={stats.viewers} color="text-blue-400" />
          <Stat label="Call Records" value={stats.privateCallRows} color="text-purple-400" />
          <Stat label="Avg Duration" value={formatDuration(stats.avgSeconds)} color="text-yellow-300" />
          <Stat label="Longest" value={formatDuration(stats.longestSeconds)} color="text-red-400" />
        </section>

        <section className="mb-6 grid gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, stream ID, call ID..."
            className="rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-red-500 lg:col-span-3"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-gray-700 bg-black px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="all">All roles</option>
            <option value="host">Host</option>
            <option value="guest">Guest</option>
            <option value="viewer">Viewer</option>
            <option value="caller">Caller</option>
            <option value="receiver">Receiver</option>
          </select>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-950 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="px-4 py-4">User</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Stream ID</th>
                  <th className="px-4 py-4">Call ID</th>
                  <th className="px-4 py-4">Joined</th>
                  <th className="px-4 py-4">Left</th>
                  <th className="px-4 py-4">Duration</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const name =
                      row.profiles?.display_name ||
                      row.profiles?.username ||
                      "Unknown User";

                    return (
                      <tr key={row.id} className="border-t border-gray-800 hover:bg-black/40">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                              {row.profiles?.avatar_url ? (
                                <img
                                  src={row.profiles.avatar_url}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                "👤"
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-black">{name}</p>
                              <p className="truncate text-xs text-gray-500">
                                {row.participant_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="rounded-full bg-red-600/10 px-3 py-1 text-xs font-black uppercase text-red-300">
                            {row.participant_role}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-mono text-xs text-gray-400">
                          {row.stream_id || "-"}
                        </td>

                        <td className="px-4 py-4 font-mono text-xs text-gray-400">
                          {row.call_request_id || "-"}
                        </td>

                        <td className="px-4 py-4 text-gray-300">
                          {formatDate(row.joined_at)}
                        </td>

                        <td className="px-4 py-4 text-gray-300">
                          {formatDate(row.left_at)}
                        </td>

                        <td className="px-4 py-4 font-black text-green-400">
                          {formatDuration(row.duration_seconds)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
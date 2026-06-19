"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AttendanceRecord = {
  id: string;
  stream_id: string;
  user_id: string;
  participant_role: string;
  joined_at: string;
  left_at?: string | null;
  watch_minutes?: number;
  profiles?: {
    username?: string;
    display_name?: string;
  };
};

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAttendance() {
    setLoading(true);

    const { data, error } = await supabase
      .from("stream_attendance")
      .select(`
        *,
        profiles:user_id (
          username,
          display_name
        )
      `)
      .order("joined_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAttendance();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Attendance</h1>
          </div>

          <button
            onClick={loadAttendance}
            className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No attendance records yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">User</th>
                  <th className="pb-4">Role</th>
                  <th className="pb-4">Joined</th>
                  <th className="pb-4">Watch Time</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-white/10">
                    <td className="py-4">
                      {record.profiles?.display_name || record.profiles?.username || "Unknown"}
                    </td>
                    <td className="py-4 capitalize">{record.participant_role}</td>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(record.joined_at).toLocaleString()}
                    </td>
                    <td className="py-4 font-mono">
                      {record.watch_minutes ? `${record.watch_minutes} min` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
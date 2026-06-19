"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  admin_id: string;
  details: any;
  created_at: string;
  profiles?: {
    username?: string;
    display_name?: string;
  };
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAuditLogs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select(`
        *,
        profiles:admin_id (
          username,
          display_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLogs(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Audit Logs</h1>
          </div>

          <button
            onClick={loadAuditLogs}
            className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500"
          >
            Refresh Logs
          </button>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No audit logs found.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">Time</th>
                  <th className="pb-4">Action</th>
                  <th className="pb-4">Admin</th>
                  <th className="pb-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 font-medium">{log.action}</td>
                    <td className="py-4">
                      {log.profiles?.display_name || log.profiles?.username || "Admin"}
                    </td>
                    <td className="py-4 text-sm text-gray-400">
                      {JSON.stringify(log.details)}
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
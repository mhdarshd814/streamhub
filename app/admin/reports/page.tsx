"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Report = {
  id: string;
  reporter_id: string;
  reported_id?: string;
  stream_id?: string;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAdminReports() {
    setLoading(true);

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setReports(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAdminReports();
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <p className="uppercase tracking-widest text-red-400 text-sm font-bold">ADMIN</p>
            <h1 className="text-5xl font-black tracking-tighter">Reports</h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadAdminReports}
              className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link href="/admin" className="rounded-2xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700">
              Back to Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="premium-glass rounded-3xl p-12 text-center">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="premium-glass rounded-3xl p-12 text-center">No reports yet.</div>
        ) : (
          <div className="premium-glass rounded-3xl p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="pb-4">Reason</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="py-4 font-medium">{report.reason}</td>
                    <td className="py-4">
                      <span className="capitalize px-4 py-1 rounded-full bg-white/10 text-sm">
                        {report.status}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-400">
                      {new Date(report.created_at).toLocaleDateString()}
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
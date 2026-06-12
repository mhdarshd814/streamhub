"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

type Report = {
  id: string;
  stream_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

type Stream = {
  id: string;
  title: string;
  user_id: string;
  status: string;
  is_suspended: boolean;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
};

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [streams, setStreams] = useState<Record<string, Stream>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminReports();
  }, []);

  async function loadAdminReports() {
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
      .select("id, is_admin")
      .eq("id", user.id)
      .single();

    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data: reportData, error: reportError } = await supabase
      .from("stream_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportError) {
      alert(reportError.message);
      setLoading(false);
      return;
    }

    const cleanReports = reportData || [];
    setReports(cleanReports);

    const streamIds = [...new Set(cleanReports.map((r) => r.stream_id))];
    const reporterIds = [...new Set(cleanReports.map((r) => r.reporter_id))];

    if (streamIds.length > 0) {
      const { data: streamData, error: streamError } = await supabase
        .from("streams")
        .select("id, title, user_id, status, is_suspended")
        .in("id", streamIds);

      if (streamError) {
        alert(streamError.message);
        setLoading(false);
        return;
      }

      const streamMap: Record<string, Stream> = {};
      streamData?.forEach((stream) => {
        streamMap[stream.id] = stream;
      });

      setStreams(streamMap);

      const creatorIds = [...new Set(streamData?.map((s) => s.user_id) || [])];
      const allProfileIds = [...new Set([...reporterIds, ...creatorIds])];

      if (allProfileIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", allProfileIds);

        const profileMap: Record<string, Profile> = {};
        profileData?.forEach((profile) => {
          profileMap[profile.id] = profile;
        });

        setProfiles(profileMap);
      }
    }

    setLoading(false);
  }

  async function updateReportStatus(
    reportId: string,
    status: "reviewed" | "rejected"
  ) {
    setUpdatingId(reportId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("stream_reports")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq("id", reportId);

    if (error) {
      alert("Failed to update report.");
    } else {
      await loadAdminReports();
    }

    setUpdatingId(null);
  }

  async function suspendStream(streamId: string, reportId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to suspend this stream?"
    );

    if (!confirmed) return;

    setUpdatingId(reportId);

    const { error } = await supabase
      .from("streams")
      .update({
        is_suspended: true,
        status: "offline",
      })
      .eq("id", streamId);

    if (error) {
      alert("Failed to suspend stream.");
      setUpdatingId(null);
      return;
    }

    await updateReportStatus(reportId, "reviewed");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-5 text-white">
        <p className="text-zinc-400">Loading moderation dashboard...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-5 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-800 bg-red-950/30 p-6">
          <h1 className="mb-2 text-2xl font-bold">Access Denied</h1>
          <p className="text-red-200">
            You do not have admin permission to view this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Moderation
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              Stream Reports
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Review reported streams and take moderation action.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl bg-zinc-800 px-4 py-3 text-center text-sm font-bold hover:bg-zinc-700"
          >
            Back to Admin
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-zinc-400">No stream reports found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const stream = streams[report.stream_id];
              const reporter = profiles[report.reporter_id];
              const creator = stream ? profiles[stream.user_id] : null;
              const isLive = stream?.status === "live";

              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            report.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : report.status === "reviewed"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {report.status}
                        </span>

                        {stream?.is_suspended && (
                          <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
                            Stream Suspended
                          </span>
                        )}

                        {isLive && !stream?.is_suspended && (
                          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Live
                          </span>
                        )}
                      </div>

                      <h2 className="break-words text-xl font-semibold sm:text-2xl">
                        {stream?.title || "Unknown Stream"}
                      </h2>

                      <p className="text-sm text-zinc-400">
                        Reported on {new Date(report.created_at).toLocaleString()}
                      </p>

                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                          <p className="mb-1 text-zinc-500">Reported By</p>
                          <p className="break-words font-medium">
                            {reporter?.full_name ||
                              reporter?.username ||
                              "Unknown User"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                          <p className="mb-1 text-zinc-500">Creator</p>
                          <p className="break-words font-medium">
                            {creator?.full_name ||
                              creator?.username ||
                              "Unknown Creator"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="mb-1 text-zinc-500">Reason</p>
                        <p className="break-words font-medium">{report.reason}</p>

                        {report.details && (
                          <>
                            <p className="mb-1 mt-4 text-zinc-500">Details</p>
                            <p className="break-words text-zinc-300">
                              {report.details}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[220px] lg:grid-cols-1">
                      {stream && (
                        <Link
                          href={`/watch/${stream.id}`}
                          className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold hover:bg-blue-700"
                        >
                          Open Stream
                        </Link>
                      )}

                      {report.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              updateReportStatus(report.id, "reviewed")
                            }
                            disabled={updatingId === report.id}
                            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                          >
                            Mark Reviewed
                          </button>

                          <button
                            onClick={() =>
                              updateReportStatus(report.id, "rejected")
                            }
                            disabled={updatingId === report.id}
                            className="rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold hover:bg-zinc-600 disabled:opacity-50"
                          >
                            Reject Report
                          </button>

                          {stream && !stream.is_suspended && (
                            <button
                              onClick={() =>
                                suspendStream(stream.id, report.id)
                              }
                              disabled={updatingId === report.id}
                              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                            >
                              Suspend Stream
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Subscription = {
  id: string;
  subscriber_id: string;
  creator_id: string;
  plan_id: string | null;
  status: string;
  started_at: string;
  cancelled_at: string | null;
  creator_profile?: any;
  subscriber_profile?: any;
  plan?: any;
};

export default function AdminSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data } = await supabase
      .from("creator_subscriptions")
      .select(
        `
        *,
        plan:plan_id (
          plan_name,
          price_usd
        )
      `
      )
      .order("created_at", { ascending: false });

    const rows = await Promise.all(
      (data || []).map(async (item: any) => {
        const [{ data: creator }, { data: subscriber }] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", item.creator_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", item.subscriber_id)
            .maybeSingle(),
        ]);

        return {
          ...item,
          creator_profile: creator,
          subscriber_profile: subscriber,
        };
      })
    );

    setSubscriptions(rows);
    setLoading(false);
  }

  const active = subscriptions.filter((item) => item.status === "active");
  const cancelled = subscriptions.filter((item) => item.status === "cancelled");

  const estimatedRevenue = active.reduce(
    (total, item) => total + Number(item.plan?.price_usd || 0),
    0
  );

  const creatorCounts = active.reduce<Record<string, number>>((acc, item) => {
    acc[item.creator_id] = (acc[item.creator_id] || 0) + 1;
    return acc;
  }, {});

  const topCreators = Object.entries(creatorCounts)
    .map(([creatorId, count]) => {
      const sub = active.find((item) => item.creator_id === creatorId);
      return {
        creatorId,
        count,
        profile: sub?.creator_profile,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading subscriptions...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="text-3xl font-black">Access Denied</h1>
          <p className="mt-3 text-red-200">Admin permission required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold text-yellow-300">
              Admin Subscriptions
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              Subscription <span className="text-yellow-300">Control</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Monitor active subscribers, cancellations, creator performance,
              and estimated monthly subscription revenue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadData}
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

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Active Subscriptions" value={active.length} color="text-yellow-300" />
          <Stat label="Cancelled" value={cancelled.length} color="text-gray-400" />
          <Stat
            label="Estimated Monthly Revenue"
            value={`$${estimatedRevenue.toFixed(2)}`}
            color="text-green-400"
          />
        </section>

        <section className="mb-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 sm:p-6">
          <h2 className="mb-5 text-2xl font-black">Top Creators</h2>

          {topCreators.length === 0 ? (
            <p className="text-gray-400">No active subscriptions yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topCreators.map((creator, index) => (
                <Link
                  key={creator.creatorId}
                  href={`/profile/${creator.creatorId}`}
                  className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4 hover:border-yellow-400"
                >
                  <p className="text-sm text-gray-400">#{index + 1}</p>

                  <p className="mt-2 truncate text-lg font-black">
                    {creator.profile?.display_name ||
                      creator.profile?.username ||
                      "Creator"}
                  </p>

                  <p className="mt-2 text-3xl font-black text-yellow-300">
                    {creator.count}
                  </p>

                  <p className="text-xs text-gray-400">active subscribers</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-5 sm:p-6">
            <h2 className="text-2xl font-black">All Subscriptions</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="px-5 py-4">Subscriber</th>
                  <th className="px-5 py-4">Creator</th>
                  <th className="px-5 py-4">Plan</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Started</th>
                </tr>
              </thead>

              <tbody>
                {subscriptions.map((item) => (
                  <tr key={item.id} className="border-t border-gray-800">
                    <td className="px-5 py-4">
                      {item.subscriber_profile?.display_name ||
                        item.subscriber_profile?.username ||
                        item.subscriber_id}
                    </td>

                    <td className="px-5 py-4">
                      {item.creator_profile?.display_name ||
                        item.creator_profile?.username ||
                        item.creator_id}
                    </td>

                    <td className="px-5 py-4 font-bold">
                      {item.plan?.plan_name || "-"}
                    </td>

                    <td className="px-5 py-4 text-green-400">
                      USD {item.plan?.price_usd || 0}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.status === "active"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-gray-400">
                      {new Date(item.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}

                {subscriptions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-gray-400"
                    >
                      No subscriptions found.
                    </td>
                  </tr>
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
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`break-words text-3xl font-black sm:text-4xl ${color}`}>
        {value}
      </h2>
    </div>
  );
}

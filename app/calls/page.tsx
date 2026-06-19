"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type CallStream = {
  id: string;
  title: string;
  status: string;
  user_id: string;
  private_call_price?: number | null;
};

type CallRequest = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  caller?: Profile | null;
  receiver?: Profile | null;
  stream?: CallStream | null;
  is_paid?: boolean;
};

export default function CallsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`calls-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_call_requests",
        },
        async () => {
          await loadCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadCalls() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (myProfile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];

    const enriched = await Promise.all(
      rows.map(async (item: CallRequest) => {
        const [{ data: caller }, { data: receiver }, { data: stream }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", item.caller_id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .eq("id", item.receiver_id)
              .maybeSingle(),
            item.stream_id
              ? supabase
                  .from("streams")
                  .select("id, title, status, user_id, private_call_price")
                  .eq("id", item.stream_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        let isPaid = false;

        if (item.stream_id && stream?.private_call_price && stream.private_call_price > 0) {
          const { data: payment } = await supabase
            .from("private_call_payments")
            .select("id")
            .eq("stream_id", item.stream_id)
            .eq("caller_id", item.receiver_id)
            .maybeSingle();

          isPaid = !!payment;
        }

        return {
          ...item,
          caller,
          receiver,
          stream,
          is_paid: isPaid,
        };
      })
    );

    setCalls(enriched);
    setLoading(false);
  }

  async function acceptCall(call: CallRequest) {
    if (!userId || call.receiver_id !== userId || !call.stream_id) return;

    const price = Number(call.stream?.private_call_price || 0);

    const confirmed = confirm(
      price > 0
        ? `Pay $${price.toFixed(2)} and join this private call?`
        : "Accept and join this private call?"
    );

    if (!confirmed) return;

    setUpdatingId(call.id);

    if (price > 0) {
      const { error } = await supabase.rpc("pay_private_call_and_accept", {
        p_call_request_id: call.id,
      });

      if (error) {
        setUpdatingId(null);
        alert(error.message || "Payment failed. Please check your wallet balance.");
        await loadCalls();
        return;
      }
    } else {
  const { error } = await supabase.rpc("accept_private_call_request", {
    p_call_request_id: call.id,
  });

  if (error) {
    setUpdatingId(null);
    alert(error.message);
    return;
  }
}

    await supabase.from("notifications").insert([
      {
        user_id: call.caller_id,
        type: "private_call_paid",
        title: price > 0 ? "Private Call Payment Received" : "Private Call Accepted",
        message:
          price > 0
            ? `Your private call was accepted and $${price.toFixed(2)} was added to your wallet.`
            : "Your private call request was accepted.",
        link: call.stream_id ? `/live/${call.stream_id}` : "/calls",
        is_read: false,
      },
    ]);

    setUpdatingId(null);
    window.location.href = `/live/${call.stream_id}`;
  }

  async function declineCall(call: CallRequest) {
    if (!userId || call.receiver_id !== userId) return;

    const confirmed = confirm("Decline this private call request?");
    if (!confirmed) return;

    setUpdatingId(call.id);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", call.id);

    if (error) {
      setUpdatingId(null);
      alert(error.message);
      return;
    }

    if (call.stream_id) {
      await supabase
        .from("stream_guests")
        .update({ status: "declined" })
        .eq("stream_id", call.stream_id)
        .eq("guest_id", userId);
    }

    setUpdatingId(null);
    await loadCalls();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading private calls...</p>
      </main>
    );
  }

  const incoming = calls.filter((call) => call.receiver_id === userId);
  const outgoing = calls.filter((call) => call.caller_id === userId);
  const pending = calls.filter((call) => call.status === "pending");
  const paidCalls = calls.filter(
    (call) => Number(call.stream?.private_call_price || 0) > 0
  ).length;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold text-purple-300">
              WhatsApp-Style Private Video Calls
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              One-on-One <span className="text-purple-400">Calls</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Manage incoming and outgoing private call requests. Incoming calls now also appear as a popup anywhere in the app.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadCalls}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/wallet"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Wallet
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-4">
          <Stat label="Incoming" value={incoming.length} color="text-purple-300" />
          <Stat label="Outgoing" value={outgoing.length} color="text-blue-400" />
          <Stat label="Pending" value={pending.length} color="text-yellow-300" />
          <Stat label="Paid Calls" value={paidCalls} color="text-green-400" />
        </section>

        <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 sm:p-6">
          <h2 className="mb-5 text-2xl font-black">Incoming Calls</h2>

          {incoming.length === 0 ? (
            <EmptyState text="No incoming private call requests." />
          ) : (
            <div className="space-y-3">
              {incoming.map((call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  currentUserId={userId}
                  updatingId={updatingId}
                  onAccept={() => acceptCall(call)}
                  onDecline={() => declineCall(call)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <h2 className="mb-5 text-2xl font-black">Outgoing Calls</h2>

          {outgoing.length === 0 ? (
            <EmptyState text="No outgoing private call requests." />
          ) : (
            <div className="space-y-3">
              {outgoing.map((call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  currentUserId={userId}
                  updatingId={updatingId}
                  onAccept={() => acceptCall(call)}
                  onDecline={() => declineCall(call)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CallCard({
  call,
  currentUserId,
  updatingId,
  onAccept,
  onDecline,
}: {
  call: CallRequest;
  currentUserId: string | null;
  updatingId: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isIncoming = call.receiver_id === currentUserId;
  const otherPerson = isIncoming ? call.caller : call.receiver;
  const price = Number(call.stream?.private_call_price || 0);
  const name = otherPerson?.display_name || otherPerson?.username || "Unknown user";

  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
            {otherPerson?.avatar_url ? (
              <img
                src={otherPerson.avatar_url}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black">{name}</p>

            <p className="text-sm text-gray-400">
              {isIncoming ? "Incoming call request" : "Outgoing call request"}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {new Date(call.created_at).toLocaleString()}
            </p>

            {call.stream && (
              <p className="mt-2 text-sm font-bold text-purple-300">
                {call.stream.title} • {price > 0 ? `$${price.toFixed(2)}` : "Free"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                call.status === "accepted"
                  ? "bg-green-500/10 text-green-400"
                  : call.status === "declined"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {call.status.toUpperCase()}
            </span>

            {price > 0 && (
              <span className="w-fit rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                {call.is_paid ? "PAID" : "PAYMENT REQUIRED"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isIncoming && call.status === "pending" && (
              <>
                <button
                  onClick={onAccept}
                  disabled={updatingId === call.id}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-700 disabled:bg-gray-700"
                >
                  {updatingId === call.id
                    ? price > 0
                      ? "Paying..."
                      : "Opening..."
                    : price > 0
                    ? `Pay $${price.toFixed(2)} & Join`
                    : "Accept & Join"}
                </button>

                <button
                  onClick={onDecline}
                  disabled={updatingId === call.id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
                >
                  Decline
                </button>
              </>
            )}

            {call.stream_id && call.status === "accepted" && (
              <Link
                href={`/live/${call.stream_id}`}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-700"
              >
                Join Room
              </Link>
            )}

            {call.stream_id && call.status === "pending" && !isIncoming && (
              <Link
                href={`/live/${call.stream_id}`}
                className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700"
              >
                Open Waiting Room
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black ${color}`}>{value}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-6 text-center text-gray-400">
      {text}
    </div>
  );
}
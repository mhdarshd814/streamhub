"use client";

import { useEffect, useRef, useState } from "react";
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
  stream?: CallStream | null;
};

export default function IncomingCallPopup() {
  const [userId, setUserId] = useState<string | null>(null);
  const [call, setCall] = useState<CallRequest | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;

      setUserId(user.id);
      await loadLatestIncomingCall(user.id);

      const channel = supabase
        .channel(`incoming-private-calls-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "private_call_requests",
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload) => {
            const newCall = payload.new as CallRequest;

            if (newCall.status === "pending") {
              await loadSingleCall(newCall.id);
              playRing();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "private_call_requests",
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload) => {
            const updated = payload.new as CallRequest;

            if (updated.status !== "pending") {
              setCall((current) => {
                if (current?.id === updated.id) return null;
                return current;
              });
              stopRing();
            }
          }
        )
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
    }

    init();

    return () => {
      mounted = false;
      stopRing();
    };
  }, []);

  async function loadLatestIncomingCall(currentUserId: string) {
    const { data } = await supabase
      .from("private_call_requests")
      .select("*")
      .eq("receiver_id", currentUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      await loadSingleCall(data.id);
    }
  }

  async function loadSingleCall(callId: string) {
    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .eq("id", callId)
      .maybeSingle();

    if (error || !data || data.status !== "pending") return;

    const [{ data: caller }, { data: stream }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", data.caller_id)
        .maybeSingle(),
      data.stream_id
        ? supabase
            .from("streams")
            .select("id, title, status, user_id, private_call_price")
            .eq("id", data.stream_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setCall({
      ...data,
      caller,
      stream,
    });
  }

  function playRing() {
    try {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}
  }

  function stopRing() {
    try {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } catch {}
  }

  async function acceptCall() {
    if (!userId || !call || !call.stream_id || call.receiver_id !== userId) return;

    setLoadingAction(true);

    const price = Number(call.stream?.private_call_price || 0);

    if (price > 0) {
      const { error } = await supabase.rpc("pay_private_call_and_accept", {
        p_call_request_id: call.id,
      });

      if (error) {
        setLoadingAction(false);
        alert(error.message || "Payment failed. Please check your wallet balance.");
        return;
      }
    } else {
      const { error: callError } = await supabase
        .from("private_call_requests")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", call.id);

      if (callError) {
        setLoadingAction(false);
        alert(callError.message);
        return;
      }

      const { error: guestError } = await supabase
        .from("stream_guests")
        .update({ status: "accepted" })
        .eq("stream_id", call.stream_id)
        .eq("guest_id", userId);

      if (guestError) {
        setLoadingAction(false);
        alert(guestError.message);
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
            ? `Your private call was accepted and AED ${price.toFixed(2)} was added to your wallet.`
            : "Your private call request was accepted.",
        link: `/live/${call.stream_id}`,
        is_read: false,
      },
    ]);

    stopRing();
    window.location.href = `/live/${call.stream_id}`;
  }

  async function declineCall() {
    if (!userId || !call || call.receiver_id !== userId) return;

    setLoadingAction(true);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", call.id);

    if (error) {
      setLoadingAction(false);
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

    stopRing();
    setCall(null);
    setLoadingAction(false);
  }

  if (!call) {
    return (
      <audio
        ref={audioRef}
        src="/sounds/incoming-call.mp3"
        loop
        preload="auto"
        className="hidden"
      />
    );
  }

  const callerName =
    call.caller?.display_name || call.caller?.username || "Unknown caller";

  const price = Number(call.stream?.private_call_price || 0);

  return (
    <>
      <audio
        ref={audioRef}
        src="/sounds/incoming-call.mp3"
        loop
        preload="auto"
        className="hidden"
      />

      <div className="fixed inset-0 z-[99998] flex items-end justify-center bg-black/70 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-center sm:pb-4">
        <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-purple-500/30 bg-zinc-950 text-white shadow-2xl">
          <div className="bg-gradient-to-br from-purple-700 via-fuchsia-700 to-red-600 px-5 py-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/80">
              Incoming Call
            </p>

            <div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-black/30 text-4xl">
              {call.caller?.avatar_url ? (
                <img
                  src={call.caller.avatar_url}
                  alt={callerName}
                  className="h-full w-full object-cover"
                />
              ) : (
                "👤"
              )}
            </div>

            <h2 className="mt-4 truncate text-2xl font-black">{callerName}</h2>

            <p className="mt-1 truncate text-sm font-semibold text-white/80">
              {call.stream?.title || "Private video call"}
            </p>

            <p className="mt-2 text-xs font-bold text-white/80">
              {price > 0 ? `AED ${price.toFixed(2)} private call` : "Free private call"}
            </p>
          </div>

          <div className="space-y-3 p-5">
            <button
              onClick={acceptCall}
              disabled={loadingAction}
              className="w-full rounded-2xl bg-green-600 px-5 py-4 text-base font-black hover:bg-green-700 disabled:bg-zinc-700"
            >
              {loadingAction ? "Opening..." : price > 0 ? `Accept & Pay AED ${price.toFixed(2)}` : "Accept"}
            </button>

            <button
              onClick={declineCall}
              disabled={loadingAction}
              className="w-full rounded-2xl bg-red-600 px-5 py-4 text-base font-black hover:bg-red-700 disabled:bg-zinc-700"
            >
              Decline
            </button>

            <Link
              href="/calls"
              className="block w-full rounded-2xl bg-zinc-800 px-5 py-4 text-center text-base font-black hover:bg-zinc-700"
            >
              Open Call Page
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
"use client";

import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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
  missed_at?: string | null;
  expires_at?: string | null;
  ring_status?: string | null;
  caller?: Profile | null;
  stream?: CallStream | null;
};

const CALL_TIMEOUT_SECONDS = 60;
const AUTO_REDIRECT_SECONDS = 5;

export default function IncomingCallPage() {
  const params = useParams();
  const callId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [call, setCall] = useState<CallRequest | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(CALL_TIMEOUT_SECONDS);
  const [redirectSeconds, setRedirectSeconds] = useState(AUTO_REDIRECT_SECONDS);
  const [actionLoading, setActionLoading] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [expired, setExpired] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedHandledRef = useRef(false);

  useEffect(() => {
    loadCall();

    return () => {
      stopRing();
      clearCountdown();
      clearRedirect();
    };
  }, [callId]);

  useEffect(() => {
    if (!call || call.status !== "pending") return;

    startRing();
    startCountdown();

    const channel = supabase
      .channel(`incoming-call-screen-${call.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "private_call_requests",
          filter: `id=eq.${call.id}`,
        },
        async (payload) => {
          const updated = payload.new as CallRequest;

          if (updated.status === "pending") return;

          stopRing();
          clearCountdown();

          if (updated.status === "declined") {
            toast("Call declined");
            startAutoRedirect();
            return;
          }

          if (updated.status === "missed") {
            setExpired(true);
            toast("Missed call");
            startAutoRedirect();
            return;
          }

          if (updated.status === "accepted" && updated.stream_id) {
            window.location.replace(`/live/${updated.stream_id}?autojoin=1`);
            return;
          }

          startAutoRedirect();
        }
      )
      .subscribe();

    return () => {
      stopRing();
      clearCountdown();
      supabase.removeChannel(channel);
    };
  }, [call?.id]);

  async function loadCall() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .eq("id", callId)
      .maybeSingle();

    if (error || !data) {
      toast.error(error?.message || "Incoming call not found.");
      setLoading(false);
      return;
    }

    if (data.receiver_id !== user.id) {
      toast.error("This call is not for your account.");
      setLoading(false);
      return;
    }

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

    const fullCall = {
      ...(data as CallRequest),
      caller: caller || null,
      stream: stream || null,
    };

    setCall(fullCall);

    if (data.status !== "pending") {
      if (data.status === "missed") setExpired(true);
      setLoading(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      await markMissed(fullCall);
      setExpired(true);
      setLoading(false);
      startAutoRedirect();
      return;
    }

    setSecondsLeft(getInitialSecondsLeft(data.created_at, data.expires_at));
    setLoading(false);
  }

  function getInitialSecondsLeft(createdAt: string, expiresAt?: string | null) {
    if (expiresAt) {
      const diff = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / 1000
      );
      return Math.max(0, Math.min(CALL_TIMEOUT_SECONDS, diff));
    }

    const age = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    return Math.max(0, CALL_TIMEOUT_SECONDS - age);
  }

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function clearRedirect() {
    if (redirectRef.current) {
      clearInterval(redirectRef.current);
      redirectRef.current = null;
    }
  }

  function startCountdown() {
    clearCountdown();

    countdownRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        const next = current - 1;

        if (next <= 0) {
          clearCountdown();
          void handleTimeout();
          return 0;
        }

        return next;
      });
    }, 1000);
  }

  function startAutoRedirect() {
    clearRedirect();
    setRedirectSeconds(AUTO_REDIRECT_SECONDS);

    redirectRef.current = setInterval(() => {
      setRedirectSeconds((current) => {
        const next = current - 1;

        if (next <= 0) {
          clearRedirect();
          window.location.replace("/calls");
          return 0;
        }

        return next;
      });
    }, 1000);
  }

  async function handleTimeout() {
    if (!call?.id || actionLoading || missedHandledRef.current) return;

    stopRing();
    await markMissed(call);
    setExpired(true);
    toast("Missed call");
    startAutoRedirect();
  }

  async function markMissed(targetCall: CallRequest) {
    if (missedHandledRef.current) return;
    missedHandledRef.current = true;

    const missedAt = new Date().toISOString();

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "missed",
        ring_status: "expired",
        missed_at: missedAt,
      })
      .eq("id", targetCall.id)
      .eq("status", "pending");

    if (error) {
      console.warn("Mark missed failed:", error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: targetCall.caller_id,
        type: "private_call_missed",
        title: "Missed Private Call",
        message: `${
          targetCall.caller?.display_name ||
          targetCall.caller?.username ||
          "The receiver"
        } did not answer your private call.`,
        link: "/calls",
        is_read: false,
      },
    ]);

    if (targetCall.stream_id) {
      await supabase
        .from("stream_guests")
        .update({ status: "declined" })
        .eq("stream_id", targetCall.stream_id)
        .eq("guest_id", targetCall.receiver_id)
        .eq("status", "pending");
    }
  }

  function startRing() {
    startVibration();

    if (!audioRef.current) {
      setSoundBlocked(true);
      return;
    }

    audioRef.current.volume = 1;
    audioRef.current.currentTime = 0;

    audioRef.current.play().catch(() => {
      setSoundBlocked(true);
    });
  }

  async function unlockSound() {
    if (!audioRef.current) return;

    try {
      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setSoundBlocked(false);
      startVibration();
    } catch {
      setSoundBlocked(true);
      toast.error("Tap again. Android blocked ringtone audio.");
    }
  }

  function startVibration() {
    try {
      if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

      navigator.vibrate([700, 300, 700]);

      if (vibrateRef.current) clearInterval(vibrateRef.current);

      vibrateRef.current = setInterval(() => {
        try {
          navigator.vibrate([700, 300, 700]);
        } catch {}
      }, 2500);
    } catch {}
  }

  function stopVibration() {
    try {
      if (vibrateRef.current) {
        clearInterval(vibrateRef.current);
        vibrateRef.current = null;
      }

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(0);
      }
    } catch {}
  }

  function stopRing() {
    stopVibration();

    try {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } catch {}
  }

  async function acceptCall() {
    if (!userId || !call || !call.stream_id || call.receiver_id !== userId) return;

    if (secondsLeft <= 0 || expired) {
      toast.error("This call has expired.");
      return;
    }

    setActionLoading(true);
    stopRing();
    clearCountdown();

    const price = Number(call.stream?.private_call_price || 0);

    if (price > 0) {
      const { error } = await supabase.rpc("pay_private_call_and_accept", {
        p_call_request_id: call.id,
      });

      if (error) {
        setActionLoading(false);
        toast.error(error.message || "Payment failed. Check wallet balance.");
        startRing();
        startCountdown();
        return;
      }
    } else {
      const { error } = await supabase.rpc("accept_private_call_request", {
        p_call_request_id: call.id,
      });

      if (error) {
        setActionLoading(false);
        toast.error(error.message);
        startRing();
        startCountdown();
        return;
      }
    }

    await supabase.from("notifications").insert([
      {
        user_id: call.caller_id,
        type: price > 0 ? "private_call_paid" : "private_call_accepted",
        title: price > 0 ? "Private Call Payment Received" : "Private Call Accepted",
        message:
          price > 0
            ? `Your private call was accepted and $${price.toFixed(
                2
              )} was added to your wallet.`
            : "Your private call request was accepted.",
        link: `/live/${call.stream_id}`,
        is_read: false,
      },
    ]);

    window.location.replace(`/live/${call.stream_id}?autojoin=1`);
  }

  async function declineCall() {
    if (!userId || !call || call.receiver_id !== userId) return;

    setActionLoading(true);
    stopRing();
    clearCountdown();

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        ring_status: "declined",
      })
      .eq("id", call.id)
      .eq("status", "pending");

    if (error) {
      setActionLoading(false);
      toast.error(error.message);
      startRing();
      startCountdown();
      return;
    }

    if (call.stream_id) {
      await supabase
        .from("stream_guests")
        .update({ status: "declined" })
        .eq("stream_id", call.stream_id)
        .eq("guest_id", userId);
    }

    await supabase.from("notifications").insert([
      {
        user_id: call.caller_id,
        type: "private_call_declined",
        title: "Private Call Declined",
        message: "Your private call request was declined.",
        link: "/calls",
        is_read: false,
      },
    ]);

    toast("Call declined");
    startAutoRedirect();
  }

  const callerName =
    call?.caller?.display_name || call?.caller?.username || "StreamHub Caller";

  const callerUsername = call?.caller?.username || "private-call";
  const price = Number(call?.stream?.private_call_price || 0);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <p className="text-gray-400">Opening incoming call...</p>
      </main>
    );
  }

  if (!call) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-6xl">📵</div>
          <h1 className="text-3xl font-black">Call Not Found</h1>
          <p className="mt-3 text-gray-400">
            This incoming call request no longer exists.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/calls")}
            className="mt-7 rounded-full bg-red-600 px-6 py-4 font-black"
          >
            Open Calls
          </button>
        </div>
      </main>
    );
  }

  if (expired || call.status === "missed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="slide-up max-w-sm text-center">
          <div className="mb-4 text-6xl">☎️</div>
          <h1 className="text-3xl font-black">Missed Call</h1>
          <p className="mt-3 text-gray-400">
            This private call was not answered in time.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Redirecting to calls in {redirectSeconds}s...
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/calls")}
            className="mt-7 rounded-full bg-red-600 px-6 py-4 font-black"
          >
            Open Calls
          </button>
        </div>
      </main>
    );
  }

  if (call.status !== "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="slide-up max-w-sm text-center">
          <div className="mb-4 text-6xl">📞</div>
          <h1 className="text-3xl font-black">Call {call.status}</h1>
          <p className="mt-3 text-gray-400">
            This private call is no longer pending.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Redirecting to calls in {redirectSeconds}s...
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/calls")}
            className="mt-7 rounded-full bg-red-600 px-6 py-4 font-black"
          >
            Open Calls
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 text-white">
      <audio ref={audioRef} src="/sounds/ringtone.mp3" loop preload="auto" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.28),transparent_34rem)]" />

      <div className="slide-up relative z-10 w-full max-w-sm text-center">
        <p className="mb-5 text-xs font-black uppercase tracking-[0.35em] text-red-400">
          Incoming Call
        </p>

        <div className="mx-auto mb-6 flex h-32 w-32 animate-pulse items-center justify-center overflow-hidden rounded-full border-4 border-red-600 bg-gray-800 shadow-2xl shadow-red-600/30">
          {call.caller?.avatar_url ? (
            <img
              src={call.caller.avatar_url}
              alt={callerName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-6xl">👤</span>
          )}
        </div>

        <h1 className="text-4xl font-black">{callerName}</h1>

        <p className="mt-2 text-sm text-gray-400">@{callerUsername}</p>

        <div className="mx-auto mt-6 w-fit rounded-full border border-red-900/50 bg-red-600/10 px-5 py-2 text-sm font-black text-red-300">
          {price > 0 ? `Paid Private Call • $${price.toFixed(2)}` : "Free Private Call"}
        </div>

        <p className="mt-5 text-sm text-gray-400">
          {call.stream?.title || "Private video call"}
        </p>

        <div className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-full border border-red-600/50 bg-red-600/10 text-2xl font-black text-red-400">
          {secondsLeft}
        </div>

        {soundBlocked && (
          <button
            type="button"
            onClick={unlockSound}
            className="mt-5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-300"
          >
            Tap to enable ringtone
          </button>
        )}

        <div className="mt-10 grid grid-cols-2 gap-5">
          <button
            type="button"
            onClick={declineCall}
            disabled={actionLoading}
            className="flex h-20 items-center justify-center rounded-full bg-red-700 text-lg font-black shadow-2xl shadow-red-900/40 disabled:bg-gray-700"
          >
            Decline
          </button>

          <button
            type="button"
            onClick={acceptCall}
            disabled={actionLoading}
            className="flex h-20 items-center justify-center rounded-full bg-green-600 text-lg font-black shadow-2xl shadow-green-900/40 disabled:bg-gray-700"
          >
            Accept
          </button>
        </div>

        <button
          type="button"
          onClick={() => (window.location.href = "/calls")}
          className="mt-7 text-sm font-bold text-gray-500"
        >
          View call history
        </button>
      </div>
    </main>
  );
}
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
  expires_at?: string | null;
  ring_status?: string | null;
  caller?: Profile | null;
  stream?: CallStream | null;
};

export default function IncomingCallPopup() {
  const [userId, setUserId] = useState<string | null>(null);
  const [call, setCall] = useState<CallRequest | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const vibrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;

      setUserId(user.id);
      await loadLatestIncomingCall(user.id, false);

      channel = supabase
        .channel(`incoming-private-calls-${user.id}-${Date.now()}`)
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
              await loadSingleCall(newCall.id, true);
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

            if (updated.status === "pending") {
              await loadSingleCall(updated.id, true);
              return;
            }

            setCall((current) => {
              if (current?.id === updated.id) {
                activeCallIdRef.current = null;
                stopRing();
                setLoadingAction(false);
                return null;
              }
              return current;
            });
          }
        )
        .subscribe();

      // Android WebView / browser realtime can miss events after navigation or sleep.
      // Polling keeps the popup reliable for repeat calls.
      pollTimer = setInterval(async () => {
        await loadLatestIncomingCall(user.id, true);
      }, 3000);
    }

    init();

    return () => {
      mounted = false;
      stopRing();
      if (channel) supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    // Browsers and Android WebView block sound until the user has interacted once.
    // This unlocks the audio after any tap/click/key press inside the app.
    const unlock = async () => {
      if (audioUnlockedRef.current || !audioRef.current) return;

      try {
        audioRef.current.volume = 0;
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1;
        audioUnlockedRef.current = true;
        setSoundBlocked(false);
      } catch {
        // Still blocked until a stronger user gesture occurs.
      }
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function loadLatestIncomingCall(currentUserId: string, shouldRing: boolean) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .eq("receiver_id", currentUserId)
      .eq("status", "pending")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("Incoming call lookup skipped:", error.message);
      return;
    }

    if (!data?.id) {
      activeCallIdRef.current = null;
      stopRing();
      setLoadingAction(false);
      setSoundBlocked(false);
      setCall(null);
      return;
    }
    if (activeCallIdRef.current === data.id) return;

    await loadSingleCall(data.id, shouldRing);
  }

  async function loadSingleCall(callId: string, shouldRing: boolean) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .eq("id", callId)
      .maybeSingle();

    if (error || !data) return;
    if (data.status !== "pending") return;

    if (data.expires_at && new Date(data.expires_at) <= new Date(now)) {
      await supabase
        .from("private_call_requests")
        .update({ status: "missed", ring_status: "expired" })
        .eq("id", data.id);
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

    activeCallIdRef.current = data.id;
    setLoadingAction(false);
    setCall({ ...data, caller, stream });

    if (shouldRing) playRing();
  }

  async function unlockAndPlayRing() {
    if (!audioRef.current) return;

    try {
      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      audioUnlockedRef.current = true;
      setSoundBlocked(false);
      startVibration();
    } catch {
      setSoundBlocked(true);
      startVibration();
    }
  }

  function playRing() {
    try {
      startVibration();

      if (!audioRef.current) {
        setSoundBlocked(true);
        return;
      }

      audioRef.current.volume = 1;
      audioRef.current.currentTime = 0;

      audioRef.current
        .play()
        .then(() => {
          audioUnlockedRef.current = true;
          setSoundBlocked(false);
        })
        .catch(() => {
          // This is normal on Android/browser until user taps once.
          setSoundBlocked(true);
        });
    } catch {
      setSoundBlocked(true);
    }
  }

  function startVibration() {
    try {
      if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

      navigator.vibrate([700, 300, 700]);

      if (vibrateTimerRef.current) clearInterval(vibrateTimerRef.current);
      vibrateTimerRef.current = setInterval(() => {
        try {
          navigator.vibrate([700, 300, 700]);
        } catch {}
      }, 2500);
    } catch {}
  }

  function stopVibration() {
    try {
      if (vibrateTimerRef.current) {
        clearInterval(vibrateTimerRef.current);
        vibrateTimerRef.current = null;
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

    setLoadingAction(true);
    stopRing();
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
      const { error } = await supabase.rpc("accept_private_call_request", {
        p_call_request_id: call.id,
      });

      if (error) {
        setLoadingAction(false);
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
        link: `/live/${call.stream_id}`,
        is_read: false,
      },
    ]);

    stopRing();
    setCall(null);
    activeCallIdRef.current = null;
    window.location.href = `/live/${call.stream_id}`;
  }

  async function declineCall() {
    if (!userId || !call || call.receiver_id !== userId) return;

    setLoadingAction(true);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        ring_status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", call.id);

    if (error) {
      setLoadingAction(false);
      alert(error.message);
      return;
    }

    stopRing();
    activeCallIdRef.current = null;
    setCall(null);
    setLoadingAction(false);
    setSoundBlocked(false);
  }

  const audioElement = (
    <audio
      ref={audioRef}
      src="/sounds/incoming-call.mp3"
      loop
      preload="auto"
      playsInline
      className="hidden"
    />
  );

  if (!call) return audioElement;

  const callerName = call.caller?.display_name || call.caller?.username || "Unknown caller";
  const price = Number(call.stream?.private_call_price || 0);

  return (
    <>
      {audioElement}

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
              {price > 0 ? `$${price.toFixed(2)} private call` : "Free private call"}
            </p>
          </div>

          <div className="space-y-3 p-5">
            {soundBlocked && (
              <button
                onClick={unlockAndPlayRing}
                className="w-full rounded-2xl border border-yellow-400/40 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-200 hover:bg-yellow-500/20"
              >
                🔊 Tap to Enable Ringtone
              </button>
            )}

            <button
              onClick={acceptCall}
              disabled={loadingAction}
              className="w-full rounded-2xl bg-green-600 px-5 py-4 text-base font-black hover:bg-green-700 disabled:bg-zinc-700"
            >
              {loadingAction ? "Opening..." : price > 0 ? `Accept & Pay $${price.toFixed(2)}` : "Accept"}
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

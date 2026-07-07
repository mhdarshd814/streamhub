"use client";

import { useEffect, useRef, useState } from "react";
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
  const callRef = useRef<CallRequest | null>(null);
  const autoHandledRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const vibrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

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
        maybeAutoDeclineFromNative();
        maybeAutoAcceptFromNative();
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

  function consumeNativeAccept(target: CallRequest): boolean {
    // Native notification Accept writes the callId here (see MainActivity).
    try {
      const pending = localStorage.getItem("streamhub_accept_call");
      if (!pending || pending !== target.id) return false;
      localStorage.removeItem("streamhub_accept_call");
      return true;
    } catch {
      return false;
    }
  }

  function consumeNativeDecline(target: CallRequest): boolean {
    // Native notification Decline stores the callId; MainActivity delivers
    // it here on next app open (see IncomingCallActionReceiver).
    try {
      const pending = localStorage.getItem("streamhub_decline_call");
      if (!pending || pending !== target.id) return false;
      localStorage.removeItem("streamhub_decline_call");
      return true;
    } catch {
      return false;
    }
  }

  function maybeAutoDeclineFromNative() {
    const current = callRef.current;
    if (!current) return;
    if (consumeNativeDecline(current)) {
      declineCallFor(current, true);
    }
  }

  function maybeAutoAcceptFromNative() {
    const current = callRef.current;
    if (!current) return;
    if (autoHandledRef.current === current.id) return;
    if (!consumeNativeAccept(current)) return;

    autoHandledRef.current = current.id;
    const price = Number(current.stream?.private_call_price || 0);

    // Free calls: the user already pressed Accept on the native
    // notification — join directly. Paid calls keep one in-app tap so the
    // price is on screen before the wallet is charged.
    if (price === 0) {
      acceptCallFor(current);
    }
  }

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
      try {
        localStorage.removeItem("streamhub_accept_call");
      } catch {}
      activeCallIdRef.current = null;
      stopRing();
      setLoadingAction(false);
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

    const loaded: CallRequest = { ...data, caller, stream };

    // Declined on the native notification while the app was closed:
    // decline server-side silently, never show or ring.
    if (consumeNativeDecline(loaded)) {
      declineCallFor(loaded, true);
      return;
    }

    activeCallIdRef.current = data.id;
    setLoadingAction(false);
    callRef.current = loaded;
    setCall(loaded);

    // Native Accept handoff: join without ringing again.
    if (autoHandledRef.current !== loaded.id && consumeNativeAccept(loaded)) {
      autoHandledRef.current = loaded.id;
      const price = Number(loaded.stream?.private_call_price || 0);
      if (price === 0) {
        acceptCallFor(loaded);
        return;
      }
    }

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

  async function acceptCallFor(target: CallRequest) {
    if (!userId || !target || !target.stream_id || target.receiver_id !== userId) return;

    setLoadingAction(true);
    stopRing();
    const price = Number(target.stream?.private_call_price || 0);

    if (price > 0) {
      const { error } = await supabase.rpc("pay_private_call_and_accept", {
        p_call_request_id: target.id,
      });

      if (error) {
        setLoadingAction(false);
        alert(error.message || "Payment failed. Please check your wallet balance.");
        return;
      }
    } else {
      const { error } = await supabase.rpc("accept_private_call_request", {
        p_call_request_id: target.id,
      });

      if (error) {
        setLoadingAction(false);
        alert(error.message);
        return;
      }
    }

    await supabase.from("notifications").insert([
      {
        user_id: target.caller_id,
        type: "private_call_paid",
        title: price > 0 ? "Private Call Payment Received" : "Private Call Accepted",
        message:
          price > 0
            ? `Your private call was accepted and $${price.toFixed(2)} was added to your wallet.`
            : "Your private call request was accepted.",
        link: `/live/${target.stream_id}`,
        is_read: false,
      },
    ]);

    stopRing();
    activeCallIdRef.current = null;
    window.location.replace(`/live/${target.stream_id}?autojoin=1`);
  }

  async function declineCallFor(target: CallRequest, silent: boolean) {
    if (!userId || !target || target.receiver_id !== userId) return;

    if (!silent) setLoadingAction(true);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        ring_status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", target.id);

    if (error) {
      setLoadingAction(false);
      if (!silent) alert(error.message);
      return;
    }

    stopRing();
    if (activeCallIdRef.current === target.id) {
      activeCallIdRef.current = null;
      setCall(null);
    }
    setLoadingAction(false);
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

      {/* Full-screen takeover: the ONLY in-app ringing UI (Phase A1) */}
      <div className="fixed inset-0 z-[99998] flex flex-col bg-gradient-to-b from-canvas via-canvas to-live/12 text-white">
        {/* Top: context */}
        <div className="flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top)+3rem)]">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-muted">
            Incoming private call
          </p>

          <span
            className={`mt-3 rounded-full px-4 py-1.5 text-xs font-black ${
              price > 0
                ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                : "bg-surface-raised text-muted ring-1 ring-hairline"
            }`}
          >
            {price > 0 ? `$${price.toFixed(2)} per call` : "Free call"}
          </span>
        </div>

        {/* Center: caller identity */}
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="relative">
            <span className="absolute inset-0 -m-3 animate-ping rounded-full bg-live/20" />
            <span className="absolute inset-0 -m-1.5 rounded-full bg-live/25" />
            <div className="avatar relative h-36 w-36 border-4 border-hairline-strong text-6xl shadow-2xl">
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
          </div>

          <h2 className="font-display mt-8 max-w-full truncate px-4 text-center text-3xl font-black">
            {callerName}
          </h2>

          <p className="mt-2 max-w-full truncate px-4 text-center text-sm font-semibold text-muted">
            {call.stream?.title || "Private video call"}
          </p>

          {soundBlocked && (
            <button
              onClick={unlockAndPlayRing}
              className="mt-6 rounded-full border border-warning/40 bg-warning-soft px-5 py-2.5 text-sm font-bold text-warning active:bg-warning/25"
            >
              🔊 Tap to enable ringtone
            </button>
          )}
        </div>

        {/* Bottom: WhatsApp-style circular actions */}
        <div className="flex items-start justify-center gap-20 px-6 pb-[calc(env(safe-area-inset-bottom)+3.5rem)]">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => call && declineCallFor(call, false)}
              disabled={loadingAction}
              aria-label="Decline call"
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-danger shadow-lg shadow-danger/40 transition-transform active:scale-90 disabled:bg-surface-raised"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-8 w-8 rotate-[135deg]"
              >
                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z" />
              </svg>
            </button>
            <span className="text-xs font-bold text-muted">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => call && acceptCallFor(call)}
              disabled={loadingAction}
              aria-label={price > 0 ? `Accept and pay $${price.toFixed(2)}` : "Accept call"}
              className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-success shadow-lg shadow-success/40 transition-transform active:scale-90 disabled:bg-surface-raised"
            >
              {loadingAction ? (
                <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                  <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z" />
                </svg>
              )}
            </button>
            <span className="text-xs font-bold text-muted">
              {loadingAction ? "Opening..." : price > 0 ? `Accept · $${price.toFixed(2)}` : "Accept"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type PrivateCallRequest = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string;
  status: string;
  created_at: string;
};

export default function IncomingCallPopup() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<PrivateCallRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-private-calls-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_call_requests",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const call = payload.new as PrivateCallRequest;

          if (call.status === "pending") {
            setIncomingCall(call);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    setLoading(true);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", incomingCall.id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const streamId = incomingCall.stream_id;
    setIncomingCall(null);
    router.push(`/live/${streamId}?role=guest`);
  };

  const declineCall = async () => {
    if (!incomingCall) return;

    setLoading(true);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", incomingCall.id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/75 px-3 pb-4 sm:items-center sm:px-4 sm:pb-0">
      <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-zinc-950 p-5 text-white shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-zinc-700 sm:hidden" />

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-4xl animate-pulse">
            📞
          </div>

          <p className="text-xs uppercase tracking-[0.25em] text-green-400">
            Private Call
          </p>

          <h2 className="mt-2 text-2xl font-bold">Incoming Call</h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Someone is inviting you to a private one-on-one video call.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={declineCall}
            disabled={loading}
            className="min-h-14 rounded-2xl bg-red-600 px-4 py-4 text-base font-bold text-white active:scale-95 hover:bg-red-700 disabled:opacity-50"
          >
            Decline
          </button>

          <button
            onClick={acceptCall}
            disabled={loading}
            className="min-h-14 rounded-2xl bg-green-600 px-4 py-4 text-base font-bold text-white active:scale-95 hover:bg-green-700 disabled:opacity-50"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
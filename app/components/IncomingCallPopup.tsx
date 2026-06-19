"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/90 px-4 pb-6 sm:items-center sm:px-6">
      <div className="premium-glass w-full max-w-md rounded-3xl p-8 text-white shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-5xl animate-pulse">
            📞
          </div>

          <p className="text-xs uppercase tracking-widest text-green-400">INCOMING PRIVATE CALL</p>
          <h2 className="mt-3 text-3xl font-black">Someone is calling you</h2>
          <p className="mt-2 text-sm text-gray-400">Tap Accept to join the private video call.</p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4">
          <button
            onClick={declineCall}
            disabled={loading}
            className="rounded-2xl bg-red-600 py-5 font-black text-xl hover:bg-red-500 disabled:bg-gray-700"
          >
            Decline
          </button>

          <button
            onClick={acceptCall}
            disabled={loading}
            className="rounded-2xl bg-green-600 py-5 font-black text-xl hover:bg-green-500 disabled:bg-gray-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
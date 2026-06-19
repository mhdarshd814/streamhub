"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function IncomingCallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.id as string;

  const [call, setCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    async function loadCall() {
      const { data, error } = await supabase
        .from("private_call_requests")
        .select("*")
        .eq("id", callId)
        .single();

      if (error) {
        alert("Call not found");
        router.push("/calls");
        return;
      }

      setCall(data);
      setLoading(false);
    }

    loadCall();
  }, [callId, router]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const acceptCall = async () => {
    router.push(`/live/${call.stream_id}?role=guest`);
  };

  const declineCall = async () => {
    await supabase
      .from("private_call_requests")
      .update({ status: "declined" })
      .eq("id", callId);

    router.push("/calls");
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading call...</div>;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
      <audio ref={audioRef} src="/sounds/ringtone.mp3" loop preload="auto" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.3),transparent_70%)]" />

      <div className="relative z-10 text-center px-6">
        <div className="mx-auto mb-8 h-32 w-32 rounded-full border-4 border-red-500 animate-pulse flex items-center justify-center text-6xl">
          📞
        </div>

        <h1 className="text-5xl font-black mb-4">Incoming Call</h1>
        <p className="text-xl text-gray-400">Someone wants to talk privately</p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={declineCall}
            className="rounded-2xl bg-red-600 px-10 py-5 text-xl font-black hover:bg-red-500"
          >
            Decline
          </button>

          <button
            onClick={acceptCall}
            className="rounded-2xl bg-green-600 px-10 py-5 text-xl font-black hover:bg-green-500"
          >
            Accept Call
          </button>
        </div>
      </div>
    </main>
  );
}
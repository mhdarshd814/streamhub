"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "@/lib/supabase";

export default function LiveRoomPage() {
  const params = useParams();
  const streamId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [connected, setConnected] = useState(false);

  // Your existing logic...

  return (
    <>
      {room && isTheaterMode && (
        <div className="fixed inset-0 z-[2147483647] h-[100dvh] w-screen overflow-hidden bg-black">
          {/* Fullscreen theater content */}
        </div>
      )}

      <div className={isTheaterMode ? "hidden" : "min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10"}>
        {/* Your main content */}
        <p className="text-gray-400">Live Room UI coming soon...</p>
      </div>
    </>
  );
}
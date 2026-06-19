"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LiveFeedPage() {
  const [streams, setStreams] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("Loading live streams...");
  const [readyToShowLive, setReadyToShowLive] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  // Stub event handlers
  const handleWheel = (e: any) => {};
  const handleTouchStart = (e: any) => {};
  const handleTouchEnd = (e: any) => {};
  const handleVideoTap = () => {};
  const openProfile = () => {};
  const toggleFollow = () => {};
  const toggleLike = () => {};
  const openFullRoom = () => {};

  // Your existing logic here...

  return (
    <main
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleVideoTap}
      className="relative h-screen w-full overflow-hidden bg-black text-white"
    >
      {/* Video Container */}
      <div ref={videoRef} className="absolute inset-0 bg-black" />

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/90" />

      {/* Top Bar */}
      <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 flex justify-between">
        <div className="rounded-full bg-red-600/90 px-4 py-1 text-xs font-black tracking-widest shadow-lg">
          LIVE
        </div>
        <div className="rounded-full bg-black/70 px-3 py-1 text-xs font-mono backdrop-blur">
          {activeIndex + 1} / {streams.length}
        </div>
      </div>

      {/* Creator Info */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 right-4 z-20">
        <h1 className="text-2xl font-black leading-tight mb-1">Live Stream Title</h1>
        <p className="text-sm text-white/70">Category • Viewers</p>
      </div>

      {/* Chat Preview & Actions */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] right-4 z-20 flex flex-col items-end gap-3">
        <button className="premium-glass flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-xl">
          ❤️
        </button>
        <button className="premium-glass flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-xl">
          💬
        </button>
      </div>

      {/* Status Overlay */}
      {!readyToShowLive && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="mx-auto mb-6 text-6xl">📡</div>
            <p className="text-xl font-semibold">{status}</p>
          </div>
        </div>
      )}
    </main>
  );
}
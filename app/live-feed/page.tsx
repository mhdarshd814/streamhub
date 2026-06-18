"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, RemoteTrack, RemoteTrackPublication, Track } from "livekit-client";
import { supabase } from "../../lib/supabase";
import { KeepAwake } from "@capacitor-community/keep-awake";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
};

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  viewers: number | null;
  likes: number | null;
  thumbnail_url: string | null;
  created_at: string;
  profile?: Profile | null;
};

export default function LiveFeedPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading live feed...");
  const [connected, setConnected] = useState(false);
  const [likes, setLikes] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const touchStartYRef = useRef<number | null>(null);

  const activeStream = useMemo(() => streams[activeIndex] || null, [streams, activeIndex]);

  useEffect(() => {
    loadLiveStreams();

    return () => {
      cleanupRoom();
      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!activeStream) return;

    setLikes(Number(activeStream.likes || 0));
    connectToStream(activeStream);

    return () => {
      cleanupRoom();
    };
  }, [activeStream?.id]);

  async function loadLiveStreams() {
    setLoading(true);

    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .eq("status", "live")
      .neq("visibility", "private")
      .order("viewers", { ascending: false });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    const withProfiles = await Promise.all(
      (data || []).map(async (stream) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, is_verified")
          .eq("id", stream.user_id)
          .maybeSingle();

        return { ...stream, profile };
      })
    );

    setStreams(withProfiles as Stream[]);
    setLoading(false);

    if (withProfiles.length === 0) {
      setStatus("No live streams right now.");
    }
  }

  function cleanupRoom() {
    audioElementsRef.current.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch {}
    });

    audioElementsRef.current = [];

    try {
      roomRef.current?.disconnect();
    } catch {}

    roomRef.current = null;
    setConnected(false);

    if (videoRef.current) {
      videoRef.current.innerHTML = "";
    }
  }

  async function connectToStream(stream: Stream) {
    cleanupRoom();
    setStatus("Connecting...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!user || !session?.access_token) {
      setStatus("Login required to watch live feed.");
      window.location.href = "/login";
      return;
    }

    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.username ||
      "Viewer";

    const tokenResponse = await fetch("/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        roomName: stream.id,
        streamId: stream.id,
        participantName: `viewer-${displayName}`,
        mode: "viewer",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      setStatus(tokenData.error || "Unable to join stream.");
      return;
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!livekitUrl) {
      setStatus("LiveKit URL missing.");
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    } as any);

    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
      try {
        publication.setVideoQuality?.(2);
      } catch {}

      attachTrack(track);
    });

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      setStatus("Disconnected.");
    });

    await room.connect(livekitUrl, tokenData.token, {
      autoSubscribe: true,
    } as any);

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication: any) => {
        try {
          publication.setSubscribed?.(true);
          publication.setVideoQuality?.(2);
        } catch {}

        if (publication.track) {
          attachTrack(publication.track);
        }
      });
    });

    setConnected(true);
    setStatus("Live");

    await KeepAwake.keepAwake().catch(() => {});
  }

  function attachTrack(track: RemoteTrack) {
    if (track.kind === Track.Kind.Video && videoRef.current) {
      const video = track.attach() as HTMLVideoElement;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.backgroundColor = "#000";

      videoRef.current.innerHTML = "";
      videoRef.current.appendChild(video);
      video.play().catch(() => {});
    }

    if (track.kind === Track.Kind.Audio) {
      const audio = track.attach() as HTMLAudioElement;
      audio.autoplay = true;
      audio.controls = false;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioElementsRef.current.push(audio);
      audio.play().catch(() => {});
    }
  }

  function goNext() {
    if (streams.length <= 1) return;
    setActiveIndex((current) => (current + 1 >= streams.length ? 0 : current + 1));
  }

  function goPrevious() {
    if (streams.length <= 1) return;
    setActiveIndex((current) => (current - 1 < 0 ? streams.length - 1 : current - 1));
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(e.deltaY) < 40) return;
    if (e.deltaY > 0) goNext();
    else goPrevious();
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    touchStartYRef.current = e.touches[0]?.clientY || null;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const startY = touchStartYRef.current;
    const endY = e.changedTouches[0]?.clientY;

    if (startY === null || endY === undefined) return;

    const diff = startY - endY;

    if (Math.abs(diff) < 50) return;

    if (diff > 0) goNext();
    else goPrevious();

    touchStartYRef.current = null;
  }

  async function toggleLike() {
    if (!activeStream) return;

    const { error, data } = await supabase.rpc("toggle_stream_like", {
      stream_id_input: activeStream.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setLikes(Number(data || likes + 1));
  }

  function openFullRoom() {
    if (!activeStream) return;
    window.location.href = `/watch/${activeStream.id}`;
  }

  function openProfile() {
    if (!activeStream?.user_id) return;
    window.location.href = `/profile/${activeStream.user_id}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-gray-400">Loading live feed...</p>
      </main>
    );
  }

  if (!activeStream) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-6xl">📺</div>
          <h1 className="text-3xl font-black">No Live Streams</h1>
          <p className="mt-3 text-gray-400">Nobody is live right now.</p>
          <button
            onClick={() => (window.location.href = "/explore")}
            className="mt-6 rounded-full bg-red-600 px-6 py-3 font-black"
          >
            Back to Explore
          </button>
        </div>
      </main>
    );
  }

  const hostName =
    activeStream.profile?.display_name ||
    activeStream.profile?.username ||
    "Creator";

  return (
    <main
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative h-screen w-full overflow-hidden bg-black text-white"
    >
      <div ref={videoRef} className="absolute inset-0 bg-black">
        {activeStream.thumbnail_url && !connected && (
          <img
            src={activeStream.thumbnail_url}
            alt={activeStream.title}
            className="h-full w-full object-cover opacity-60"
          />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 rounded-full bg-red-600 px-3 py-1 text-xs font-black">
        LIVE
      </div>

      <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 rounded-full bg-black/60 px-3 py-1 text-xs font-bold">
        {activeIndex + 1}/{streams.length}
      </div>

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+2rem)] left-4 right-20 z-20">
        <button onClick={openProfile} className="mb-3 flex items-center gap-3 text-left">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-700">
            {activeStream.profile?.avatar_url ? (
              <img
                src={activeStream.profile.avatar_url}
                alt={hostName}
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black">
              {hostName} {activeStream.profile?.is_verified ? "✓" : ""}
            </p>
            <p className="truncate text-xs text-white/70">
              @{activeStream.profile?.username || "creator"}
            </p>
          </div>
        </button>

        <h1 className="line-clamp-2 text-xl font-black">{activeStream.title}</h1>
        <p className="mt-1 text-sm text-white/70">
          {activeStream.category} • 👀 {activeStream.viewers || 0}
        </p>

        <p className="mt-2 text-xs text-white/60">{status}</p>
      </div>

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+2.2rem)] right-4 z-20 flex flex-col items-center gap-4">
        <button
          onClick={toggleLike}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-2xl"
        >
          ❤️
        </button>
        <p className="-mt-3 text-xs font-bold">{likes}</p>

        <button
          onClick={openFullRoom}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl"
        >
          💬
        </button>

        <button
          onClick={goPrevious}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl"
        >
          ↑
        </button>

        <button
          onClick={goNext}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl"
        >
          ↓
        </button>
      </div>
    </main>
  );
}
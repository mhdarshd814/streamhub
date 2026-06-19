"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
} from "livekit-client";
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

type ChatMessage = {
  id: string;
  username: string;
  message: string;
  created_at: string;
};

export default function LiveFeedPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading live feed...");
  const [connected, setConnected] = useState(false);
  const [readyToShowLive, setReadyToShowLive] = useState(false);
  const [likes, setLikes] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [chatPreview, setChatPreview] = useState<ChatMessage[]>([]);
  const [showHeart, setShowHeart] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const touchStartYRef = useRef<number | null>(null);
  const streamEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noVideoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const lastTapRef = useRef<number>(0);
  const chatChannelRef = useRef<any>(null);
  const videoAttachedRef = useRef(false);

  const activeStream = useMemo(
    () => streams[activeIndex] || null,
    [streams, activeIndex]
  );

  useEffect(() => {
    checkAuthAndStartFeed();

    return () => {
      clearLiveRefreshInterval();
      clearStreamEndTimer();
      clearHeartTimer();
      clearNoVideoTimer();
      cleanupChatChannel();
      cleanupRoom();
      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !activeStream) return;

    clearStreamEndTimer();
    clearHeartTimer();
    clearNoVideoTimer();
    cleanupChatChannel();

    videoAttachedRef.current = false;
    setReadyToShowLive(false);
    setStreamEnded(false);
    setConnected(false);
    setLikes(Number(activeStream.likes || 0));
    setChatPreview([]);

    connectToStream(activeStream);
    loadChatPreview(activeStream.id);
    subscribeToChatPreview(activeStream.id);

    return () => {
      cleanupRoom();
      cleanupChatChannel();
      clearNoVideoTimer();
    };
  }, [authChecked, activeStream?.id]);

  async function checkAuthAndStartFeed() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user || !session.access_token) {
      window.location.replace("/login");
      return;
    }

    setCurrentUserId(session.user.id);
    setAuthChecked(true);

    await loadLiveStreams(true);

    clearLiveRefreshInterval();
    liveRefreshIntervalRef.current = setInterval(() => {
      loadLiveStreams(false);
    }, 30000);
  }

  function clearLiveRefreshInterval() {
    if (liveRefreshIntervalRef.current) {
      clearInterval(liveRefreshIntervalRef.current);
      liveRefreshIntervalRef.current = null;
    }
  }

  function clearStreamEndTimer() {
    if (streamEndTimerRef.current) {
      clearTimeout(streamEndTimerRef.current);
      streamEndTimerRef.current = null;
    }
  }

  function clearHeartTimer() {
    if (heartTimerRef.current) {
      clearTimeout(heartTimerRef.current);
      heartTimerRef.current = null;
    }
  }

  function clearNoVideoTimer() {
    if (noVideoTimerRef.current) {
      clearTimeout(noVideoTimerRef.current);
      noVideoTimerRef.current = null;
    }
  }

  function cleanupChatChannel() {
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }
  }

  async function loadLiveStreams(showLoader = true) {
    if (showLoader) setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user || null;

    if (!user || !session?.access_token) {
      window.location.replace("/login");
      return;
    }

    setCurrentUserId(user.id);

    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    setFollowingIds((follows || []).map((item: any) => item.following_id));

    const { data, error } = await supabase
      .from("streams")
      .select("*")
      .eq("status", "live")
      .neq("visibility", "private")
      .order("created_at", { ascending: false });

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
    setActiveIndex((current) => {
      if (withProfiles.length === 0) return 0;
      if (current >= withProfiles.length) return 0;
      return current;
    });

    setLoading(false);

    if (withProfiles.length === 0) {
      setStatus("No live streams right now.");
    }
  }

  async function loadChatPreview(streamId: string) {
    const { data } = await supabase
      .from("stream_chat")
      .select("id, username, message, created_at")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(4);

    setChatPreview(((data || []) as ChatMessage[]).reverse());
  }

  function subscribeToChatPreview(streamId: string) {
    chatChannelRef.current = supabase
      .channel(`live-feed-chat-${streamId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_chat",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;

          setChatPreview((current) => {
            const exists = current.some((item) => item.id === message.id);
            if (exists) return current;
            return [...current, message].slice(-4);
          });
        }
      )
      .subscribe();
  }

  function cleanupRoom() {
    clearNoVideoTimer();

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
    setReadyToShowLive(false);

    if (videoRef.current) {
      videoRef.current.innerHTML = "";
    }
  }

  function removeUnavailableStream(streamId: string) {
    cleanupRoom();
    cleanupChatChannel();

    setStreams((currentStreams) => {
      const remaining = currentStreams.filter((item) => item.id !== streamId);

      setActiveIndex((current) => {
        if (remaining.length === 0) return 0;
        if (current >= remaining.length) return 0;
        return current;
      });

      if (remaining.length === 0) {
        setStatus("No live streams right now.");
      } else {
        setStatus("Opening next real live stream...");
      }

      return remaining;
    });
  }

  async function handleStreamEnded() {
    if (streamEnded) return;

    setStreamEnded(true);
    setConnected(false);
    setReadyToShowLive(false);
    setStatus("Stream ended. Moving to next live...");

    await loadLiveStreams(false);

    streamEndTimerRef.current = setTimeout(() => {
      if (activeStream?.id) {
        removeUnavailableStream(activeStream.id);
      }
    }, 1500);
  }

  async function connectToStream(stream: Stream) {
    cleanupRoom();
    setStatus("Checking live video...");
    videoAttachedRef.current = false;
    setReadyToShowLive(false);

    noVideoTimerRef.current = setTimeout(() => {
      if (!videoAttachedRef.current) {
        setStatus("This stream has no active camera. Looking for another live...");
        removeUnavailableStream(stream.id);
      }
    }, 8000);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user || null;

    if (!user || !session?.access_token) {
      window.location.replace("/login");
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
      removeUnavailableStream(stream.id);
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

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication) => {
        try {
          publication.setVideoQuality?.(2);
        } catch {}

        attachTrack(track);
      }
    );

    room.on(RoomEvent.Disconnected, () => {
      handleStreamEnded();
    });

    try {
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

      setStatus("Waiting for creator camera...");
      await KeepAwake.keepAwake().catch(() => {});
    } catch {
      setStatus("Unable to connect. Looking for another stream...");
      removeUnavailableStream(stream.id);
    }
  }

  function attachTrack(track: RemoteTrack) {
    if (track.kind === Track.Kind.Video && videoRef.current) {
      videoAttachedRef.current = true;
      clearNoVideoTimer();

      const video = track.attach() as HTMLVideoElement;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.backgroundColor = "#000";

      videoRef.current.innerHTML = "";
      videoRef.current.appendChild(video);

      video
        .play()
        .then(() => {
          setConnected(true);
          setReadyToShowLive(true);
          setStatus("Live");
        })
        .catch(() => {
          setConnected(true);
          setReadyToShowLive(true);
          setStatus("Live");
        });
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
    clearStreamEndTimer();
    clearHeartTimer();
    clearNoVideoTimer();
    setShowHeart(false);
    setStreamEnded(false);
    setReadyToShowLive(false);

    if (streams.length <= 1) return;

    setActiveIndex((current) =>
      current + 1 >= streams.length ? 0 : current + 1
    );
  }

  function goPrevious() {
    clearStreamEndTimer();
    clearHeartTimer();
    clearNoVideoTimer();
    setShowHeart(false);
    setStreamEnded(false);
    setReadyToShowLive(false);

    if (streams.length <= 1) return;

    setActiveIndex((current) =>
      current - 1 < 0 ? streams.length - 1 : current - 1
    );
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

  function handleVideoTap() {
    const now = Date.now();

    if (now - lastTapRef.current < 280) {
      toggleLike(true);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
  }

  async function toggleLike(fromDoubleTap = false) {
    if (!activeStream || streamEnded || !readyToShowLive) return;

    const { error, data } = await supabase.rpc("toggle_stream_like", {
      stream_id_input: activeStream.id,
    });

    if (error) {
      if (!fromDoubleTap) alert(error.message);
      return;
    }

    setLikes(Number(data || likes + 1));

    if (fromDoubleTap) {
      setShowHeart(true);
      clearHeartTimer();
      heartTimerRef.current = setTimeout(() => setShowHeart(false), 650);
    }
  }

  async function toggleFollow() {
    if (!activeStream || !currentUserId) {
      window.location.replace("/login");
      return;
    }

    if (activeStream.user_id === currentUserId) return;

    setFollowLoading(true);

    const isFollowing = followingIds.includes(activeStream.user_id);

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", activeStream.user_id);

      setFollowLoading(false);

      if (error) {
        alert(error.message);
        return;
      }

      setFollowingIds((current) =>
        current.filter((id) => id !== activeStream.user_id)
      );

      return;
    }

    const { error } = await supabase.from("follows").insert([
      {
        follower_id: currentUserId,
        following_id: activeStream.user_id,
      },
    ]);

    setFollowLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setFollowingIds((current) => [...current, activeStream.user_id]);
  }

  function openFullRoom() {
    if (!activeStream || streamEnded || !readyToShowLive) return;
    window.location.href = `/watch/${activeStream.id}`;
  }

  function openProfile() {
    if (!activeStream?.user_id) return;
    window.location.href = `/profile/${activeStream.user_id}`;
  }

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl shadow-2xl shadow-red-600/30">
            <img
              src="/icon-512.png"
              alt="StreamHub"
              className="h-full w-full object-cover"
            />
          </div>

          <h1 className="text-4xl font-black tracking-tight">
            <span className="text-white">Stream</span>
            <span className="text-red-500">Hub</span>
          </h1>

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-gray-500">
            Checking Session
          </p>

          <div className="mx-auto mt-6 h-1.5 w-36 overflow-hidden rounded-full bg-gray-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-red-600" />
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">📺</div>
          <p className="text-gray-400">Loading live feed...</p>
        </div>
      </main>
    );
  }

  if (!activeStream) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-red-600/10 text-6xl">
            🎥
          </div>

          <h1 className="text-3xl font-black">No One Is Live</h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            There are no active live streams right now. Start your own live or
            discover creators to follow.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              onClick={() => (window.location.href = "/go-live")}
              className="rounded-full bg-red-600 px-6 py-4 text-lg font-black shadow-lg shadow-red-600/20 active:scale-95"
            >
              Go Live
            </button>

            <button
              onClick={() => (window.location.href = "/explore")}
              className="rounded-full border border-gray-700 bg-gray-900 px-6 py-4 font-bold text-gray-200 active:scale-95"
            >
              Discover Creators
            </button>

            <button
              onClick={() => loadLiveStreams(true)}
              className="rounded-full px-6 py-3 text-sm font-bold text-gray-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!readyToShowLive) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-red-600/10 text-6xl">
            📡
          </div>

          <h1 className="text-2xl font-black">Finding Real Live Streams</h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            {status || "Checking whether the creator camera is actually live..."}
          </p>

          <button
            onClick={() => loadLiveStreams(true)}
            className="mt-7 rounded-full border border-gray-700 bg-gray-900 px-6 py-4 font-bold text-gray-200 active:scale-95"
          >
            Refresh
          </button>
        </div>
      </main>
    );
  }

  const hostName =
    activeStream.profile?.display_name ||
    activeStream.profile?.username ||
    "Creator";

  const isFollowingActiveHost = followingIds.includes(activeStream.user_id);
  const showFollowButton =
    !!currentUserId && currentUserId !== activeStream.user_id;

  return (
    <main
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleVideoTap}
      className="relative h-screen w-full overflow-hidden bg-black text-white"
    >
      <div ref={videoRef} className="absolute inset-0 bg-black" />

      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="animate-ping text-8xl">❤️</div>
        </div>
      )}

      {streamEnded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-6 text-center">
          <div>
            <div className="mb-4 text-6xl">📴</div>
            <h2 className="text-3xl font-black">Stream Ended</h2>
            <p className="mt-3 text-sm text-gray-300">
              Moving you to the next live stream...
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />

      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 rounded-full bg-red-600 px-3 py-1 text-xs font-black">
        LIVE
      </div>

      <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 rounded-full bg-black/60 px-3 py-1 text-xs font-bold">
        {activeIndex + 1}/{streams.length}
      </div>

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+2rem)] left-4 right-20 z-20">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={(event) => {
              event.stopPropagation();
              openProfile();
            }}
            className="flex min-w-0 items-center gap-3 text-left"
          >
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

          {showFollowButton && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleFollow();
              }}
              disabled={followLoading}
              className={
                isFollowingActiveHost
                  ? "rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-white"
                  : "rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white"
              }
            >
              {followLoading
                ? "..."
                : isFollowingActiveHost
                  ? "Following"
                  : "+ Follow"}
            </button>
          )}
        </div>

        <h1 className="line-clamp-2 text-xl font-black">
          {activeStream.title}
        </h1>

        <p className="mt-1 text-sm text-white/70">
          {activeStream.category} • 👀 {activeStream.viewers || 0}
        </p>

        {chatPreview.length > 0 && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              openFullRoom();
            }}
            className="mt-4 w-full max-w-sm space-y-1 rounded-2xl bg-black/35 p-3 text-left backdrop-blur"
          >
            {chatPreview.map((msg) => (
              <p key={msg.id} className="line-clamp-1 text-xs text-white/85">
                <span className="font-black text-red-300">
                  {msg.username}:{" "}
                </span>
                {msg.message}
              </p>
            ))}

            <p className="pt-1 text-[11px] font-bold text-white/45">
              Tap chat to join conversation
            </p>
          </button>
        )}

        <p className="mt-3 text-xs text-white/55">{status}</p>
      </div>

      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] right-4 z-20 flex flex-col items-center gap-4">
        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleLike();
          }}
          disabled={streamEnded}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-2xl disabled:opacity-40"
        >
          ❤️
        </button>

        <p className="-mt-3 text-xs font-bold">{likes}</p>

        <button
          onClick={(event) => {
            event.stopPropagation();
            openFullRoom();
          }}
          disabled={streamEnded}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl disabled:opacity-40"
        >
          💬
        </button>
      </div>
    </main>
  );
}
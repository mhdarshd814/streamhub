"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "../../../../lib/supabase";

type Stream = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers" | null;
  viewers?: number | null;
  likes?: number | null;
  description?: string | null;
  created_at: string;
};

export default function AdminBroadcastStudioPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stream, setStream] = useState<Stream | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [screenOn, setScreenOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [systemAudioOn, setSystemAudioOn] = useState(true);

  const [copied, setCopied] = useState(false);
  const [statusText, setStatusText] = useState("Loading broadcast studio...");

  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    loadStudio();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [streamId]);

  async function loadStudio() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      alert(profileError.message);
      router.push("/admin");
      return;
    }

    if (profile?.is_banned) {
      router.push("/banned");
      return;
    }

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data: streamData, error: streamError } = await supabase
      .from("streams")
      .select("*")
      .eq("id", streamId)
      .maybeSingle();

    if (streamError || !streamData) {
      alert(streamError?.message || "Broadcast stream not found.");
      router.push("/admin/broadcast");
      return;
    }

    if (streamData.user_id !== user.id) {
      alert("This broadcast belongs to another account.");
      router.push("/admin/broadcast");
      return;
    }

    setStream(streamData as Stream);
    setStatusText(
      streamData.status === "live"
        ? "Broadcast is live."
        : "Broadcast is ready.",
    );
    setLoading(false);
  }

  async function connectRoom() {
    if (!stream || connecting || roomRef.current) return;

    setConnecting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const tokenResponse = await fetch("/api/livekit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          roomName: stream.id,
          streamId: stream.id,
          participantName: "admin-broadcast-host",
          mode: "studio",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        alert(tokenData.error || "Failed to get LiveKit token.");
        return;
      }

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!livekitUrl) {
        alert("NEXT_PUBLIC_LIVEKIT_URL is missing.");
        return;
      }

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      newRoom.on(RoomEvent.LocalTrackPublished, () => {
        setTimeout(() => attachLocalTracks(newRoom), 150);
      });

      newRoom.on(RoomEvent.LocalTrackUnpublished, () => {
        setTimeout(() => attachLocalTracks(newRoom), 150);
      });

      await newRoom.connect(livekitUrl, tokenData.token);

      roomRef.current = newRoom;
      setRoom(newRoom);
      setStatusText("Connected. Start screen share to begin broadcasting.");

      await startScreenShare(newRoom);
      await updateBroadcastStatus("live");
    } catch (error: any) {
      console.error("Admin broadcast connect error:", error);
      alert(error?.message || "Failed to connect broadcast studio.");
    } finally {
      setConnecting(false);
    }
  }

  async function startScreenShare(targetRoom?: Room, audioEnabled?: boolean) {
    const activeRoom = targetRoom || roomRef.current;
    if (!activeRoom) return;

    try {
      await activeRoom.localParticipant.setScreenShareEnabled(true, {
        audio: systemAudioOn,
      } as any);

      setScreenOn(true);
      setStatusText(
        systemAudioOn
          ? "Screen sharing is live with system audio enabled. Viewers can watch from the public watch page."
          : "Screen sharing is live without system audio. Viewers can watch from the public watch page.",
      );

      setTimeout(() => attachLocalTracks(activeRoom), 300);
    } catch (error: any) {
      console.error("Screen share error:", error);
      alert("Screen share was cancelled or blocked by the browser.");
    }
  }

  async function stopScreenShare() {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    await activeRoom.localParticipant.setScreenShareEnabled(false);
    setScreenOn(false);

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    setStatusText("Screen share stopped.");
  }

  async function toggleCamera() {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    const next = !cameraOn;
    await activeRoom.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
    setTimeout(() => attachLocalTracks(activeRoom), 250);
  }

  async function toggleMic() {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    const next = !micOn;
    await activeRoom.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  async function toggleSystemAudio() {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    const next = !systemAudioOn;
    setSystemAudioOn(next);

    if (!screenOn) {
      setStatusText(
        next
          ? "System audio will be included when screen share starts."
          : "System audio will be muted when screen share starts.",
      );
      return;
    }

    try {
      setStatusText("Restarting screen share to update system audio...");

      await activeRoom.localParticipant.setScreenShareEnabled(false);
      setScreenOn(false);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }

      setTimeout(async () => {
        try {
          await activeRoom.localParticipant.setScreenShareEnabled(true, {
            audio: next,
          } as any);

          setScreenOn(true);
          setStatusText(
            next
              ? "System audio enabled. Make sure you selected Share audio in the browser prompt."
              : "System audio muted. Screen video remains live.",
          );

          setTimeout(() => attachLocalTracks(activeRoom), 300);
        } catch (error) {
          console.error("Restart screen share audio error:", error);
          alert(
            "Screen share needs to be selected again. Please start screen share and choose whether to share audio.",
          );
        }
      }, 300);
    } catch (error) {
      console.error("Toggle system audio error:", error);
      alert("Could not update system audio.");
    }
  }

  function attachLocalTracks(targetRoom: Room) {
    const publications = Array.from(
      ((targetRoom.localParticipant as any).trackPublications?.values?.() || []) as any[],
    );

    publications.forEach((publication: any) => {
      const track = publication.track;
      if (!track) return;

      const source = publication.source || track.source;

      try {
        if (
          track.kind === Track.Kind.Video &&
          source === Track.Source.ScreenShare &&
          screenVideoRef.current
        ) {
          track.attach(screenVideoRef.current);
        }

        if (
          track.kind === Track.Kind.Video &&
          source === Track.Source.Camera &&
          cameraVideoRef.current
        ) {
          track.attach(cameraVideoRef.current);
        }

        if (
          track.kind === Track.Kind.Audio &&
          source === Track.Source.ScreenShareAudio
        ) {
          publication.setMuted(false);
        }
      } catch (error) {
        console.error("Attach local broadcast track error:", error);
      }
    });
  }

  async function updateBroadcastStatus(status: "live" | "offline") {
    if (!stream) return;

    const { error } = await supabase
      .from("streams")
      .update(status === "offline" ? { status, viewers: 0 } : { status })
      .eq("id", stream.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (status === "offline") {
      await supabase.from("stream_viewers").delete().eq("stream_id", stream.id);
      await supabase.from("stream_chat").delete().eq("stream_id", stream.id);
    }

    setStream({
      ...stream,
      status,
      viewers: status === "offline" ? 0 : stream.viewers,
    });
  }

  async function endBroadcast() {
    await stopScreenShare().catch(() => {});

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setRoom(null);
    setScreenOn(false);
    setCameraOn(false);
    setMicOn(false);

    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;

    await updateBroadcastStatus("offline");
    setStatusText("Broadcast ended.");
  }

  async function copyWatchLink() {
    if (!stream) return;

    await navigator.clipboard.writeText(
      `${window.location.origin}/watch/${stream.id}`,
    );

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading broadcast studio...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">
            Your account does not have admin permission.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  if (!stream) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Broadcast not found.</p>
      </main>
    );
  }

  const isLive = stream.status === "live";

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Broadcast Studio
            </p>
            <h1 className="break-words text-4xl font-black sm:text-5xl">
              {stream.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              {stream.category} â€¢ {isLive ? "Live" : "Offline"} â€¢ Public admin
              broadcast
            </p>
            <p className="mt-2 text-sm text-gray-500">{statusText}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <button
              onClick={copyWatchLink}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              {copied ? "Copied" : "Copy Watch Link"}
            </button>
            <Link
              href="/admin/broadcast"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Broadcasts
            </Link>
            <Link
              href={`/watch/${stream.id}`}
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Watch Page
            </Link>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatusCard
            label="Status"
            value={isLive ? "LIVE" : "OFFLINE"}
            color={isLive ? "text-red-400" : "text-gray-400"}
          />
          <StatusCard
            label="Screen Share"
            value={screenOn ? "On" : "Off"}
            color={screenOn ? "text-green-400" : "text-gray-400"}
          />
          <StatusCard
            label="Camera"
            value={cameraOn ? "On" : "Off"}
            color={cameraOn ? "text-green-400" : "text-gray-400"}
          />
          <StatusCard
            label="Microphone"
            value={micOn ? "On" : "Muted"}
            color={micOn ? "text-green-400" : "text-gray-400"}
          />
          <StatusCard
            label="System Audio"
            value={systemAudioOn ? "On" : "Muted"}
            color={systemAudioOn ? "text-green-400" : "text-gray-400"}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-red-900/40 bg-gray-950 shadow-2xl shadow-red-950/30">
              <div className="border-b border-gray-800 p-5">
                <h2 className="text-2xl font-black">
                  Screen Broadcast Preview
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Share your full screen, browser tab, presentation, dashboard,
                  or any other app window. To include system sound, enable
                  system audio and select Share audio in the browser prompt.
                </p>
              </div>

              <div className="relative flex h-[360px] items-center justify-center bg-black sm:h-[520px] lg:h-[620px]">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-contain"
                />

                {!screenOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-5 text-center">
                    <div>
                      <div className="mb-4 text-6xl">ðŸ“¡</div>
                      <h2 className="mb-3 text-3xl font-black">
                        Ready to Share Screen?
                      </h2>
                      <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-gray-400">
                        Click Start Broadcast, then choose the screen, app, or
                        browser tab you want to stream. If you need system
                        sound, choose a tab/screen option that supports audio
                        and tick Share audio.
                      </p>
                      <button
                        onClick={connectRoom}
                        disabled={connecting}
                        className="rounded-xl bg-red-600 px-7 py-4 font-black hover:bg-red-700 disabled:bg-gray-700"
                      >
                        {connecting ? "Starting..." : "Start Broadcast"}
                      </button>
                    </div>
                  </div>
                )}

                {cameraOn && (
                  <div className="absolute bottom-4 right-4 h-32 w-44 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl sm:h-40 sm:w-56">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-xs font-bold">
                      Admin Camera
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
              <h2 className="mb-5 text-2xl font-black">Broadcast Controls</h2>

              <div className="grid gap-3">
                {!room ? (
                  <button
                    onClick={connectRoom}
                    disabled={connecting}
                    className="rounded-xl bg-red-600 px-5 py-4 font-black hover:bg-red-700 disabled:bg-gray-700"
                  >
                    {connecting ? "Starting..." : "Start Broadcast"}
                  </button>
                ) : (
                  <button
                    onClick={endBroadcast}
                    className="rounded-xl bg-red-600 px-5 py-4 font-black hover:bg-red-700"
                  >
                    End Broadcast
                  </button>
                )}

                <button
                  onClick={() => startScreenShare()}
                  disabled={!room || screenOn}
                  className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  Start Screen Share
                </button>

                <button
                  onClick={stopScreenShare}
                  disabled={!room || !screenOn}
                  className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  Stop Screen Share
                </button>

                <button
                  onClick={toggleCamera}
                  disabled={!room}
                  className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  {cameraOn ? "Turn Camera Off" : "Turn Camera On"}
                </button>

                <button
                  onClick={toggleMic}
                  disabled={!room}
                  className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  {micOn ? "Mute Mic" : "Unmute Mic"}
                </button>

                <button
                  onClick={toggleSystemAudio}
                  disabled={!room}
                  className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  {systemAudioOn
                    ? "Mute System Audio"
                    : "Unmute System Audio"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 sm:p-6">
              <h2 className="mb-3 text-xl font-black text-yellow-300">
                Important
              </h2>
              <p className="text-sm leading-6 text-gray-300">
                System audio depends on the browser. On Chrome or Edge desktop,
                choose a browser tab or supported screen option and tick Share
                audio. StreamHub cannot force system audio if the browser does
                not provide it.
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 sm:p-6">
              <h2 className="mb-3 text-xl font-black text-red-300">
                Copyright Warning
              </h2>
              <p className="text-sm leading-6 text-gray-300">
                Do not rebroadcast copyrighted video or audio from YouTube,
                Netflix, sports channels, paid apps, or music platforms unless
                you own the rights. Screen and system audio sharing can create
                serious copyright risk.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-2xl font-black sm:text-3xl ${color}`}>{value}</h2>
    </div>
  );
}
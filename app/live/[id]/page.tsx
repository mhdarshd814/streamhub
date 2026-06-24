"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "../../../lib/supabase";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { startAttendanceSession, endAttendanceSession } from "../../../lib/attendance";

type Stream = {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers";
  viewers: number;
  likes: number;
  user_id: string;
  private_call_price?: number | null;
  description?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
};

type ChatMessage = {
  id: string;
  stream_id: string;
  user_id: string | null;
  username: string;
  message: string;
  created_at: string;
  paid_amount?: number | null;
  is_paid?: boolean | null;
  message_type?: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_banned?: boolean | null;
};

type StreamGuest = {
  id: string;
  stream_id: string;
  host_id: string;
  guest_id: string;
  status: "pending" | "accepted" | "declined" | "removed";
  created_at: string;
  profiles?: Profile | null;
};

type PrivateCallRequest = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string | null;
  status: "pending" | "accepted" | "declined" | "missed";
  ring_status?: "ringing" | "answered" | "declined" | "expired" | null;
  expires_at?: string | null;
  created_at: string;
};


type StreamJoinRequest = {
  id: string;
  stream_id: string;
  requester_id: string;
  host_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at?: string | null;
  profiles?: Profile | null;
};

type RemoteVideoTrack = {
  id: string;
  identity: string;
  track: any;
};

export default function LiveRoomPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [stream, setStream] = useState<Stream | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [statusText, setStatusText] = useState("Loading studio...");
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"host" | "guest" | "blocked" | "loading">("loading");
  const [pendingInvite, setPendingInvite] = useState<StreamGuest | null>(null);

  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [isShadowBanned, setIsShadowBanned] = useState(false);

  const [guestInput, setGuestInput] = useState("");
  const [guestInvites, setGuestInvites] = useState<StreamGuest[]>([]);
  const [joinRequests, setJoinRequests] = useState<StreamJoinRequest[]>([]);
  const [joinRequestUpdatingId, setJoinRequestUpdatingId] = useState<string | null>(null);
  const [creatorResults, setCreatorResults] = useState<Profile[]>([]);
  const [creatorSearching, setCreatorSearching] = useState(false);
  const [inviteSendingId, setInviteSendingId] = useState<string | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideoTrack[]>([]);
  const [focusedVideo, setFocusedVideo] = useState<"local" | string>("local");
  const [isCompactStudio, setIsCompactStudio] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [usingFrontCamera, setUsingFrontCamera] = useState(true);
  const [busyCallerName, setBusyCallerName] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const theaterLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const remoteAudioElementsRef = useRef<HTMLAudioElement[]>([]);
  const guestAutoJoinStartedRef = useRef(false);
  const attendanceSessionIdRef = useRef<string | null>(null);

  async function getSafeDisplayName(user: any, fallback = "Viewer") {
    if (!user?.id) return fallback;

    const { data } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    return (
      data?.display_name?.trim?.() ||
      data?.username?.trim?.() ||
      user.user_metadata?.display_name ||
      user.user_metadata?.username ||
      fallback
    );
  }

  const MAX_ACCEPTED_GUESTS = 3;
  const MAX_TOTAL_PARTICIPANTS = 4;

  function getVisibleRemoteVideos() {
    return remoteVideos.slice(0, MAX_ACCEPTED_GUESTS);
  }

  function getAcceptedGuestCount() {
    return guestInvites.filter((invite) => invite.status === "accepted").length;
  }

  function getPendingOrAcceptedGuestCount() {
    return guestInvites.filter(
      (invite) => invite.status === "pending" || invite.status === "accepted",
    ).length;
  }

  function getFocusedRemoteVideo() {
    if (focusedVideo === "grid" || focusedVideo === "local") return null;

    return (
      remoteVideos.find((item) => item.id === focusedVideo) ||
      remoteVideos[0] ||
      null
    );
  }

  function getGridClass(totalParticipants: number) {
    if (totalParticipants <= 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-1 sm:grid-cols-2";
    return "grid-cols-2";
  }

  function getGridTileMinHeight(totalParticipants: number) {
    if (totalParticipants <= 1) return "min-h-[420px] sm:min-h-[560px]";
    if (totalParticipants === 2) return "min-h-[260px] sm:min-h-[420px]";
    return "min-h-[220px] sm:min-h-[320px]";
  }

  function getParticipantLabel(identity: string) {
    return identity.replace(/^host-/, "").replace(/^guest-/, "") || "Guest";
  }

  function getPaidMessageAmount(chat: ChatMessage) {
    if (typeof chat.paid_amount === "number" && chat.paid_amount > 0) {
      return chat.paid_amount;
    }

    const match = chat.message.match(
      /^\[PAID_MESSAGE:USD\s*(\d+(?:\.\d+)?)\]\s*/i,
    );

    if (!match) return 0;

    return Number(match[1] || 0);
  }

  function isPaidMessage(chat: ChatMessage) {
    return (
      !!chat.is_paid ||
      chat.message_type === "paid_message" ||
      getPaidMessageAmount(chat) > 0
    );
  }

  function getDisplayMessage(chat: ChatMessage) {
    return chat.message.replace(
      /^\[PAID_MESSAGE:USD\s*\d+(?:\.\d+)?\]\s*/i,
      "",
    );
  }

  function isMobileDevice() {
    if (typeof navigator === "undefined") return false;

    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function getVideoQualityProfile(facingMode: "user" | "environment" = "user") {
    const mobile = isMobileDevice();
    const privateCall = stream?.visibility === "private";

    if (privateCall && mobile) {
      return {
        facingMode,
        resolution: {
          width: 640,
          height: 360,
          frameRate: 24,
        },
        frameRate: 24,
      };
    }

    return {
      facingMode,
      resolution: {
        width: mobile ? 960 : 1920,
        height: mobile ? 540 : 1080,
        frameRate: mobile ? 24 : 30,
      },
      frameRate: mobile ? 24 : 30,
    };
  }

  function getFallbackVideoProfiles(
    facingMode: "user" | "environment" = "user",
  ) {
    const mobile = isMobileDevice();
    const privateCall = stream?.visibility === "private";

    if (privateCall && mobile) {
      return [
        getVideoQualityProfile(facingMode),
        getMediaVideoConstraints(facingMode),
        {
          facingMode,
          resolution: {
            width: 480,
            height: 270,
            frameRate: 20,
          },
          frameRate: 20,
        },
        { facingMode },
        true,
      ];
    }

    return [
      getVideoQualityProfile(facingMode),
      {
        facingMode,
        resolution: {
          width: mobile ? 960 : 1280,
          height: mobile ? 540 : 720,
          frameRate: mobile ? 24 : 30,
        },
        frameRate: mobile ? 24 : 30,
      },
      {
        facingMode,
        resolution: {
          width: mobile ? 640 : 1280,
          height: mobile ? 360 : 720,
          frameRate: mobile ? 20 : 30,
        },
        frameRate: mobile ? 20 : 30,
      },
      getMediaVideoConstraints(facingMode),
      { facingMode },
      true,
    ];
  }

  function getMediaVideoConstraints(
    facingMode: "user" | "environment" = "user",
  ): MediaTrackConstraints {
    const mobile = isMobileDevice();
    const privateCall = stream?.visibility === "private";

    if (privateCall && mobile) {
      return {
        facingMode,
        width: { ideal: 640, max: 640 },
        height: { ideal: 360, max: 360 },
        frameRate: { ideal: 24, max: 24 },
      };
    }

    return {
      facingMode,
      width: {
        ideal: mobile ? 960 : 1920,
        max: mobile ? 960 : 1920,
      },
      height: {
        ideal: mobile ? 540 : 1080,
        max: mobile ? 540 : 1080,
      },
      frameRate: {
        ideal: mobile ? 24 : 30,
        max: mobile ? 24 : 30,
      },
    };
  }

  function getMediaAudioConstraints(): MediaTrackConstraints {
    const mobile = isMobileDevice();
    const privateCall = stream?.visibility === "private";

    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: !privateCall,
      channelCount: 1,
      sampleRate: 48000,
      sampleSize: 16,
    };
  }

  function getOptimizedRoomOptions() {
    const mobile = isMobileDevice();
    const privateCall = stream?.visibility === "private";

    return {
      adaptiveStream: true,
      dynacast: !privateCall,
      audioCaptureDefaults: getMediaAudioConstraints(),
      videoCaptureDefaults: getMediaVideoConstraints(
        usingFrontCamera ? "user" : "environment",
      ),
      publishDefaults: {
        simulcast: !privateCall,
        videoCodec: "vp8",
        videoEncoding: {
          maxBitrate: privateCall
            ? mobile
              ? 850_000
              : 1_500_000
            : mobile
              ? 1_800_000
              : 5_000_000,
          maxFramerate: privateCall ? 24 : mobile ? 24 : 30,
        },
        screenShareEncoding: {
          maxBitrate: mobile ? 1_500_000 : 4_000_000,
          maxFramerate: 24,
        },
      },
    };
  }

  async function verifyMediaPermissions() {
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: getMediaVideoConstraints(
          usingFrontCamera ? "user" : "environment",
        ),
        audio: getMediaAudioConstraints(),
      });

      permissionStream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (optimizedError) {
      console.warn(
        "Optimized media permission request failed. Trying basic permission request.",
        optimizedError,
      );

      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        fallbackStream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (basicError) {
        console.error(
          "Basic camera/microphone permission request failed:",
          basicError,
        );
        alert(
          "Camera or microphone permission was denied. Please allow both camera and microphone access in your browser/app settings, then try again.",
        );
        return false;
      }
    }
  }

  async function enableCameraSafely(
    targetRoom: Room,
    facingMode: "user" | "environment" = "user",
  ) {
    const attempts = getFallbackVideoProfiles(facingMode);

    for (const options of attempts) {
      try {
        await targetRoom.localParticipant.setCameraEnabled(
          true,
          options as any,
        );
        setTimeout(() => attachLocalVideoTrack(targetRoom), 150);
        setTimeout(() => attachLocalVideoTrack(targetRoom), 500);
        return true;
      } catch (error) {
        console.warn("Camera enable attempt failed. Trying fallback.", error);
        try {
          await targetRoom.localParticipant.setCameraEnabled(false);
        } catch { }
      }
    }

    alert(
      "Camera could not start on this device. Please check camera permission, close other apps using the camera, then rejoin.",
    );
    return false;
  }

  async function enableMicrophoneSafely(targetRoom: Room) {
    const attempts = [getMediaAudioConstraints(), true];

    for (const options of attempts) {
      try {
        await targetRoom.localParticipant.setMicrophoneEnabled(
          true,
          options as any,
        );
        return true;
      } catch (error) {
        console.warn(
          "Microphone enable attempt failed. Trying fallback.",
          error,
        );
        try {
          await targetRoom.localParticipant.setMicrophoneEnabled(false);
        } catch { }
      }
    }

    alert(
      "Microphone could not start on this device. Please check microphone permission, then rejoin.",
    );
    return false;
  }

  async function disableCameraSafely(targetRoom: Room) {
    try {
      await targetRoom.localParticipant.setCameraEnabled(false);
    } catch (error) {
      console.warn("Camera disable failed:", error);
    }
  }

  async function disableMicrophoneSafely(targetRoom: Room) {
    try {
      await targetRoom.localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      console.warn("Microphone disable failed:", error);
    }
  }

  useEffect(() => {
    let chatChannel: any;
    let streamChannel: any;
    let guestChannel: any;
    let viewerChannel: any;
    let privateCallChannel: any;
    let joinRequestChannel: any;
    let busyCallChannel: any;
    let callExpiryTimer: ReturnType<typeof setInterval> | null = null;

    async function getRealViewerCount() {
      const { count, error } = await supabase
        .from("stream_viewers")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", streamId);

      if (!error) {
        const total = count || 0;
        setViewerCount(total);

        await supabase
          .from("streams")
          .update({ viewers: total })
          .eq("id", streamId);
      }
    }

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      await expireStalePrivateCalls();

      const { data: moderationProfile, error: moderationError } = await supabase
        .from("profiles")
        .select("is_banned, is_global_muted, is_shadow_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (moderationError) {
        alert(moderationError.message);
        router.push("/dashboard");
        return;
      }

      if (moderationProfile?.is_banned) {
        router.push("/banned");
        return;
      }

      setIsGlobalMuted(!!moderationProfile?.is_global_muted);
      setIsShadowBanned(!!moderationProfile?.is_shadow_banned);

      const { data, error } = await supabase
        .from("streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (error || !data) {
        alert(error?.message || "Stream not found.");
        router.push("/dashboard");
        return;
      }

      setStream(data);
      setIsLive(data.status === "live");
      setLikes(data.likes || 0);
      setViewerCount(data.viewers || 0);

      await getRealViewerCount();

      if (data.user_id === user.id) {
        setRole("host");
        setStatusText("Host studio ready.");
        await loadGuestInvites();
        await loadJoinRequests();
      } else {
        const { data: invite } = await supabase
          .from("stream_guests")
          .select("*")
          .eq("stream_id", streamId)
          .eq("guest_id", user.id)
          .in("status", ["pending", "accepted"])
          .maybeSingle();

        if (!invite) {
          if (data.visibility === "private") {
            const { data: acceptedCall } = await supabase
              .from("private_call_requests")
              .select("id")
              .eq("stream_id", streamId)
              .eq("receiver_id", user.id)
              .eq("status", "accepted")
              .maybeSingle();

            if (acceptedCall) {
              setRole("guest");
              setPendingInvite(null);
              setStatusText("Private call accepted. Starting room...");
            } else {
              setRole("blocked");
              setStatusText("You are not invited to join this private call.");
              return;
            }
          } else {
            setRole("blocked");
            setStatusText("You are not invited to join this stream.");
            return;
          }
        } else {
          setRole("guest");

          if (invite.status === "pending") {
            setPendingInvite(invite);
            setStatusText("You have been invited as a guest streamer.");
            return;
          }

          setStatusText("Guest studio ready.");
        }
      }

      const { data: chatData, error: chatError } = await supabase
        .from("stream_chat")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true });

      if (!chatError) setChatMessages(chatData || []);

      const channelKey = `${streamId}-${user.id}-${Date.now()}`;

      chatChannel = supabase
        .channel("live-chat-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "stream_chat",
            filter: `stream_id=eq.${streamId}`,
          },
          (payload) => {
            const newMessage = payload.new as ChatMessage;

            setChatMessages((current) => {
              const exists = current.some((item) => item.id === newMessage.id);
              if (exists) return current;
              return [...current, newMessage];
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "stream_chat",
            filter: `stream_id=eq.${streamId}`,
          },
          (payload) => {
            const deletedMessage = payload.old as { id?: string };

            if (deletedMessage?.id) {
              setChatMessages((current) =>
                current.filter((item) => item.id !== deletedMessage.id),
              );
            }
          },
        )
        .subscribe();

      streamChannel = supabase
        .channel("stream-updates-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "streams",
            filter: `id=eq.${streamId}`,
          },
          (payload) => {
            const updatedStream = payload.new as Stream;
            setLikes(updatedStream.likes || 0);
            setViewerCount(updatedStream.viewers || 0);
            setStream(updatedStream);
            setIsLive(updatedStream.status === "live");

            if (updatedStream.status !== "live") {
              setChatMessages([]);
            }
          },
        )
        .subscribe();

      viewerChannel = supabase
        .channel("studio-viewers-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stream_viewers",
            filter: `stream_id=eq.${streamId}`,
          },
          async () => {
            await getRealViewerCount();
          },
        )
        .subscribe();

      guestChannel = supabase
        .channel("stream-guests-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stream_guests",
            filter: `stream_id=eq.${streamId}`,
          },
          async () => {
            await loadGuestInvites();
          },
        )
        .subscribe();

      privateCallChannel = supabase
        .channel("studio-private-calls-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "private_call_requests",
            filter: `caller_id=eq.${user.id}`,
          },
          async (payload) => {
            const updatedCall = payload.new as PrivateCallRequest;

            if (updatedCall.stream_id !== streamId) return;

            if (updatedCall.status === "accepted") {
              setStatusText("Private call accepted. Opening room...");
              router.push(`/live/${streamId}`);
              return;
            }

            if (updatedCall.status === "declined") {
              setStatusText("Private call declined.");
              await loadGuestInvites();
              return;
            }

            if (updatedCall.status === "missed") {
              setStatusText("Private call missed. No answer.");
              await loadGuestInvites();
            }
          },
        )
        .subscribe();


      joinRequestChannel = supabase
        .channel("studio-join-requests-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stream_join_requests",
            filter: `host_id=eq.${user.id}`,
          },
          async () => {
            await loadJoinRequests();
          },
        )
        .subscribe();

      // Busy call detection — fires when someone tries to call while user is on a call
      busyCallChannel = supabase
        .channel("busy-call-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "private_call_requests",
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload) => {
            // Only intercept if currently in an active room
            if (!roomRef.current) return;

            const newCall = payload.new as PrivateCallRequest;
            if (newCall.status !== "pending") return;

            // Fetch caller name to show in the toast
            const { data: callerProfile } = await supabase
              .from("profiles")
              .select("display_name, username")
              .eq("id", newCall.caller_id)
              .maybeSingle();

            const callerName =
              callerProfile?.display_name ||
              callerProfile?.username ||
              "Someone";

            // Auto-decline with busy ring_status
            await supabase
              .from("private_call_requests")
              .update({
                status: "declined",
                ring_status: "busy",
                declined_at: new Date().toISOString(),
              })
              .eq("id", newCall.id)
              .eq("status", "pending");

            // Notify the caller that the line is busy
            await supabase.from("notifications").insert([
              {
                user_id: newCall.caller_id,
                type: "call_busy",
                title: "Line Busy",
                message: `The person you tried to call is on another call. Try again later.`,
                link: "/calls",
                is_read: false,
              },
            ]);

            // Show toast on the busy user's screen
            setBusyCallerName(callerName);
            setTimeout(() => setBusyCallerName(null), 6000);
          },
        )
        .subscribe();

      callExpiryTimer = setInterval(async () => {
        await expireStalePrivateCalls();
      }, 10000);
    }

    loadData();

    return () => {
      KeepAwake.allowSleep().catch(() => { });
      void endLiveAttendance();
      document.documentElement.classList.remove("streamhub-theater-mode");
      document.body.classList.remove("streamhub-theater-mode");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";

      if (chatChannel) supabase.removeChannel(chatChannel);
      if (streamChannel) supabase.removeChannel(streamChannel);
      if (guestChannel) supabase.removeChannel(guestChannel);
      if (viewerChannel) supabase.removeChannel(viewerChannel);
      if (privateCallChannel) supabase.removeChannel(privateCallChannel);
      if (joinRequestChannel) supabase.removeChannel(joinRequestChannel);
      if (busyCallChannel) supabase.removeChannel(busyCallChannel);
      if (callExpiryTimer) clearInterval(callExpiryTimer);

      cleanupRemoteAudio();

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [streamId, router]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (focusedVideo === "grid" || focusedVideo === "local") return;

    if (!remoteVideos.some((item) => item.id === focusedVideo)) {
      setFocusedVideo("local");
    }
  }, [focusedVideo, remoteVideos]);

  useEffect(() => {
    if (role !== "host") return;

    const timer = setTimeout(() => {
      searchCreators();
    }, 350);

    return () => clearTimeout(timer);
  }, [guestInput, role, currentUserId, guestInvites]);


  useEffect(() => {
    if (role !== "host" || !stream?.id) return;

    let cancelled = false;

    async function refreshJoinRequests() {
      if (cancelled) return;
      await loadJoinRequests();
    }

    refreshJoinRequests();

    const joinRequestPollTimer = setInterval(() => {
      refreshJoinRequests();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(joinRequestPollTimer);
    };
  }, [role, stream?.id, streamId]);

  async function expireStalePrivateCalls() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    try {
      const response = await fetch("/api/private-call/expire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.warn("Private call expiry API failed:", data?.error || response.statusText);
        return;
      }

      const data = await response.json().catch(() => null);

      if (
        data?.expired > 0 &&
        Array.isArray(data?.closedStreamIds) &&
        data.closedStreamIds.includes(streamId)
      ) {
        try {
          await KeepAwake.allowSleep();
        } catch { }

        cleanupRemoteAudio();

        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }

        setRoom(null);
        setRemoteVideos([]);
        setIsLive(false);
        setViewerCount(0);
        setStatusText("Private call missed. No answer.");

        alert("Call was not answered.");
        router.replace("/calls");
        return;
      }

      await loadGuestInvites();
    } catch (error) {
      console.warn("Private call expiry check skipped:", error);
    }
  }

  async function checkCurrentUserStillAllowed() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return false;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_banned, is_global_muted, is_shadow_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return false;
    }

    if (data?.is_banned) {
      cleanupRemoteAudio();

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      setRoom(null);
      router.push("/banned");
      return false;
    }

    setIsGlobalMuted(!!data?.is_global_muted);
    setIsShadowBanned(!!data?.is_shadow_banned);

    return true;
  }

  function attachRemoteAudio(track: any) {
    if (!track || track.kind !== Track.Kind.Audio) return;

    const audioElement = track.attach() as HTMLAudioElement;
    audioElement.autoplay = true;
    audioElement.controls = false;
    audioElement.style.display = "none";

    document.body.appendChild(audioElement);
    remoteAudioElementsRef.current.push(audioElement);

    audioElement.play().catch(() => {
      console.warn("Audio autoplay blocked. User interaction may be required.");
    });
  }

  function cleanupRemoteAudio() {
    remoteAudioElementsRef.current.forEach((audio) => {
      try {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      } catch (error) {
        console.error(error);
      }
    });

    remoteAudioElementsRef.current = [];
  }

  function addRemoteVideo(track: any, identity: string) {
    if (!track || track.kind !== Track.Kind.Video) return;

    const trackId =
      track.sid ||
      track.trackSid ||
      track.mediaStreamTrack?.id ||
      `${identity}-${track.kind}-${Date.now()}`;

    setRemoteVideos((current) => {
      const exists = current.some(
        (item) => item.id === trackId || item.track === track,
      );

      if (exists) return current;

      const nextVideos = [
        ...current,
        {
          id: trackId,
          identity: getParticipantLabel(identity),
          track,
        },
      ].slice(0, MAX_ACCEPTED_GUESTS);

      if (focusedVideo !== "local" && focusedVideo !== "grid") {
        setFocusedVideo(trackId);
      }

      return nextVideos;
    });
  }

  function removeRemoteVideo(track: any) {
    if (!track) return;

    const trackId = track.sid || track.trackSid || track.mediaStreamTrack?.id;

    setRemoteVideos((current) =>
      current.filter((item) => item.id !== trackId && item.track !== track),
    );
  }

  function syncRemoteParticipantTracks(targetRoom: Room | null) {
    if (!targetRoom) return;

    targetRoom.remoteParticipants.forEach((participant: any) => {
      participant.trackPublications.forEach((publication: any) => {
        try {
          if (
            publication?.setSubscribed &&
            publication.isSubscribed === false
          ) {
            publication.setSubscribed(true);
          }
        } catch (error) {
          console.warn("Remote subscription request skipped:", error);
        }

        const track = publication.track;

        if (!track) return;

        if (track.kind === Track.Kind.Audio) {
          attachRemoteAudio(track);
        }

        if (track.kind === Track.Kind.Video) {
          addRemoteVideo(track, participant.name || participant.identity);
        }
      });
    });
  }

  async function removeLiveKitParticipant(participantIdentity: string) {
    if (!stream) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.push("/login");
      return;
    }

    const response = await fetch("/api/livekit-remove-participant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        roomName: stream.id,
        streamId: stream.id,
        participantIdentity,
        reason: "Removed from live studio",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to remove participant from LiveKit",
      );
    }
  }

  async function loadGuestInvites() {
    const { data } = await supabase
      .from("stream_guests")
      .select(
        `
        *,
        profiles:guest_id (
          id,
          username,
          display_name,
          avatar_url,
          is_banned
        )
      `,
      )
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false });

    setGuestInvites((data || []) as StreamGuest[]);
  }

  async function loadJoinRequests() {
    if (!streamId) return;

    const { data, error } = await supabase
      .from("stream_join_requests")
      .select(
        `
        *,
        profiles:requester_id (
          id,
          username,
          display_name,
          avatar_url,
          is_banned
        )
      `,
      )
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("Join request lookup skipped:", error.message);
      return;
    }

    setJoinRequests((data || []) as StreamJoinRequest[]);
  }

  async function acceptJoinRequest(request: StreamJoinRequest) {
    if (!stream || !currentUserId || role !== "host") return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (getAcceptedGuestCount() >= MAX_ACCEPTED_GUESTS) {
      alert("Guest limit reached. Remove a guest before accepting another request.");
      return;
    }

    if (request.profiles?.is_banned) {
      alert("This user is banned and cannot be added.");
      return;
    }

    setJoinRequestUpdatingId(request.id);

    const { error: requestError } = await supabase
      .from("stream_join_requests")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      setJoinRequestUpdatingId(null);
      alert(requestError.message);
      return;
    }

    await supabase
      .from("stream_guests")
      .update({ status: "removed" })
      .eq("stream_id", stream.id)
      .eq("guest_id", request.requester_id);

    const { error: guestError } = await supabase.from("stream_guests").insert([
      {
        stream_id: stream.id,
        host_id: currentUserId,
        guest_id: request.requester_id,
        status: "accepted",
      },
    ]);

    if (guestError) {
      setJoinRequestUpdatingId(null);
      alert(guestError.message);
      await loadJoinRequests();
      await loadGuestInvites();
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: request.requester_id,
        type: "join_request_accepted",
        title: "Join Request Accepted",
        message: `You were added to "${stream.title}". Tap to join the live room.`,
        link: `/live/${stream.id}`,
        is_read: false,
      },
    ]);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      try {
        await fetch("/api/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: request.requester_id,
            title: "Join Request Accepted",
            message: `You were added to "${stream.title}". Tap to join the live room.`,
            url: `/live/${stream.id}`,
            streamId: stream.id,
            notificationType: "join_request_accepted",
          }),
        });
      } catch (pushError) {
        console.error("Join request push failed:", pushError);
      }
    }

    setJoinRequestUpdatingId(null);
    await loadJoinRequests();
    await loadGuestInvites();
  }

  async function declineJoinRequest(request: StreamJoinRequest) {
    if (!stream || !currentUserId || role !== "host") return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    setJoinRequestUpdatingId(request.id);

    const { error } = await supabase
      .from("stream_join_requests")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      setJoinRequestUpdatingId(null);
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: request.requester_id,
        type: "join_request_declined",
        title: "Join Request Declined",
        message: `Your request to join "${stream.title}" was declined.`,
        link: `/watch/${stream.id}`,
        is_read: false,
      },
    ]);

    setJoinRequestUpdatingId(null);
    await loadJoinRequests();
  }

  async function searchCreators() {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const keyword = guestInput.trim();

    if (!keyword || keyword.length < 2) {
      setCreatorResults([]);
      return;
    }

    setCreatorSearching(true);

    const safeKeyword = keyword.replace(/[,()%]/g, "");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_banned")
      .or(`username.ilike.%${safeKeyword}%,display_name.ilike.%${safeKeyword}%`)
      .limit(8);

    setCreatorSearching(false);

    if (error) {
      console.error(error.message);
      setCreatorResults([]);
      return;
    }

    const alreadyInvitedIds = guestInvites
      .filter(
        (invite) => invite.status === "pending" || invite.status === "accepted",
      )
      .map((invite) => invite.guest_id);

    const filtered = (data || []).filter(
      (profile) =>
        profile.id !== currentUserId &&
        !profile.is_banned &&
        !alreadyInvitedIds.includes(profile.id),
    );

    setCreatorResults(filtered);
  }

  async function updateStreamStatus(status: "live" | "offline") {
    if (!stream) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const wasAlreadyLive = stream.status === "live";

    const updateData =
      status === "offline" ? { status, viewers: 0 } : { status };

    const { error } = await supabase
      .from("streams")
      .update(updateData)
      .eq("id", stream.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (status === "offline") {
      await supabase.from("stream_viewers").delete().eq("stream_id", stream.id);
      await supabase.from("stream_chat").delete().eq("stream_id", stream.id);
      setViewerCount(0);
      setChatMessages([]);
      setMessage("");
    }

    if (status === "live" && !wasAlreadyLive) {
      if (stream.visibility === "private") {
        await sendPrivateCallStartedNotifications();
      } else {
        await sendStreamStartedNotifications();
      }
    }

    setStream({
      ...stream,
      status,
      viewers: status === "offline" ? 0 : stream.viewers,
    });

    setIsLive(status === "live");
  }

  async function findLinkedScheduledStreamIds() {
    if (!stream || !currentUserId) return [] as string[];

    const ids = new Set<string>();

    const directMatches = await Promise.all([
      supabase
        .from("scheduled_streams")
        .select("id")
        .eq("stream_id", stream.id),
      supabase
        .from("scheduled_streams")
        .select("id")
        .eq("live_stream_id", stream.id),
    ]);

    directMatches.forEach(({ data, error }) => {
      if (error) {
        console.warn("Scheduled stream direct lookup skipped:", error.message);
        return;
      }

      (data || []).forEach((item: any) => {
        if (item.id) ids.add(item.id);
      });
    });

    if (ids.size > 0) return Array.from(ids);

    const { data: titleMatches, error: titleMatchError } = await supabase
      .from("scheduled_streams")
      .select("id, title, status, scheduled_start")
      .eq("creator_id", currentUserId)
      .eq("title", stream.title)
      .in("status", ["scheduled", "upcoming", "live"])
      .order("scheduled_start", { ascending: false })
      .limit(3);

    if (titleMatchError) {
      console.warn(
        "Scheduled stream title lookup skipped:",
        titleMatchError.message,
      );
      return [];
    }

    (titleMatches || []).forEach((item: any) => {
      if (item.id) ids.add(item.id);
    });

    return Array.from(ids);
  }

  async function loadReminderRecipientIds(activeSubscriberIds: Set<string>) {
    const scheduledStreamIds = await findLinkedScheduledStreamIds();

    if (scheduledStreamIds.length === 0) return [] as string[];

    const { data: reminders, error } = await supabase
      .from("stream_reminders")
      .select("user_id")
      .in("scheduled_stream_id", scheduledStreamIds);

    if (error) {
      console.error("Reminder lookup error:", error.message);
      return [];
    }

    const reminderIds = new Set<string>();

    (reminders || []).forEach((item: any) => {
      if (!item.user_id || item.user_id === currentUserId) return;

      if (
        stream?.visibility === "subscribers" &&
        !activeSubscriberIds.has(item.user_id)
      ) {
        return;
      }

      reminderIds.add(item.user_id);
    });

    return Array.from(reminderIds);
  }

  async function sendPrivateCallStartedNotifications() {
    if (!stream || !currentUserId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", currentUserId)
      .maybeSingle();

    const hostName =
      hostProfile?.display_name || hostProfile?.username || "A creator";

    const { data: invites, error: inviteError } = await supabase
      .from("stream_guests")
      .select("guest_id, status")
      .eq("stream_id", stream.id)
      .in("status", ["pending", "accepted"]);

    if (inviteError) {
      console.error("Private call invite lookup error:", inviteError.message);
      return;
    }

    const recipients = Array.from(
      new Set(
        (invites || [])
          .map((invite: any) => invite.guest_id)
          .filter(
            (guestId: string | null) => guestId && guestId !== currentUserId,
          ),
      ),
    ) as string[];

    if (recipients.length === 0) {
      setStatusText(
        "Private call started. No invited guest was found to notify.",
      );
      return;
    }

    const title = "Private Call Started";
    const message = `${hostName} started your private call: "${stream.title}". Tap to join.`;
    const link = `/live/${stream.id}`;

    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "private_call_started")
      .eq("link", link);

    const alreadyNotifiedIds = new Set(
      (existingNotifications || []).map((item: any) => item.user_id),
    );

    const notifications = recipients
      .filter((userId) => !alreadyNotifiedIds.has(userId))
      .map((userId) => ({
        user_id: userId,
        type: "private_call_started",
        title,
        message,
        link,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error(
          "Private call notification error:",
          notificationError.message,
        );
      }
    }

    if (session?.access_token) {
      await Promise.all(
        recipients.map(async (userId) => {
          try {
            await fetch("/api/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                userId,
                title,
                message,
                url: link,
                streamId: stream.id,
                notificationType: "private_call_started",
              }),
            });
          } catch (error) {
            console.error("Private call push send failed:", error);
          }
        }),
      );
    }

    setStatusText(
      notifications.length > 0
        ? "Private call started. Invited guest has been notified."
        : "Private call started. Invited guest was already notified.",
    );
  }

  async function sendStreamStartedNotifications() {
    if (!stream || !currentUserId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", currentUserId)
      .maybeSingle();

    const hostName =
      hostProfile?.display_name || hostProfile?.username || "A creator";

    const [
      { data: followers },
      { data: subscribers },
      { data: invitedGuests },
    ] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", currentUserId),
      supabase
        .from("creator_subscriptions")
        .select("subscriber_id")
        .eq("creator_id", currentUserId)
        .eq("status", "active"),
      supabase
        .from("stream_guests")
        .select("guest_id, status")
        .eq("stream_id", stream.id)
        .in("status", ["pending", "accepted"]),
    ]);

    const activeSubscriberIds = new Set<string>();

    (subscribers || []).forEach((item: any) => {
      if (item.subscriber_id && item.subscriber_id !== currentUserId) {
        activeSubscriberIds.add(item.subscriber_id);
      }
    });

    const reminderRecipientIds =
      await loadReminderRecipientIds(activeSubscriberIds);

    const recipientIds = new Set<string>();

    if (stream.visibility === "subscribers") {
      activeSubscriberIds.forEach((userId) => recipientIds.add(userId));
    } else {
      (followers || []).forEach((item: any) => {
        if (item.follower_id && item.follower_id !== currentUserId) {
          recipientIds.add(item.follower_id);
        }
      });

      activeSubscriberIds.forEach((userId) => recipientIds.add(userId));
    }

    reminderRecipientIds.forEach((userId) => recipientIds.add(userId));

    (invitedGuests || []).forEach((item: any) => {
      if (item.guest_id && item.guest_id !== currentUserId) {
        recipientIds.add(item.guest_id);
      }
    });

    const recipients = Array.from(recipientIds);

    if (recipients.length === 0) return;

    const title =
      stream.visibility === "subscribers"
        ? `${hostName} started a subscriber-only stream`
        : `${hostName} is now live`;

    const message =
      stream.visibility === "subscribers"
        ? `"${stream.title}" is live for subscribers. Tap to watch.`
        : `"${stream.title}" is live now. Tap to watch.`;

    const link = `/watch/${stream.id}`;

    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "stream_started")
      .eq("link", link);

    const alreadyNotifiedIds = new Set(
      (existingNotifications || []).map((item: any) => item.user_id),
    );

    const notifications = recipients
      .filter((userId) => !alreadyNotifiedIds.has(userId))
      .map((userId) => ({
        user_id: userId,
        type: "stream_started",
        title,
        message,
        link,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Stream notification error:", notificationError.message);
      }
    }

    if (!session?.access_token) return;

    await Promise.all(
      recipients.map(async (userId) => {
        try {
          await fetch("/api/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId,
              title,
              message,
              url: link,
              streamId: stream.id,
              notificationType: "stream_started",
            }),
          });
        } catch (error) {
          console.error("Push send failed:", error);
        }
      }),
    );
  }

  async function getPrivateCallAttendanceContext(participantId: string) {
    if (!stream || stream.visibility !== "private") {
      return { callRequestId: null as string | null, participantRole: role };
    }

    const { data } = await supabase
      .from("private_call_requests")
      .select("id, caller_id, receiver_id, status")
      .eq("stream_id", streamId)
      .or(`caller_id.eq.${participantId},receiver_id.eq.${participantId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.id) {
      return {
        callRequestId: null as string | null,
        participantRole: role === "host" ? "host" : "guest",
      };
    }

    return {
      callRequestId: data.id as string,
      participantRole:
        data.caller_id === participantId
          ? ("caller" as const)
          : ("receiver" as const),
    };
  }

  async function startLiveAttendance(participantId: string | null | undefined) {
    if (!streamId || !participantId || attendanceSessionIdRef.current) return;

    const context = await getPrivateCallAttendanceContext(participantId);

    const attendanceId = await startAttendanceSession({
      streamId,
      participantId,
      participantRole: context.participantRole as any,
      callRequestId: context.callRequestId,
    });

    if (attendanceId) {
      attendanceSessionIdRef.current = attendanceId;
    }
  }

  async function endLiveAttendance() {
    const attendanceId = attendanceSessionIdRef.current;
    if (!attendanceId) return;

    attendanceSessionIdRef.current = null;
    await endAttendanceSession(attendanceId);
  }

  function attachLocalVideoTrack(targetRoom: Room | null) {
    if (!targetRoom) return;

    const videoPublication = Array.from(
      targetRoom.localParticipant.videoTrackPublications.values(),
    )[0];

    const videoTrack = videoPublication?.track;

    if (!videoTrack) return;

    [localVideoRef.current, theaterLocalVideoRef.current].forEach(
      (videoElement) => {
        if (!videoElement) return;

        try {
          videoTrack.attach(videoElement);
          videoElement.muted = true;
          videoElement.playsInline = true;
          videoElement.autoplay = true;
          videoElement.style.width = "100%";
          videoElement.style.height = "100%";
          videoElement.style.objectFit = "cover";
          videoElement.play().catch(() => { });
        } catch (error) {
          console.error("Local video attach error:", error);
        }
      },
    );
  }

  async function switchCameraView() {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const activeRoom = roomRef.current;

    if (!activeRoom) return;

    try {
      if (!cameraOn) {
        const cameraStarted = await enableCameraSafely(
          activeRoom,
          usingFrontCamera ? "user" : "environment",
        );

        setCameraOn(cameraStarted);

        if (!cameraStarted) return;
      }

      const nextFacingMode = usingFrontCamera ? "environment" : "user";

      const videoPublication = Array.from(
        activeRoom.localParticipant.videoTrackPublications.values(),
      )[0];

      const videoTrack: any = videoPublication?.track;

      if (videoTrack?.restartTrack) {
        await videoTrack.restartTrack(
          getVideoQualityProfile(
            nextFacingMode as "user" | "environment",
          ) as any,
        );

        setUsingFrontCamera(!usingFrontCamera);
        setTimeout(() => attachLocalVideoTrack(activeRoom), 250);
        return;
      }

      alert("Camera switch is not supported by this browser/device.");
    } catch (error) {
      console.error("Camera switch error:", error);

      const nextFacingMode = usingFrontCamera ? "environment" : "user";
      const recovered = await enableCameraSafely(activeRoom, nextFacingMode);

      if (recovered) {
        setUsingFrontCamera(!usingFrontCamera);
        setCameraOn(true);
        setTimeout(() => attachLocalVideoTrack(activeRoom), 250);
        return;
      }

      alert(
        "Unable to switch camera. Some desktop browsers and devices do not expose a second camera.",
      );
    }
  }

  useEffect(() => {
    if (!roomRef.current) return;

    const timer = setTimeout(() => {
      attachLocalVideoTrack(roomRef.current);
    }, 150);

    return () => clearTimeout(timer);
  }, [focusedVideo, isCompactStudio, isTheaterMode, remoteVideos.length, room]);

  function enableTheaterChromeLock() {
    document.documentElement.classList.add("streamhub-theater-mode");
    document.body.classList.add("streamhub-theater-mode");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function disableTheaterChromeLock() {
    document.documentElement.classList.remove("streamhub-theater-mode");
    document.body.classList.remove("streamhub-theater-mode");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  async function enterTheaterMode() {
    if (!roomRef.current) return;

    // Android WebView is unreliable with browser fullscreen.
    // This app-level theater lock hides global StreamHub chrome, removes layout padding,
    // and lets the fixed overlay own the full viewport.
    setIsTheaterMode(true);
    enableTheaterChromeLock();

    setTimeout(() => attachLocalVideoTrack(roomRef.current), 100);
    setTimeout(() => attachLocalVideoTrack(roomRef.current), 400);
  }

  async function exitTheaterMode() {
    setIsTheaterMode(false);
    disableTheaterChromeLock();

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Browser fullscreen exit skipped:", error);
    }

    setTimeout(() => attachLocalVideoTrack(roomRef.current), 100);
    setTimeout(() => attachLocalVideoTrack(roomRef.current), 400);
  }

  async function startLiveStream() {
    if (!stream || starting) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    try {
      setStarting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (role === "blocked") {
        alert("You are not allowed to join this stream.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const displayName = await getSafeDisplayName(user, "Streamer");
      const participantName = `${role}-${displayName}`;

      const tokenResponse = await fetch("/api/livekit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          roomName: stream.id,
          streamId: stream.id,
          participantName,
          mode: role === "host" ? "studio" : "guest",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        alert(tokenData.error || "Failed to get LiveKit token");
        return;
      }

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!livekitUrl) {
        alert("LiveKit URL is missing from .env.local");
        return;
      }

      cleanupRemoteAudio();

      const permissionAllowed = await verifyMediaPermissions();

      if (!permissionAllowed) {
        return;
      }

      const newRoom = new Room(getOptimizedRoomOptions() as any);

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("[PARTICIPANT CONNECTED]", participant.identity);

        setTimeout(() => syncRemoteParticipantTracks(newRoom), 250);
        setTimeout(() => syncRemoteParticipantTracks(newRoom), 1000);
     });

      (newRoom as any).on(
        (RoomEvent as any).TrackPublished,
        (publication: any) => {
          try {
            if (publication?.setSubscribed) publication.setSubscribed(true);
          } catch (error) {
            console.warn("Track subscription request failed:", error);
          }

          setTimeout(() => syncRemoteParticipantTracks(newRoom), 250);
        },
      );

      newRoom.on(
        RoomEvent.TrackSubscribed,
        (track, _publication, participant) => {
          console.log(
            "[TRACK SUBSCRIBED]",
             track.kind,
             participant.identity,
             participant.name
    );

     if (track.kind === Track.Kind.Audio) {
      attachRemoteAudio(track);
     }

      if (track.kind === Track.Kind.Video) {
         console.log("[REMOTE VIDEO ADDED]", participant.identity);
         addRemoteVideo(track, participant.name || participant.identity);
     }
     },
     );
         

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        try {
          if (track.kind === Track.Kind.Video) {
            removeRemoteVideo(track);
          }

          track.detach().forEach((element) => element.remove());
        } catch (error) {
          console.error(error);
        }
      });

      newRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log("Local track published:", publication.kind);
      });

      (newRoom as any).on((RoomEvent as any).Reconnecting, () => {
        setStatusText("Connection unstable. Reconnecting...");
      });

      (newRoom as any).on((RoomEvent as any).Reconnected, () => {
        setStatusText(
          role === "host"
            ? "You are live as host."
            : "You reconnected as guest streamer.",
        );
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        void endLiveAttendance();
        setStatusText("Disconnected from LiveKit room. Tap Join Stream to reconnect.");
        setRoom(null);
        setRemoteVideos([]);
        guestAutoJoinStartedRef.current = false;
      });

      await newRoom.connect(livekitUrl, tokenData.token, {
        autoSubscribe: true,
      } as any);

      const cameraStarted = await enableCameraSafely(
        newRoom,
        usingFrontCamera ? "user" : "environment",
      );
      const micStarted = await enableMicrophoneSafely(newRoom);

      syncRemoteParticipantTracks(newRoom);
      setTimeout(() => syncRemoteParticipantTracks(newRoom), 700);
      setTimeout(() => syncRemoteParticipantTracks(newRoom), 1500);

      attachLocalVideoTrack(newRoom);
      setTimeout(() => attachLocalVideoTrack(newRoom), 500);

      roomRef.current = newRoom;
      setRoom(newRoom);
      setCameraOn(cameraStarted);
      setMicOn(micStarted);

      await startLiveAttendance(user.id);

      try {
        await KeepAwake.keepAwake();
      } catch (error) {
        console.warn("Keep awake failed:", error);
      }

      if (role === "host") {
        await updateStreamStatus("live");
      }

      setStatusText(
        role === "host"
          ? "You are live as host."
          : "You joined as guest streamer.",
      );
    } catch (error: any) {
      console.error("LiveKit Error:", error);
      guestAutoJoinStartedRef.current = false;
      alert(
        `LiveKit Error\n\nName: ${error?.name}\nMessage: ${error?.message}`,
      );
    } finally {
      setStarting(false);
    }
  }



  useEffect(() => {
    if (!stream?.id) return;
    if (role !== "guest") return;
    if (pendingInvite) return;
    if (roomRef.current || room || starting) return;
    if (guestAutoJoinStartedRef.current) return;

    guestAutoJoinStartedRef.current = true;
    setStatusText("Host accepted your request. Starting your camera...");

    const timer = setTimeout(() => {
      startLiveStream().catch((error) => {
        guestAutoJoinStartedRef.current = false;
        console.error("Guest auto-join failed:", error);
        setStatusText("Unable to auto-join. Tap Join Stream to try again.");
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [stream?.id, role, pendingInvite, room, starting]);

  async function stopLiveStream() {
    try {
      await KeepAwake.allowSleep();
    } catch (error) {
      console.warn("Allow sleep failed:", error);
    }

    await exitTheaterMode();
    await endLiveAttendance();

    cleanupRemoteAudio();

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setRoom(null);
    setRemoteVideos([]);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (theaterLocalVideoRef.current) {
      theaterLocalVideoRef.current.srcObject = null;
    }

    setCameraOn(false);
    setMicOn(false);

    if (role === "host") {
      await updateStreamStatus("offline");
    }

    setStatusText(role === "host" ? "Stream ended." : "Guest left stream.");
  }

  async function toggleCamera() {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (!roomRef.current) return;

    const nextCameraState = !cameraOn;

    if (nextCameraState) {
      const cameraStarted = await enableCameraSafely(
        roomRef.current,
        usingFrontCamera ? "user" : "environment",
      );
      setCameraOn(cameraStarted);
      return;
    }

    await disableCameraSafely(roomRef.current);
    setCameraOn(false);
  }

  async function toggleMic() {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (!roomRef.current) return;

    const nextMicState = !micOn;

    if (nextMicState) {
      const micStarted = await enableMicrophoneSafely(roomRef.current);
      setMicOn(micStarted);
      return;
    }

    await disableMicrophoneSafely(roomRef.current);
    setMicOn(false);
  }

  async function sendMessage() {
    if (!stream || !message.trim()) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (isGlobalMuted) {
      alert("Your account is globally muted and cannot send chat messages.");
      return;
    }

    if (!isLive || !room) {
      alert("Chat is available only while the stream is live and connected.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to send message.");
      return;
    }

    const username = await getSafeDisplayName(user, "User");

    if (isShadowBanned) {
      const fakeMessage: ChatMessage = {
        id: `shadow-${Date.now()}`,
        stream_id: stream.id,
        user_id: user.id,
        username,
        message: message.trim(),
        created_at: new Date().toISOString(),
      };

      setChatMessages((current) => [...current, fakeMessage]);
      setMessage("");
      return;
    }

    const { data, error } = await supabase
      .from("stream_chat")
      .insert([
        {
          stream_id: stream.id,
          user_id: user.id,
          username,
          message: message.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setChatMessages((current) => {
        const exists = current.some((item) => item.id === data.id);
        if (exists) return current;
        return [...current, data];
      });
    }

    setMessage("");
  }

  async function deleteChatMessage(chatId: string) {
    if (!stream || role !== "host") return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const confirmed = confirm("Delete this chat message?");
    if (!confirmed) return;

    setDeletingChatId(chatId);

    const { error } = await supabase.rpc("delete_stream_chat_message", {
      target_message_id: chatId,
    });

    setDeletingChatId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setChatMessages((current) => current.filter((item) => item.id !== chatId));
  }

  async function muteChatUser(chat: ChatMessage) {
    if (!stream || role !== "host" || !chat.user_id) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (chat.user_id === currentUserId) {
      alert("You cannot mute yourself.");
      return;
    }

    const confirmed = confirm(
      `Mute ${chat.username}? They will not be able to send chat messages in this stream.`,
    );

    if (!confirmed) return;

    setModeratingUserId(chat.user_id);

    const { error } = await supabase.rpc("mute_stream_chat_user", {
      target_stream_id: stream.id,
      target_user_id: chat.user_id,
      mute_reason: "Muted by streamer from live studio",
    });

    setModeratingUserId(null);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`${chat.username} has been muted from chat.`);
  }

  async function removeUserFromStream(chat: ChatMessage) {
    if (!stream || role !== "host" || !chat.user_id) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (chat.user_id === currentUserId) {
      alert("You cannot remove yourself.");
      return;
    }

    const confirmed = confirm(
      `Remove ${chat.username} from this stream? This will kick them from LiveKit, block them, mute them, and remove their viewer record.`,
    );

    if (!confirmed) return;

    setModeratingUserId(chat.user_id);

    try {
      await removeLiveKitParticipant(chat.user_id);
    } catch (error: any) {
      console.warn("LiveKit kick warning:", error?.message);
    }

    const { error: muteError } = await supabase.rpc("mute_stream_chat_user", {
      target_stream_id: stream.id,
      target_user_id: chat.user_id,
      mute_reason: "Removed from stream by streamer",
    });

    if (muteError) {
      setModeratingUserId(null);
      alert(muteError.message);
      return;
    }

    const { error: blockError } = await supabase.rpc("block_user", {
      target_user_id: chat.user_id,
    });

    if (blockError) {
      setModeratingUserId(null);
      alert(blockError.message);
      return;
    }

    await supabase
      .from("stream_viewers")
      .delete()
      .eq("stream_id", stream.id)
      .eq("user_id", chat.user_id);

    await supabase
      .from("stream_chat")
      .delete()
      .eq("stream_id", stream.id)
      .eq("user_id", chat.user_id);

    setChatMessages((current) =>
      current.filter((item) => item.user_id !== chat.user_id),
    );

    setModeratingUserId(null);

    alert(`${chat.username} has been removed from this stream.`);
  }

  async function copyViewerLink() {
    if (!stream) return;

    const link =
      stream.visibility === "private"
        ? `${window.location.origin}/live/${stream.id}`
        : `${window.location.origin}/watch/${stream.id}`;

    await navigator.clipboard.writeText(link);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  async function inviteCreator(profile: Profile) {
    if (!stream || !currentUserId) {
      alert("Stream not ready.");
      return;
    }

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    await expireStalePrivateCalls();

    if (profile.id === currentUserId) {
      alert("You cannot invite yourself.");
      return;
    }

    const { data: moderationProfile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", profile.id)
      .maybeSingle();

    if (moderationProfile?.is_banned) {
      alert("This user is banned and cannot be invited.");
      return;
    }

    const isPrivateCall = stream.visibility === "private";

    const alreadyInvited = guestInvites.some(
      (invite) =>
        invite.guest_id === profile.id &&
        (invite.status === "pending" || invite.status === "accepted"),
    );

    if (!isPrivateCall && alreadyInvited) {
      alert("This creator is already invited.");
      return;
    }

    if (!isPrivateCall && getPendingOrAcceptedGuestCount() >= MAX_ACCEPTED_GUESTS) {
      alert("This stream already has the maximum 3 guest slots.");
      return;
    }

    setInviteSendingId(profile.id);

    if (isPrivateCall) {
      // Private calls must NOT create a pending stream_guests row here.
      // The accepted stream_guests row is created only after the receiver accepts
      // through accept_private_call_request(). This prevents Access Denied caused
      // by stale pending/declined guest rows.
      await supabase
        .from("stream_guests")
        .delete()
        .eq("stream_id", stream.id)
        .eq("guest_id", profile.id);

      const expiresAt = new Date(Date.now() + 30000).toISOString();

      const { error: callRequestError } = await supabase
        .from("private_call_requests")
        .insert([
          {
            caller_id: currentUserId,
            receiver_id: profile.id,
            stream_id: stream.id,
            status: "pending",
            ring_status: "ringing",
            expires_at: expiresAt,
          },
        ]);

      if (callRequestError) {
        setInviteSendingId(null);
        alert(callRequestError.message);
        await loadGuestInvites();
        return;
      }
    } else {
      const { error } = await supabase
        .from("stream_guests")
        .insert([
          {
            stream_id: stream.id,
            host_id: currentUserId,
            guest_id: profile.id,
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) {
        setInviteSendingId(null);
        alert(error.message);
        return;
      }
    }

    const notificationTitle = isPrivateCall
      ? "Incoming Private Call"
      : "Guest Stream Invite";

    const notificationMessage = isPrivateCall
      ? `You have an incoming private call: "${stream.title}".`
      : `You have been invited to join "${stream.title}" as a guest streamer.`;

    const notificationLink = isPrivateCall ? "/calls" : "/invites";

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: profile.id,
          type: isPrivateCall ? "incoming_private_call" : "guest_invite",
          title: notificationTitle,
          message: notificationMessage,
          link: notificationLink,
          is_read: false,
        },
      ]);

    if (notificationError) {
      console.error("Notification error:", notificationError.message);
    }

    if (isPrivateCall) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        try {
          await fetch("/api/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userId: profile.id,
              title: notificationTitle,
              message: notificationMessage,
              url: notificationLink,
              streamId: stream.id,
              notificationType: "incoming_private_call",
            }),
          });
        } catch (pushError) {
          console.error("Incoming private call push failed:", pushError);
        }
      }

      setStatusText("Private call request sent. Waiting for answer...");
    }

    setInviteSendingId(null);
    setGuestInput("");
    setCreatorResults([]);
    await loadGuestInvites();
  }

  async function cancelOutgoingPrivateCall() {
    if (!stream || !currentUserId || stream.visibility !== "private") return;

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "cancelled",
        ring_status: "cancelled",
        declined_at: new Date().toISOString(),
      })
      .eq("stream_id", stream.id)
      .eq("caller_id", currentUserId)
      .eq("status", "pending");

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("stream_guests")
      .update({ status: "declined" })
      .eq("stream_id", stream.id)
      .eq("status", "pending");

    setStatusText("Private call cancelled.");
    router.push("/calls");
  }
  async function acceptInvite() {
    if (!pendingInvite) return;

    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const { error } = await supabase
      .from("stream_guests")
      .update({ status: "accepted" })
      .eq("id", pendingInvite.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("private_call_requests")
      .update({
        status: "accepted",
        ring_status: "answered",
        accepted_at: new Date().toISOString(),
      })
      .eq("stream_id", pendingInvite.stream_id)
      .eq("receiver_id", pendingInvite.guest_id)
      .eq("status", "pending");

    setPendingInvite(null);
    await startLiveStream();
  }

  async function declineInvite() {
    if (!pendingInvite) return;

    await supabase
      .from("stream_guests")
      .update({ status: "declined" })
      .eq("id", pendingInvite.id);

    await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        ring_status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("stream_id", pendingInvite.stream_id)
      .eq("receiver_id", pendingInvite.guest_id)
      .eq("status", "pending");

    router.push("/dashboard");
  }

  async function removeGuest(inviteId: string, guestUserId?: string) {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const confirmed = confirm(
      "Remove this guest from the stream? They will be kicked from LiveKit and will no longer be allowed to join this room.",
    );

    if (!confirmed) return;

    if (guestUserId) {
      try {
        await removeLiveKitParticipant(guestUserId);
      } catch (error: any) {
        console.warn("LiveKit guest kick warning:", error?.message);
      }
    }

    const { error } = await supabase
      .from("stream_guests")
      .update({ status: "removed" })
      .eq("id", inviteId);

    if (error) {
      alert(error.message);
      return;
    }

    if (guestUserId) {
      await supabase
        .from("stream_viewers")
        .delete()
        .eq("stream_id", streamId)
        .eq("user_id", guestUserId);
    }

    await loadGuestInvites();
  }

  if (!stream || role === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 flex justify-center text-red-500"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></svg></div>
          <p className="text-gray-400">{statusText}</p>
        </div>
      </div>
    );
  }

  if (role === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white sm:px-6">
        <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center sm:p-8">
          <div className="mb-5 flex justify-center text-red-400"><svg width="82" height="82" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M9 15c2.5 3 4.5 3 6 0" /></svg></div>
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="mb-8 text-gray-400">{statusText}</p>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 sm:w-auto"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (pendingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center sm:p-8">
          <div className="mb-5 flex justify-center text-red-400"><svg width="82" height="82" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><path d="M12 18v3" /><path d="M8 21h8" /></svg></div>
          <h1 className="mb-3 text-3xl font-black">Guest Stream Invite</h1>
          <p className="mb-8 text-gray-400">
            You have been invited to join this stream as a guest streamer.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={acceptInvite}
              className="flex-1 rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
            >
              Accept & Join
            </button>

            <button
              onClick={declineInvite}
              className="flex-1 rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPrivate = stream.visibility === "private";
  const isSubscribersOnly = stream.visibility === "subscribers";
  const canSendChat = isLive && !!room && !isGlobalMuted;
  const activeGuestInvites = guestInvites.filter(
    (invite) => invite.status === "pending" || invite.status === "accepted",
  );
  const pendingJoinRequests = joinRequests.filter(
    (request) => request.status === "pending",
  );
  const acceptedGuestCount = getAcceptedGuestCount();
  const visibleRemoteVideos = getVisibleRemoteVideos();
  const focusedRemoteVideo = getFocusedRemoteVideo();
  const participantCount = Math.min(1 + visibleRemoteVideos.length, MAX_TOTAL_PARTICIPANTS);
  const gridClass = getGridClass(participantCount);
  const gridTileMinHeight = getGridTileMinHeight(participantCount);

  const hostJoinRequestVideoOverlay =
    role === "host" && !isPrivate && pendingJoinRequests.length > 0 ? (
      <div className="pointer-events-auto absolute right-2 top-1/2 z-[80] flex w-[92px] -translate-y-1/2 flex-col gap-2 sm:right-3 sm:w-[108px]">
        <div className="rounded-full border border-white/10 bg-black/55 px-2 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white/80 shadow-xl backdrop-blur-md">
          Request
        </div>

        {pendingJoinRequests.slice(0, 4).map((request) => {
          const requesterName =
            request.profiles?.display_name ||
            request.profiles?.username ||
            "Viewer";

          const isUpdating = joinRequestUpdatingId === request.id;
          const isFull = getAcceptedGuestCount() >= MAX_ACCEPTED_GUESTS;

          return (
            <div
              key={request.id}
              className="overflow-hidden rounded-2xl border border-white/15 bg-black/65 text-white shadow-2xl backdrop-blur-md"
            >
              <div className="flex h-[78px] items-center justify-center bg-white/[0.04] px-2 pt-2 sm:h-[92px]">
                <img
                  src={request.profiles?.avatar_url || "/default-avatar.png"}
                  alt={requesterName}
                  className="h-12 w-12 rounded-full border border-white/20 object-cover sm:h-14 sm:w-14"
                />
              </div>

              <div className="px-2 pb-2 pt-1">
                <p className="truncate text-center text-[11px] font-black leading-4 text-white sm:text-xs">
                  {requesterName}
                </p>

                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => acceptJoinRequest(request)}
                    disabled={isUpdating || isFull}
                    title={isFull ? "Guest limit full" : "Add to stream"}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/15 text-lg font-black leading-none text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>

                  <button
                    onClick={() => declineJoinRequest(request)}
                    disabled={isUpdating}
                    title="Decline request"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-black leading-none text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    X
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      {/* Busy call toast — shows when someone tries to call while user is on a call */}
      {busyCallerName && (
        <div className="fixed right-4 top-4 z-[9999] flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-gray-900 p-4 shadow-2xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-300">
            📞
          </div>
          <div>
            <p className="font-black text-yellow-300">Incoming Call Attempt</p>
            <p className="text-sm text-white">
              <span className="font-bold">{busyCallerName}</span> tried to call you
            </p>
            <p className="mt-0.5 text-xs text-gray-400">They have been notified you are on another call</p>
          </div>
        </div>
      )}

      {!isTheaterMode && hostJoinRequestVideoOverlay}

      {room && isTheaterMode && (
        <div className="fixed inset-0 z-[2147483647] h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-black text-white">
          <div className="relative h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-black">
            {hostJoinRequestVideoOverlay}
            {focusedVideo === "local" ? (
              <>
                <video
                  ref={theaterLocalVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />

                {visibleRemoteVideos.length > 0 ? (
                  <div className="absolute right-3 top-[calc(112px+env(safe-area-inset-top))] z-30 flex max-h-[calc(100dvh-280px)] w-24 flex-col gap-2 overflow-y-auto sm:right-5 sm:w-36">
                    {visibleRemoteVideos.map((video, index) => (
                      <div
                        key={video.id}
                        className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/25 bg-black shadow-2xl sm:h-40 sm:w-36"
                      >
                        <RemoteVideoTile
                          track={video.track}
                          identity={video.identity || `Guest ${index + 1}`}
                          onClick={() => setFocusedVideo(video.id)}
                          className="h-full w-full"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="absolute right-3 top-[calc(112px+env(safe-area-inset-top))] z-30 flex h-28 w-24 items-center justify-center rounded-2xl border border-white/10 bg-gray-950 text-center text-xs text-gray-500 shadow-2xl sm:right-5 sm:h-40 sm:w-36">
                    Waiting
                  </div>
                )}
              </>
            ) : (
              <>
                {remoteVideos.length > 0 ? (
                  <RemoteVideoTile
                    track={
                      (
                        remoteVideos.find((item) => item.id === focusedVideo) ||
                        remoteVideos[0]
                      ).track
                    }
                    identity={
                      (
                        remoteVideos.find((item) => item.id === focusedVideo) ||
                        remoteVideos[0]
                      ).identity
                    }
                    className="h-full w-full rounded-none"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-black text-center text-gray-400">
                    <div>
                      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-black text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.25)]"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.08 5.18 2 2 0 0 1 5.06 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L9 10.64a16 16 0 0 0 4.36 4.36l1.21-1.21a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92z" /></svg></div>
                      <p>Waiting for the other person...</p>
                    </div>
                  </div>
                )}

                <div
                  onClick={() => setFocusedVideo("local")}
                  className="absolute left-3 bottom-[calc(170px+env(safe-area-inset-bottom))] z-30 h-28 w-24 overflow-hidden rounded-2xl border border-white/25 bg-black shadow-2xl sm:left-5 sm:bottom-8 sm:h-40 sm:w-36"
                >
                  <video
                    ref={theaterLocalVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />

                  <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold">
                    You
                  </div>
                </div>
              </>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-12 pt-[calc(18px+env(safe-area-inset-top))]">
              <div className="pointer-events-auto flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-red-400">
                    {role === "host" ? "Host Studio" : "Guest Studio"}
                  </p>
                  <h2 className="truncate text-lg font-black sm:text-2xl">
                    {stream.title}
                  </h2>
                </div>

                <button
                  onClick={exitTheaterMode}
                  className="shrink-0 rounded-full bg-red-600 px-5 py-3 text-sm font-black shadow-2xl backdrop-blur hover:bg-red-700"
                >
                  Exit Fullscreen
                </button>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-16">
              <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
                <button
                  onClick={toggleCamera}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  {cameraOn ? "Camera Off" : "Camera On"}
                </button>

                <button
                  onClick={toggleMic}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  {micOn ? "Mute" : "Unmute"}
                </button>

                <button
                  onClick={switchCameraView}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  Flip
                </button>

                <button
                  onClick={() =>
                    setFocusedVideo((current) =>
                      current === "local" && remoteVideos.length > 0
                        ? remoteVideos[0].id
                        : "local",
                    )
                  }
                  disabled={remoteVideos.length === 0}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20 disabled:text-gray-500"
                >
                  Switch
                </button>

                <button
                  onClick={stopLiveStream}
                  className="rounded-full bg-red-600 px-5 py-3 text-sm font-black backdrop-blur hover:bg-red-700"
                >
                  {role === "host"
                    ? isPrivate
                      ? "End Call"
                      : "End Stream"
                    : "Leave"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={isTheaterMode ? "hidden" : "min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10"}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-sm font-semibold text-red-400">
                {role === "host" ? "Host Studio" : "Guest Studio"}
              </p>

              <h1 className="mb-3 break-words text-3xl font-black sm:text-4xl lg:text-5xl">
                {stream.title}
              </h1>

              <p className="text-sm text-gray-400 sm:text-base lg:text-lg">
                {stream.category} {" | "}
                <span className={isLive ? "text-green-500" : "text-gray-500"}>
                  {isLive ? "Live Now" : "Offline"}
                </span>{" "}
                {" | "}
                <span
                  className={
                    isPrivate
                      ? "text-purple-400"
                      : isSubscribersOnly
                        ? "text-yellow-300"
                        : "text-green-400"
                  }
                >
                  {isPrivate
                    ? "Private Video Call"
                    : isSubscribersOnly
                      ? "Subscribers Only"
                      : "Public Stream"}
                </span>
              </p>

              <p className="mt-2 text-sm text-gray-500">{statusText}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <button
                onClick={copyViewerLink}
                className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm font-bold hover:border-red-600 sm:px-5"
              >
                {copied
                  ? "Copied!"
                  : isPrivate
                    ? "Copy Private Link"
                    : "Copy Watch Link"}
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-xl bg-gray-800 px-4 py-3 text-sm font-bold hover:bg-gray-700 sm:px-5"
              >
                Dashboard
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-8 lg:grid-cols-4 lg:gap-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <p className="mb-2 text-sm text-gray-400">
                {isPrivate ? "Private Viewers" : "Live Viewers"}
              </p>
              <h2 className="text-3xl font-black sm:text-4xl">{viewerCount}</h2>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <p className="mb-2 text-sm text-gray-400">Likes</p>
              <h2 className="text-3xl font-black text-red-500 sm:text-4xl">
                {isPrivate ? "Off" : likes}
              </h2>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <p className="mb-2 text-sm text-gray-400">Camera</p>
              <h2
                className={
                  cameraOn
                    ? "text-2xl font-black text-green-500 sm:text-3xl"
                    : "text-2xl font-black text-gray-500 sm:text-3xl"
                }
              >
                {cameraOn ? "On" : "Off"}
              </h2>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <p className="mb-2 text-sm text-gray-400">Microphone</p>
              <h2
                className={
                  micOn
                    ? "text-2xl font-black text-green-500 sm:text-3xl"
                    : "text-2xl font-black text-gray-500 sm:text-3xl"
                }
              >
                {micOn ? "On" : "Muted"}
              </h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="lg:col-span-2">
              <div className="sticky top-[84px] z-40 overflow-hidden rounded-2xl border border-red-900/40 bg-gray-950 shadow-2xl shadow-red-950/30 lg:static lg:z-auto">
                <div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <h2 className="text-2xl font-black">Live Preview</h2>
                    <p className="text-sm text-gray-400">
                      {isPrivate
                        ? "Private room for host and invited guest streamers only."
                        : "Host and guest streamers join the same LiveKit room."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setFocusedVideo("grid")}
                      disabled={!room}
                      className={
                        focusedVideo === "grid"
                          ? "rounded-full bg-white px-3 py-1 text-xs font-black text-black"
                          : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-300 hover:bg-gray-700 disabled:text-gray-600"
                      }
                    >
                      Grid
                    </button>

                    <button
                      onClick={() => setFocusedVideo("local")}
                      disabled={!room}
                      className={
                        focusedVideo === "local"
                          ? "rounded-full bg-white px-3 py-1 text-xs font-black text-black"
                          : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-300 hover:bg-gray-700 disabled:text-gray-600"
                      }
                    >
                      You Big
                    </button>

                    {visibleRemoteVideos.map((video, index) => (
                      <button
                        key={video.id}
                        onClick={() => setFocusedVideo(video.id)}
                        disabled={!room}
                        className={
                          focusedVideo === video.id
                            ? "rounded-full bg-white px-3 py-1 text-xs font-black text-black"
                            : "rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-300 hover:bg-gray-700 disabled:text-gray-600"
                        }
                      >
                        Guest {index + 1}
                      </button>
                    ))}

                    <button
                      onClick={() => setIsCompactStudio((current) => !current)}
                      className="rounded-full bg-gray-800 px-3 py-1 text-xs font-black text-gray-300 hover:bg-gray-700"
                    >
                      {isCompactStudio ? "Large View" : "Small View"}
                    </button>

                    <span
                      className={
                        isLive
                          ? "w-fit rounded-full bg-red-600 px-4 py-1 text-sm font-black"
                          : "w-fit rounded-full bg-gray-800 px-4 py-1 text-sm font-black text-gray-400"
                      }
                    >
                      {isLive ? "LIVE" : "OFFLINE"}
                    </span>
                  </div>
                </div>

                <div
                  className={
                    isCompactStudio
                      ? "relative flex h-[260px] items-center justify-center overflow-hidden bg-black sm:h-[360px] lg:h-[420px]"
                      : "relative flex h-[68dvh] min-h-[420px] items-center justify-center overflow-hidden bg-black sm:h-[620px] lg:h-[680px]"
                  }
                >
                  <div className="relative h-full w-full bg-black p-2 sm:p-3">
                    {focusedVideo === "grid" ? (
                      <div className={`grid h-full w-full gap-2 sm:gap-3 ${gridClass}`}>
                        <div
                          onClick={() => setFocusedVideo("local")}
                          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950 ${gridTileMinHeight}`}
                        >
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />

                          <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold">
                            You {role === "host" ? "• Host" : "• Guest"}
                          </div>
                        </div>

                        {visibleRemoteVideos.map((video, index) => (
                          <RemoteVideoTile
                            key={video.id}
                            track={video.track}
                            identity={`${video.identity || `Guest ${index + 1}`}`}
                            onClick={() => setFocusedVideo(video.id)}
                            className={`border border-white/10 ${gridTileMinHeight}`}
                          />
                        ))}

                        {visibleRemoteVideos.length === 0 && (
                          <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-gray-950 text-center text-xs text-gray-500 ${gridTileMinHeight}`}>
                            Waiting for guests
                          </div>
                        )}
                      </div>
                    ) : focusedVideo === "local" ? (
                      <>
                        <div
                          onClick={() => setFocusedVideo("local")}
                          className="relative h-full w-full overflow-hidden rounded-2xl bg-gray-950"
                        >
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />

                          <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold">
                            You {role === "host" ? "• Host" : "• Guest"}
                          </div>
                        </div>

                        {visibleRemoteVideos.length > 0 ? (
                          <div className="absolute bottom-4 right-4 flex max-w-[86vw] gap-2 overflow-x-auto rounded-3xl bg-black/20 p-1 backdrop-blur sm:max-w-none">
                            {visibleRemoteVideos.map((video, index) => (
                              <div
                                key={video.id}
                                className="h-32 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white/25 bg-black shadow-2xl sm:h-44 sm:w-36"
                              >
                                <RemoteVideoTile
                                  track={video.track}
                                  identity={video.identity || `Guest ${index + 1}`}
                                  onClick={() => setFocusedVideo(video.id)}
                                  className="h-full w-full"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="absolute bottom-4 right-4 flex h-36 w-28 items-center justify-center rounded-3xl border border-white/10 bg-gray-950 text-center text-xs text-gray-500 shadow-2xl sm:h-40 sm:w-32">
                            Waiting
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {focusedRemoteVideo ? (
                          <RemoteVideoTile
                            track={focusedRemoteVideo.track}
                            identity={focusedRemoteVideo.identity || "Guest"}
                            className="h-full w-full"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-gray-800 bg-gray-950 text-center text-gray-500">
                            <div>
                              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-black text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.22)]"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.08 5.18 2 2 0 0 1 5.06 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L9 10.64a16 16 0 0 0 4.36 4.36l1.21-1.21a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92z" /></svg></div>
                              <p className="text-sm">
                                Waiting for the other person...
                              </p>
                            </div>
                          </div>
                        )}

                        <div
                          onClick={() => setFocusedVideo("local")}
                          className="absolute bottom-4 right-4 h-36 w-28 overflow-hidden rounded-3xl border-2 border-white/25 bg-black shadow-2xl sm:h-44 sm:w-36"
                        >
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />

                          <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold">
                            You
                          </div>
                        </div>

                        {visibleRemoteVideos.filter((video) => video.id !== focusedVideo).length > 0 && (
                          <div className="absolute bottom-4 left-4 flex max-w-[55vw] gap-2 overflow-x-auto rounded-2xl bg-black/30 p-1 backdrop-blur">
                            {visibleRemoteVideos
                              .filter((video) => video.id !== focusedVideo)
                              .map((video, index) => (
                                <div
                                  key={video.id}
                                  className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl"
                                >
                                  <RemoteVideoTile
                                    track={video.track}
                                    identity={video.identity || `Guest ${index + 1}`}
                                    onClick={() => setFocusedVideo(video.id)}
                                    className="h-full w-full"
                                  />
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {room && (
                    <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={toggleCamera}
                        className="rounded-full bg-black/70 px-3 py-2 text-xs font-black backdrop-blur hover:bg-black/90"
                      >
                        {cameraOn ? "Camera Off" : "Camera On"}
                      </button>

                      <button
                        onClick={toggleMic}
                        className="rounded-full bg-black/70 px-3 py-2 text-xs font-black backdrop-blur hover:bg-black/90"
                      >
                        {micOn ? "Mute" : "Unmute"}
                      </button>

                      <button
                        onClick={switchCameraView}
                        className="rounded-full bg-black/70 px-3 py-2 text-xs font-black backdrop-blur hover:bg-black/90"
                      >
                        Flip Camera
                      </button>

                      <button
                        onClick={() =>
                          setFocusedVideo((current) =>
                            current === "local" && remoteVideos.length > 0
                              ? remoteVideos[0].id
                              : "local",
                          )
                        }
                        disabled={remoteVideos.length === 0}
                        className="rounded-full bg-black/70 px-3 py-2 text-xs font-black backdrop-blur hover:bg-black/90 disabled:text-gray-500"
                      >
                        Switch Focus
                      </button>

                      <button
                        onClick={enterTheaterMode}
                        className="rounded-full bg-black/70 px-3 py-2 text-xs font-black backdrop-blur hover:bg-black/90"
                      >
                        Fullscreen
                      </button>

                      <button
                        onClick={stopLiveStream}
                        className="rounded-full bg-red-600 px-3 py-2 text-xs font-black backdrop-blur hover:bg-red-700"
                      >
                        {role === "host"
                          ? isPrivate
                            ? "End Call"
                            : "End Stream"
                          : "Leave Stream"}
                      </button>
                    </div>
                  )}

                  {!room && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4">
                      <div className="max-w-md text-center">
                        <div className="mb-4 text-5xl sm:mb-5 sm:text-6xl">
                          <span className="inline-flex h-24 w-24 items-center justify-center rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-black text-red-300 shadow-[0_0_45px_rgba(239,68,68,0.30)]"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.08 5.18 2 2 0 0 1 5.06 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L9 10.64a16 16 0 0 0 4.36 4.36l1.21-1.21a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92z" /></svg></span>
                        </div>

                        <h2 className="mb-3 text-3xl font-black sm:text-4xl">
                          {role === "host"
                            ? isPrivate
                              ? "Ready to Start Private Call?"
                              : isSubscribersOnly
                                ? "Ready to Start Subscriber Stream?"
                                : "Ready to Go Live?"
                            : "Ready to Join?"}
                        </h2>

                        <p className="mb-6 text-sm text-gray-400 sm:mb-8 sm:text-base">
                          {role === "host"
                            ? isPrivate
                              ? "Start your private video call. Only invited guests can join."
                              : isSubscribersOnly
                                ? "Start your premium stream. Active subscribers will be notified."
                                : "Start your camera and microphone to begin broadcasting."
                            : "Join with your camera and microphone as guest streamer."}
                        </p>

                        <div className="flex flex-col gap-3 sm:items-center">
                          <button
                            onClick={startLiveStream}
                            disabled={starting}
                            className="w-full rounded-xl bg-red-600 px-6 py-4 text-base font-bold hover:bg-red-700 disabled:bg-gray-700 sm:w-auto sm:px-8 sm:text-lg"
                          >
                            {starting
                              ? "Starting..."
                              : role === "host"
                                ? isPrivate
                                  ? "Start Private Call"
                                  : "Start Live Stream"
                                : "Join Stream"}
                          </button>

                          {role === "host" && isPrivate && !room && (
                            <button
                              onClick={cancelOutgoingPrivateCall}
                              className="w-full rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white hover:bg-white/20 sm:w-auto sm:px-8"
                            >
                              Cancel Call
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                <h2 className="mb-5 text-2xl font-black">Studio Controls</h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
                  {!room ? (
                    <>
                      <button
                        onClick={startLiveStream}
                        disabled={starting}
                        className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700 disabled:bg-gray-700"
                      >
                        {starting
                          ? "Starting..."
                          : role === "host"
                            ? isPrivate
                              ? "Start Private Call"
                              : "Start Stream"
                            : "Join Stream"}
                      </button>

                      {role === "host" && isPrivate && (
                        <button
                          onClick={cancelOutgoingPrivateCall}
                          className="rounded-xl border border-white/10 bg-white/10 px-6 py-3 font-black hover:bg-white/20"
                        >
                          Cancel Call
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={stopLiveStream}
                      className="rounded-xl bg-red-600 px-6 py-3 font-bold hover:bg-red-700"
                    >
                      {role === "host"
                        ? isPrivate
                          ? "End Private Call"
                          : "End Stream"
                        : "Leave Stream"}
                    </button>
                  )}

                  <button
                    onClick={toggleCamera}
                    disabled={!room}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                  >
                    {cameraOn ? "Turn Camera Off" : "Turn Camera On"}
                  </button>

                  <button
                    onClick={switchCameraView}
                    disabled={!room}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                  >
                    Flip Camera
                  </button>

                  <button
                    onClick={toggleMic}
                    disabled={!room}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                  >
                    {micOn ? "Mute Mic" : "Unmute Mic"}
                  </button>

                  <button
                    onClick={() => {
                      remoteAudioElementsRef.current.forEach((audio) => {
                        audio.play().catch(() => { });
                      });
                    }}
                    disabled={!room}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                  >
                    Enable Audio
                  </button>

                  <button
                    onClick={enterTheaterMode}
                    disabled={!room}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                  >
                    Fullscreen
                  </button>

                  <button
                    onClick={copyViewerLink}
                    className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700"
                  >
                    {copied
                      ? "Link Copied"
                      : isPrivate
                        ? "Share Private Room"
                        : "Share Stream"}
                  </button>
                </div>
              </div>

              {role === "host" && !isPrivate && (
                <div className="mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4 sm:p-6">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black">Join Requests</h2>
                      <p className="text-sm text-gray-400">
                        Viewers can request to join like TikTok Live. You can add up to 3 guests.
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-black/40 px-3 py-1 text-xs font-black text-purple-200">
                      {getAcceptedGuestCount()}/{MAX_ACCEPTED_GUESTS} guests
                    </span>
                  </div>

                  {pendingJoinRequests.length === 0 ? (
                    <p className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-500">
                      No viewer requests right now.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pendingJoinRequests.map((request) => {
                        const requesterName =
                          request.profiles?.display_name ||
                          request.profiles?.username ||
                          request.requester_id;

                        return (
                          <div
                            key={request.id}
                            className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                src={request.profiles?.avatar_url || "/default-avatar.png"}
                                alt={requesterName}
                                className="h-12 w-12 shrink-0 rounded-full object-cover"
                              />

                              <div className="min-w-0">
                                <p className="truncate font-black">{requesterName}</p>
                                <p className="text-sm text-gray-400">Requested to join live</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              <button
                                onClick={() => acceptJoinRequest(request)}
                                disabled={
                                  joinRequestUpdatingId === request.id ||
                                  getAcceptedGuestCount() >= MAX_ACCEPTED_GUESTS
                                }
                                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-black hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-400"
                              >
                                {joinRequestUpdatingId === request.id
                                  ? "Adding..."
                                  : getAcceptedGuestCount() >= MAX_ACCEPTED_GUESTS
                                    ? "Limit Reached"
                                    : "Add to Stream"}
                              </button>

                              <button
                                onClick={() => declineJoinRequest(request)}
                                disabled={joinRequestUpdatingId === request.id}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-400"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {role === "host" && (
                <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                  <h2 className="mb-2 text-2xl font-black">
                    Invite Guest Streamer
                  </h2>

                  <p className="mb-5 text-sm text-gray-400">
                    Search creators by name or username, then invite them to
                    join this room. Limit: host + 3 guests.
                    {acceptedGuestCount >= MAX_ACCEPTED_GUESTS && " Guest limit reached."}
                  </p>

                  <div className="mb-5">
                    <input
                      value={guestInput}
                      onChange={(e) => setGuestInput(e.target.value)}
                      placeholder="Search creator name or username..."
                      className="w-full rounded-xl border border-gray-700 bg-gray-800 p-4 focus:border-red-500 focus:outline-none"
                    />
                  </div>

                  {guestInput.trim().length > 0 && (
                    <div className="mb-6 rounded-2xl border border-gray-800 bg-black/30 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-bold">Search Results</p>
                        {creatorSearching && (
                          <p className="text-sm text-gray-400">Searching...</p>
                        )}
                      </div>

                      {guestInput.trim().length < 2 ? (
                        <p className="text-sm text-gray-500">
                          Type at least 2 characters to search creators.
                        </p>
                      ) : creatorResults.length === 0 && !creatorSearching ? (
                        <p className="text-sm text-gray-500">
                          No matching creators found.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {creatorResults.map((profile) => (
                            <div
                              key={profile.id}
                              className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <img
                                  src={
                                    profile.avatar_url || "/default-avatar.png"
                                  }
                                  alt={profile.username || "Creator"}
                                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                                />

                                <div className="min-w-0">
                                  <p className="truncate font-bold">
                                    {profile.display_name ||
                                      profile.username ||
                                      "Unnamed Creator"}
                                  </p>

                                  <p className="truncate text-sm text-gray-400">
                                    @{profile.username || "no-username"}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => inviteCreator(profile)}
                                disabled={
                                  inviteSendingId === profile.id ||
                                  (!isPrivate && activeGuestInvites.length >= MAX_ACCEPTED_GUESTS)
                                }
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
                              >
                                {inviteSendingId === profile.id
                                  ? "Inviting..."
                                  : !isPrivate && activeGuestInvites.length >= MAX_ACCEPTED_GUESTS
                                    ? "Limit Reached"
                                    : "Invite"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="font-black">Guest Invites</h3>

                    {activeGuestInvites.length === 0 ? (
                      <p className="text-gray-500">No guests invited yet.</p>
                    ) : (
                      activeGuestInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={
                                invite.profiles?.avatar_url ||
                                "/default-avatar.png"
                              }
                              alt="Guest"
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />

                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {invite.profiles?.display_name ||
                                  invite.profiles?.username ||
                                  invite.guest_id}
                              </p>

                              <p className="text-sm text-gray-400">
                                Status: {invite.status}
                              </p>
                            </div>
                          </div>

                          {invite.status !== "removed" && (
                            <button
                              onClick={() =>
                                removeGuest(invite.id, invite.guest_id)
                              }
                              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold hover:bg-red-600"
                            >
                              Remove Guest
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex h-[580px] flex-col rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:h-[720px]">
              <div className="mb-5">
                <h2 className="text-2xl font-black sm:text-3xl">
                  {isPrivate ? "Private Chat" : "Live Chat"}
                </h2>
                <p className="text-sm text-gray-400">
                  {isGlobalMuted
                    ? "Your account is globally muted."
                    : isShadowBanned
                      ? "Your messages appear sent but are hidden from others."
                      : canSendChat
                        ? "Chat is active."
                        : "Chat unlocks only when this room is live and connected."}
                </p>
              </div>

              <div
                ref={chatBoxRef}
                className="mb-4 flex-1 space-y-4 overflow-auto rounded-2xl bg-gray-800 p-3 sm:p-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-gray-400">
                    <div>
                      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-500/20 via-slate-900 to-purple-500/20 text-red-300 shadow-[0_0_40px_rgba(239,68,68,0.28)]"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 2 1.3-4.2A8.5 8.5 0 1 1 21 11.5z" /><path d="M8 11h8" /><path d="M8 15h5" /></svg></div>
                      <p>No chat messages yet.</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((chat) => {
                    const paid = isPaidMessage(chat);
                    const paidAmount = getPaidMessageAmount(chat);

                    return (
                      <div
                        key={chat.id}
                        className={
                          paid
                            ? "rounded-xl border border-yellow-400/40 bg-yellow-500/10 p-3 shadow-lg shadow-yellow-950/30"
                            : "rounded-xl bg-gray-900 p-3"
                        }
                      >
                        {paid && (
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-black text-black">
                              PAID MESSAGE
                            </span>
                            {paidAmount > 0 && (
                              <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold text-yellow-200">
                                USD {paidAmount}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={
                                paid
                                  ? "mb-1 truncate font-black text-yellow-300"
                                  : "mb-1 truncate font-bold text-red-400"
                              }
                            >
                              {chat.username}
                            </p>

                            <p
                              className={
                                paid
                                  ? "break-words text-base font-bold text-white"
                                  : "break-words text-white"
                              }
                            >
                              {getDisplayMessage(chat)}
                            </p>
                          </div>
                        </div>

                        {role === "host" && chat.user_id !== currentUserId && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => deleteChatMessage(chat.id)}
                              disabled={deletingChatId === chat.id}
                              className="rounded-lg bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300 hover:bg-red-600 hover:text-white disabled:bg-gray-700 disabled:text-gray-500"
                            >
                              {deletingChatId === chat.id
                                ? "..."
                                : "Delete Message"}
                            </button>

                            {chat.user_id && (
                              <>
                                <button
                                  onClick={() => muteChatUser(chat)}
                                  disabled={moderatingUserId === chat.user_id}
                                  className="rounded-lg bg-yellow-600/20 px-3 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-600 hover:text-white disabled:bg-gray-700 disabled:text-gray-500"
                                >
                                  {moderatingUserId === chat.user_id
                                    ? "..."
                                    : "Mute User"}
                                </button>

                                <button
                                  onClick={() => removeUserFromStream(chat)}
                                  disabled={moderatingUserId === chat.user_id}
                                  className="rounded-lg bg-red-600/20 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white disabled:bg-gray-700 disabled:text-gray-500"
                                >
                                  {moderatingUserId === chat.user_id
                                    ? "..."
                                    : "Remove User"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-2">
                <input
                  placeholder={
                    isGlobalMuted
                      ? "Your account is muted"
                      : canSendChat
                        ? "Type a message..."
                        : "Chat is available only during a live connected stream"
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSendChat) sendMessage();
                  }}
                  disabled={!canSendChat}
                  className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 p-3 focus:border-red-500 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-500 disabled:placeholder:text-gray-600 sm:p-4"
                />

                <button
                  onClick={sendMessage}
                  disabled={!canSendChat}
                  className="rounded-xl bg-red-600 px-4 font-bold hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500 sm:px-5"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RemoteVideoTile({
  track,
  identity,
  className = "",
  onClick,
}: {
  track: any;
  identity: string;
  className?: string;
  onClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!track || !videoRef.current) return;

    track.attach(videoRef.current);
    videoRef.current.autoplay = true;
    videoRef.current.playsInline = true;
    videoRef.current.style.width = "100%";
    videoRef.current.style.height = "100%";
    videoRef.current.style.objectFit = "cover";
    videoRef.current.play().catch(() => { });

    return () => {
      try {
        if (videoRef.current) {
          track.detach(videoRef.current);
        }
      } catch (error) {
        console.error(error);
      }
    };
  }, [track]);

  return (
    <div
      onClick={onClick}
      className={`relative h-full w-full overflow-hidden rounded-2xl bg-black ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold">
        {identity}
      </div>
    </div>
  );
}
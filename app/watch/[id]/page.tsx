"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
} from "livekit-client";
import { supabase } from "../../../lib/supabase";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { startAttendanceSession, endAttendanceSession } from "../../../lib/attendance";
import BlockUserButton from "../../components/BlockUserButton";

type ChatMessage = {
  id: string;
  username: string;
  message: string;
  created_at: string;
};

type StreamData = {
  id: string;
  title?: string;
  category?: string;
  thumbnail_url?: string;
  status?: string;
  likes?: number;
  viewers?: number;
  total_views?: number;
  peak_viewers?: number;
  watch_minutes?: number;
  user_id?: string;
  visibility?: "public" | "private" | "subscribers";
  private_call_price?: number | null;
  is_suspended?: boolean;
  created_at?: string;
};

type HostProfile = {
  id: string;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean;
};


type StreamJoinRequest = {
  id: string;
  stream_id: string;
  requester_id: string;
  host_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at?: string | null;
};

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Preparing stream...");
  const [streamStatus, setStreamStatus] = useState("offline");
  const [stream, setStream] = useState<StreamData | null>(null);
  const [host, setHost] = useState<HostProfile | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [joinRequest, setJoinRequest] = useState<StreamJoinRequest | null>(null);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [privateBlocked, setPrivateBlocked] = useState(false);
  const [privateAllowed, setPrivateAllowed] = useState(false);
  const [privateCallPrice, setPrivateCallPrice] = useState(0);
  const [privatePaymentCompleted, setPrivatePaymentCompleted] = useState(false);
  const [subscriberBlocked, setSubscriberBlocked] = useState(false);
  const [subscriberAllowed, setSubscriberAllowed] = useState(false);
  const [blockedAccess, setBlockedAccess] = useState(false);

  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [isShadowBanned, setIsShadowBanned] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [tipOpen, setTipOpen] = useState(false);
  const [selectedTipAmount, setSelectedTipAmount] = useState<number | "custom">(
    10
  );
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [fullscreenChatOpen, setFullscreenChatOpen] = useState(false);
  const [videoTrackVersion, setVideoTrackVersion] = useState(0);
  const [videoFitMode, setVideoFitMode] = useState<"cover" | "contain">("cover");

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const viewerRecordIdRef = useRef<string | null>(null);
  const viewTrackedRef = useRef(false);
  const watchStartRef = useRef<number | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const viewerRoomRef = useRef<Room | null>(null);
  const autoJoinTriggeredRef = useRef(false);
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

  function isMobileDevice() {
    if (typeof navigator === "undefined") return false;

    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function getViewerRoomOptions() {
    const mobile = isMobileDevice();

    return {
      // Keep adaptive stream enabled, but ask for stronger receive quality by
      // attaching the video at full container size and requesting HIGH quality
      // from remote publications where LiveKit exposes that method.
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
      videoCaptureDefaults: {
        resolution: {
          width: mobile ? 1280 : 1920,
          height: mobile ? 720 : 1080,
          frameRate: 30,
        },
      },
    };
  }

  function getViewerConnectOptions() {
    return {
      autoSubscribe: true,
      maxRetries: 8,
      peerConnectionTimeout: 30_000,
    };
  }

  function requestBestRemoteVideoQuality(publication?: RemoteTrackPublication | any) {
    if (!publication) return;

    try {
      if (publication.setSubscribed && publication.isSubscribed === false) {
        publication.setSubscribed(true);
      }
    } catch (error) {
      console.warn("Viewer subscription request skipped:", error);
    }

    try {
      // LiveKit's high quality enum is commonly numeric value 2.
      // Use optional call to avoid breaking older SDK builds.
      publication.setVideoQuality?.(2);
    } catch (error) {
      console.warn("Viewer video quality request skipped:", error);
    }
  }

  function syncViewerRemoteQuality(targetRoom: Room | null) {
    if (!targetRoom) return;

    targetRoom.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication: any) => {
        requestBestRemoteVideoQuality(publication);

        if (publication.track) {
  const track = publication.track;

  if (track.kind === Track.Kind.Video) {
    remoteVideoTrackRef.current = track as RemoteTrack;
    setVideoTrackVersion((current) => current + 1);

    attachVideoTrackToContainer(
      track as RemoteTrack,
      videoContainerRef.current,
      "18px"
    );

    if (isViewerFullscreen) {
      attachVideoTrackToContainer(
        track as RemoteTrack,
        fullscreenVideoContainerRef.current,
        "0px"
      );
    }

    setStatus("Live stream connected");
  }

  if (track.kind === Track.Kind.Audio) {
    const element = track.attach();
    const audioElement = element as HTMLAudioElement;
    audioElement.autoplay = true;
    audioElement.controls = false;
    audioElement.style.display = "none";

    document.body.appendChild(audioElement);
    audioElementsRef.current.push(audioElement);

    audioElement.play().catch(() => {
      setAudioBlocked(true);
      console.warn("Audio autoplay blocked. User must enable audio manually.");
    });
  }
}
      });
    });
  }

  function attachVideoTrackToContainer(
    track: RemoteTrack | null,
    container: HTMLDivElement | null,
    borderRadius = "18px"
  ) {
    if (!track || !container) return;

    const element = track.attach() as HTMLVideoElement;
    element.autoplay = true;
    element.playsInline = true;
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.objectFit = videoFitMode;
    element.style.borderRadius = borderRadius;
    element.style.backgroundColor = "#000000";

    container.innerHTML = "";
    container.appendChild(element);

    element.play().catch(() => {});
  }

  function openViewerFullscreen() {
    if (!connected || streamStatus !== "live") {
      alert("Fullscreen is available only while the stream is live and connected.");
      return;
    }

    setIsViewerFullscreen(true);
    setFullscreenChatOpen(false);

    document.documentElement.classList.add("streamhub-theater-mode");
    document.body.classList.add("streamhub-theater-mode");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    setTimeout(() => {
      attachVideoTrackToContainer(
        remoteVideoTrackRef.current,
        fullscreenVideoContainerRef.current,
        "0px"
      );
    }, 100);
  }

  function closeViewerFullscreen() {
    setIsViewerFullscreen(false);
    setFullscreenChatOpen(false);

    document.documentElement.classList.remove("streamhub-theater-mode");
    document.body.classList.remove("streamhub-theater-mode");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }


  async function cleanupViewerBeforeAutoJoin() {
    try {
      if (viewerRoomRef.current) {
        viewerRoomRef.current.disconnect();
        viewerRoomRef.current = null;
      }
    } catch (error) {
      console.warn("Viewer room cleanup before guest join failed:", error);
    }

    try {
      const viewerRecordId = viewerRecordIdRef.current;

      if (viewerRecordId) {
        await supabase.from("stream_viewers").delete().eq("id", viewerRecordId);
        viewerRecordIdRef.current = null;
      }

      await endViewerAttendance();
    } catch (error) {
      console.warn("Viewer record cleanup before guest join failed:", error);
    }

    try {
      audioElementsRef.current.forEach((audio) => {
        try {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
        } catch {}
      });
      audioElementsRef.current = [];
    } catch {}

    await KeepAwake.allowSleep().catch(() => {});
    document.documentElement.classList.remove("streamhub-theater-mode");
      document.body.classList.remove("streamhub-theater-mode");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
  }

  async function openAcceptedGuestStudio() {
    if (autoJoinTriggeredRef.current) return;

    autoJoinTriggeredRef.current = true;
    setStatus("Host accepted your request. Opening live studio...");
    await cleanupViewerBeforeAutoJoin();

    // Force a clean page transition so the old viewer LiveKit identity is fully disconnected
    // before the same user joins again as a publishing guest.
    window.location.assign(`/live/${streamId}?autojoin=1`);
  }

  async function incrementDailyAnalytics(input: {
    viewsDelta?: number;
    watchMinutesDelta?: number;
    likesDelta?: number;
    chatMessagesDelta?: number;
    peakViewers?: number;
  }) {
    if (!streamId) return;

    const { error } = await supabase.rpc("increment_stream_daily_analytics", {
      target_stream_id: streamId,
      views_delta: input.viewsDelta || 0,
      watch_minutes_delta: input.watchMinutesDelta || 0,
      likes_delta: input.likesDelta || 0,
      chat_messages_delta: input.chatMessagesDelta || 0,
      peak_viewers_value: input.peakViewers || 0,
    });

    if (error) {
      console.error("Daily analytics RPC error:", error.message);
    }
  }

  async function startViewerAttendance(userId: string | null | undefined) {
    if (!streamId || !userId || attendanceSessionIdRef.current) return;

    const attendanceId = await startAttendanceSession({
      streamId,
      participantId: userId,
      participantRole: "viewer",
    });

    if (attendanceId) {
      attendanceSessionIdRef.current = attendanceId;
    }
  }

  async function endViewerAttendance() {
    const attendanceId = attendanceSessionIdRef.current;
    if (!attendanceId) return;

    attendanceSessionIdRef.current = null;
    await endAttendanceSession(attendanceId);
  }


  useEffect(() => {
    let room: Room | null = null;
    let chatChannel: any = null;
    let streamChannel: any = null;
    let viewerChannel: any = null;
    let viewerSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    async function getViewerCount() {
      const { data, error } = await supabase.rpc("sync_stream_viewer_count", {
        target_stream_id: streamId,
      });

      if (error) {
        console.error("Viewer count sync error:", error.message);

        const { count } = await supabase
          .from("stream_viewers")
          .select("id", { count: "exact", head: true })
          .eq("stream_id", streamId);

        setViewerCount(count || 0);
        return;
      }

      setViewerCount(Number(data || 0));
    }

    async function trackTotalView() {
      if (viewTrackedRef.current) return;

      viewTrackedRef.current = true;

      const { error } = await supabase.rpc("increment_stream_total_view", {
        target_stream_id: streamId,
      });

      if (error) {
        console.error("Total view RPC error:", error.message);
        await incrementDailyAnalytics({ viewsDelta: 1 });
      }
    }

    async function trackWatchMinutes() {
      if (!watchStartRef.current) return;

      const secondsWatched = Math.floor(
        (Date.now() - watchStartRef.current) / 1000
      );

      const minutesWatched = Math.max(1, Math.ceil(secondsWatched / 60));

      const { error } = await supabase.rpc("increment_stream_watch_minutes", {
        target_stream_id: streamId,
        minutes_delta: minutesWatched,
      });

      if (error) {
        console.error("Watch minutes RPC error:", error.message);
        await incrementDailyAnalytics({ watchMinutesDelta: minutesWatched });
      }

      watchStartRef.current = null;
    }

    async function createViewerRecord() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const viewerName = user
        ? await getSafeDisplayName(user, "Guest Viewer")
        : "Guest Viewer";

      const { data, error } = await supabase
        .from("stream_viewers")
        .insert([
          {
            stream_id: streamId,
            user_id: user?.id || null,
            viewer_name: viewerName,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Viewer record error:", error.message);
        return;
      }

      if (data?.id) {
        viewerRecordIdRef.current = data.id;
      }

      watchStartRef.current = Date.now();

      await startViewerAttendance(user?.id);

      await trackTotalView();
      await getViewerCount();
    }

    async function removeViewerRecord() {
      const id = viewerRecordIdRef.current;

      if (id) {
        await supabase.from("stream_viewers").delete().eq("id", id);
        viewerRecordIdRef.current = null;
      }

      await endViewerAttendance();
      await trackWatchMinutes();
      await getViewerCount();
    }

    async function checkUserModeration() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return true;

      const { data, error } = await supabase
        .from("profiles")
        .select("is_banned, is_global_muted, is_shadow_banned")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Moderation check error:", error.message);
        return true;
      }

      setIsGlobalMuted(!!data?.is_global_muted);
      setIsShadowBanned(!!data?.is_shadow_banned);

      if (data?.is_banned) {
        router.push("/banned");
        return false;
      }

      return true;
    }

    async function checkFollowStatus(hostId: string, viewerId: string) {
      if (hostId === viewerId) {
        setIsFollowingHost(false);
        return;
      }

      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("following_id", hostId)
        .maybeSingle();

      setIsFollowingHost(!!data);
    }

    async function checkBlockAccess(streamData: StreamData) {
      if (!streamData.user_id) return true;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return true;
      if (user.id === streamData.user_id) return true;

      const { data, error } = await supabase.rpc("is_user_blocked", {
        user_a: streamData.user_id,
        user_b: user.id,
      });

      if (error) {
        console.error("Block check error:", error.message);
        return true;
      }

      if (data === true) {
        setBlockedAccess(true);
        setStatus("You cannot access this stream.");
        return false;
      }

      return true;
    }

    async function checkPrivateAccess(streamData: StreamData) {
      if (streamData.visibility !== "private") {
        setPrivateAllowed(false);
        setPrivateBlocked(false);
        setPrivateCallPrice(0);
        setPrivatePaymentCompleted(false);
        return true;
      }

      const price = Number(streamData.private_call_price || 0);
      setPrivateCallPrice(price);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPrivateAllowed(false);
        setPrivateBlocked(true);
        setPrivatePaymentCompleted(false);
        setStatus(
          price > 0
            ? `This is a paid private video call. Login and open Calls to pay USD ${price}.`
            : "This is a private video call. Login and open Calls to join if invited."
        );
        return false;
      }

      if (streamData.user_id === user.id) {
        setPrivateAllowed(true);
        setPrivateBlocked(true);
        setPrivatePaymentCompleted(true);
        setStatus("This is your private video call. Open it from the studio.");
        return false;
      }

      const { data: invite } = await supabase
        .from("stream_guests")
        .select("id, status")
        .eq("stream_id", streamId)
        .eq("guest_id", user.id)
        .in("status", ["pending", "accepted"])
        .maybeSingle();

      if (!invite) {
        setPrivateAllowed(false);
        setPrivateBlocked(true);
        setPrivatePaymentCompleted(false);
        setStatus("This private video call is invite-only and cannot be watched publicly.");
        return false;
      }

      if (price <= 0) {
        setPrivateAllowed(true);
        setPrivateBlocked(true);
        setPrivatePaymentCompleted(true);
        setStatus("You are invited to this free private video call. Open it from Calls.");
        return false;
      }

      const { data: payment, error: paymentError } = await supabase
        .from("private_call_payments")
        .select("id")
        .eq("stream_id", streamId)
        .eq("caller_id", user.id)
        .eq("creator_id", streamData.user_id)
        .maybeSingle();

      if (paymentError) {
        console.error("Private call payment check error:", paymentError.message);
      }

      if (payment) {
        setPrivateAllowed(true);
        setPrivateBlocked(true);
        setPrivatePaymentCompleted(true);
        setStatus(`Payment confirmed. Open Calls to join this USD ${price} private call.`);
        return false;
      }

      setPrivateAllowed(false);
      setPrivateBlocked(true);
      setPrivatePaymentCompleted(false);
      setStatus(`Payment required. Open Calls and pay USD ${price} to join this private call.`);
      return false;
    }

    async function checkSubscriberAccess(streamData: StreamData) {
      if (streamData.visibility !== "subscribers") {
        setSubscriberAllowed(false);
        setSubscriberBlocked(false);
        return true;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscriberAllowed(false);
        setSubscriberBlocked(true);
        setStatus("This stream is for subscribers only. Please login.");
        return false;
      }

      if (streamData.user_id === user.id) {
        setSubscriberAllowed(true);
        setSubscriberBlocked(false);
        return true;
      }

      if (!streamData.user_id) {
        setSubscriberAllowed(false);
        setSubscriberBlocked(true);
        setStatus("Creator profile not found.");
        return false;
      }

      const { data, error } = await supabase.rpc("is_subscribed_to_creator", {
        target_creator_id: streamData.user_id,
      });

      if (error) {
        console.error("Subscription check error:", error.message);
        setSubscriberAllowed(false);
        setSubscriberBlocked(true);
        setStatus("Unable to verify your subscription.");
        return false;
      }

      if (data === true) {
        setSubscriberAllowed(true);
        setSubscriberBlocked(false);
        return true;
      }

      setSubscriberAllowed(false);
      setSubscriberBlocked(true);
      setStatus("This is a subscriber-only stream.");
      return false;
    }

    async function loadStreamData() {
      const { data, error } = await supabase
        .from("streams")
        .select(`
          id,
          title,
          category,
          thumbnail_url,
          status,
          likes,
          viewers,
          total_views,
          peak_viewers,
          watch_minutes,
          user_id,
          visibility,
          private_call_price,
          is_suspended,
          created_at
        `)
        .eq("id", streamId)
        .single();

      if (error || !data) {
        setStatus("Stream not found.");
        setLoading(false);
        return null;
      }

      if (!isMounted) return null;

      setStream(data);
      setStreamStatus(data.status || "offline");
      setLikes(data.likes || 0);
      setViewerCount(data.viewers || 0);

      if (data.is_suspended) {
        setStatus("This stream has been suspended.");
        setBlockedAccess(true);
        setLoading(false);
        return data as StreamData;
      }

      if (data.user_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, is_verified")
          .eq("id", data.user_id)
          .single();

        if (profileData) setHost(profileData);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id || null);

      if (user) {
        const { data: existingLike } = await supabase
          .from("stream_likes")
          .select("id")
          .eq("stream_id", streamId)
          .eq("user_id", user.id)
          .maybeSingle();

        setLiked(!!existingLike);

        if (data.user_id) {
          await checkFollowStatus(data.user_id, user.id);
        }
      }

      const channelKey = `${streamId}-${Date.now()}`;

      streamChannel = supabase
        .channel("watch-stream-updates-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "streams",
            filter: `id=eq.${streamId}`,
          },
          (payload) => {
            const updatedStream: any = payload.new;

            setStream((current) => ({
              ...current,
              ...updatedStream,
            }));

            setLikes(updatedStream.likes || 0);
            setViewerCount(updatedStream.viewers || 0);
            setStreamStatus(updatedStream.status || "offline");

            if (updatedStream.is_suspended) {
              setBlockedAccess(true);
              setConnected(false);
              setStatus("This stream has been suspended.");
              removeViewerRecord();
      KeepAwake.allowSleep().catch(() => {});

              if (room) room.disconnect();
      if (viewerRoomRef.current === room) viewerRoomRef.current = null;
              return;
            }

            if (updatedStream.status !== "live") {
              setConnected(false);
              setStatus("This stream is now offline. Redirecting to Explore...");
              setMessages([]);
              removeViewerRecord();

              if (room) room.disconnect();
      if (viewerRoomRef.current === room) viewerRoomRef.current = null;

              setTimeout(() => {
                router.push("/explore");
              }, 2000);

              return;
            }
          }
        )
        .subscribe();

      viewerChannel = supabase
        .channel("watch-viewers-" + channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stream_viewers",
            filter: `stream_id=eq.${streamId}`,
          },
          async () => {
            if (viewerSyncTimer) clearTimeout(viewerSyncTimer);

            viewerSyncTimer = setTimeout(() => {
              getViewerCount();
            }, 1000);
          }
        )
        .subscribe();

      await getViewerCount();

      return data as StreamData;
    }

    async function loadChat() {
      const { data, error } = await supabase
        .from("stream_chat")
        .select("id, username, message, created_at")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setMessages([...data].reverse());
      }

      setTimeout(() => {
        chatChannel = supabase
          .channel("watch-chat-" + streamId + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "stream_chat",
            filter: `stream_id=eq.${streamId}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;

            setMessages((current) => {
              const exists = current.some((item) => item.id === newMsg.id);
              if (exists) return current;
              return [...current, newMsg];
            });
          }
        )          .subscribe();
      }, 750);
    }

    function attachTrack(track: RemoteTrack) {
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) {
        return;
      }

      if (track.kind === Track.Kind.Video) {
        remoteVideoTrackRef.current = track;
        setVideoTrackVersion((current) => current + 1);

        attachVideoTrackToContainer(track, videoContainerRef.current, "18px");

        if (isViewerFullscreen) {
          attachVideoTrackToContainer(
            track,
            fullscreenVideoContainerRef.current,
            "0px"
          );
        }

        setStatus("Live stream connected");
        return;
      }

      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        const audioElement = element as HTMLAudioElement;
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.style.display = "none";

        document.body.appendChild(audioElement);
        audioElementsRef.current.push(audioElement);

        audioElement.play().catch(() => {
          setAudioBlocked(true);
          console.warn("Audio autoplay blocked. User must enable audio manually.");
        });
      }
    }

    async function joinRoom() {
      try {
        setLoading(true);

        const moderationAllowed = await checkUserModeration();

        if (!moderationAllowed) {
          setLoading(false);
          return;
        }

        const streamData = await loadStreamData();

        if (!streamData) return;

        if (streamData.is_suspended) {
          setLoading(false);
          return;
        }

        const canAccessByBlock = await checkBlockAccess(streamData);

        if (!canAccessByBlock) {
          setLoading(false);
          return;
        }

        const canWatchPrivate = await checkPrivateAccess(streamData);

        if (!canWatchPrivate) {
          setLoading(false);
          return;
        }

        const canWatchSubscriber = await checkSubscriberAccess(streamData);

        if (!canWatchSubscriber) {
          setLoading(false);
          return;
        }

        await loadChat();

        if (streamData.status !== "live") {
          setStatus("This stream is currently offline.");
          setLoading(false);
          return;
        }

        setStatus("Connecting to LiveKit...");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!user || !session?.access_token) {
          setStatus("Please login to watch this stream.");
          setLoading(false);
          router.push("/login");
          return;
        }

        const viewerDisplayName = await getSafeDisplayName(user, "Viewer");

        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            roomName: streamId,
            streamId,
            participantName: `viewer-${viewerDisplayName}`,
            mode: "viewer",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus(data.error || "Failed to get LiveKit token.");
          setLoading(false);
          return;
        }

        room = new Room(getViewerRoomOptions() as any);
        viewerRoomRef.current = room;

        room.on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            publication: RemoteTrackPublication,
            participant: RemoteParticipant
          ) => {
            requestBestRemoteVideoQuality(publication);
            attachTrack(track);
          }
        );

        (room as any).on((RoomEvent as any).Reconnecting, () => {
          setConnected(false);
          setStatus("Connection unstable. Reconnecting...");
        });

        (room as any).on((RoomEvent as any).Reconnected, () => {
          setConnected(true);
          setStatus("Live stream reconnected");
        });

        room.on(RoomEvent.Disconnected, async () => {
          setConnected(false);

          if (autoJoinTriggeredRef.current) {
            setStatus("Switching from viewer to guest studio...");
            await removeViewerRecord();
            await KeepAwake.allowSleep().catch(() => {});
            return;
          }

          setStatus("Stream ended. Redirecting to Explore...");
          await removeViewerRecord();
          await KeepAwake.allowSleep().catch(() => {});

          setTimeout(() => {
            router.push("/explore");
          }, 2000);
        });

        await room.connect(
          process.env.NEXT_PUBLIC_LIVEKIT_URL!,
          data.token,
          getViewerConnectOptions() as any
        );

        await createViewerRecord();

        setConnected(true);
        setStatus("Connected. Waiting for streamer video...");

        await KeepAwake.keepAwake().catch((error) => {
          console.warn("Viewer keep awake failed:", error);
        });

        syncViewerRemoteQuality(room);
        setTimeout(() => syncViewerRemoteQuality(room), 700);
        setTimeout(() => syncViewerRemoteQuality(room), 1500);

        setLoading(false);
      } catch (error: any) {
        console.error("Viewer Error:", error);
        setStatus(error.message || "Unable to join stream.");
        setLoading(false);
      }
    }

    if (streamId) {
      joinRoom();
    }

    return () => {
      isMounted = false;

      removeViewerRecord();
      KeepAwake.allowSleep().catch(() => {});
      document.documentElement.classList.remove("streamhub-theater-mode");
      document.body.classList.remove("streamhub-theater-mode");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";

      audioElementsRef.current.forEach((audio) => {
        try {
          audio.pause();
          audio.srcObject = null;
          audio.remove();
        } catch (error) {
          console.error(error);
        }
      });
      audioElementsRef.current = [];

      if (room) room.disconnect();
      if (viewerRoomRef.current === room) viewerRoomRef.current = null;
      if (chatChannel) supabase.removeChannel(chatChannel);
      if (streamChannel) supabase.removeChannel(streamChannel);
      if (viewerSyncTimer) clearTimeout(viewerSyncTimer);
      if (viewerChannel) supabase.removeChannel(viewerChannel);
    };
  }, [streamId, router]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);


  useEffect(() => {
    if (!isViewerFullscreen) return;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      attachVideoTrackToContainer(
        remoteVideoTrackRef.current,
        fullscreenVideoContainerRef.current,
        "0px"
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [isViewerFullscreen, connected, streamStatus, videoTrackVersion, videoFitMode]);


  useEffect(() => {
    if (!currentUserId || !stream?.id || !stream.user_id) return;
    if (stream.user_id === currentUserId || stream.visibility === "private") return;

    let joinRequestChannel: any = null;
    let joinRequestPollTimer: ReturnType<typeof setInterval> | null = null;
    let active = true;

    async function loadMyJoinRequest() {
      const { data, error } = await supabase
        .from("stream_join_requests")
        .select("*")
        .eq("stream_id", streamId)
        .eq("requester_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("Join request lookup skipped:", error.message);
        return;
      }

      const latestRequest = (data || null) as StreamJoinRequest | null;
      setJoinRequest(latestRequest);

      if (latestRequest?.status === "accepted") {
        await openAcceptedGuestStudio();
      }

      if (latestRequest?.status === "declined") {
        setStatus("Host declined your request to join.");
      }
    }

    loadMyJoinRequest();

    joinRequestPollTimer = setInterval(() => {
      loadMyJoinRequest();
    }, 2500);

    joinRequestChannel = supabase
      .channel(`watch-join-request-${streamId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stream_join_requests",
          filter: `requester_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const updated = payload.new as StreamJoinRequest;

          if (!updated || updated.stream_id !== streamId) return;

          setJoinRequest(updated);

          if (updated.status === "accepted") {
            await openAcceptedGuestStudio();
          }

          if (updated.status === "declined") {
            setStatus("Host declined your request to join.");
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      if (joinRequestPollTimer) clearInterval(joinRequestPollTimer);
      if (joinRequestChannel) supabase.removeChannel(joinRequestChannel);
    };
  }, [currentUserId, stream?.id, stream?.user_id, stream?.visibility, streamId, router]);

  async function sendMessage() {
    if (!newMessage.trim()) return;

    if (blockedAccess || subscriberBlocked) {
      alert("You cannot chat in this stream.");
      return;
    }

    if (stream?.visibility === "subscribers" && !subscriberAllowed) {
      alert("Only subscribers can chat in this stream.");
      return;
    }

    if (isGlobalMuted) {
      alert("Your account is muted and cannot send chat messages.");
      return;
    }

    if (streamStatus !== "live" || !connected) {
      alert("Chat is only available while the stream is live and connected.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to send messages.");
      router.push("/login");
      return;
    }

    const username = await getSafeDisplayName(user, "Viewer");

    if (isShadowBanned) {
      const fakeMessage: ChatMessage = {
        id: `shadow-${Date.now()}`,
        username,
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
      };

      setMessages((current) => [...current, fakeMessage]);
      setNewMessage("");
      return;
    }

    const { data, error } = await supabase
      .from("stream_chat")
      .insert([
        {
          stream_id: streamId,
          user_id: user.id,
          username,
          message: newMessage.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setMessages((current) => {
        const exists = current.some((item) => item.id === data.id);
        if (exists) return current;
        return [...current, data];
      });
    }

    await incrementDailyAnalytics({ chatMessagesDelta: 1 });

    setNewMessage("");
  }

  async function toggleLike() {
    if (blockedAccess || subscriberBlocked) {
      alert("You cannot like this stream.");
      return;
    }

    if (stream?.visibility === "private") {
      alert("Likes are disabled for private video calls.");
      return;
    }

    if (streamStatus !== "live") {
      alert("You can only like while the stream is live.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to like this stream.");
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.rpc("toggle_stream_like", {
      stream_id_input: streamId,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setLikes(data || 0);

    if (!liked) {
      await incrementDailyAnalytics({ likesDelta: 1 });
    }

    setLiked((current) => !current);
  }

  async function toggleFollowHost() {
    if (!stream?.user_id) {
      alert("Streamer profile not found.");
      return;
    }

    if (blockedAccess) {
      alert("You cannot follow this creator.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to follow this creator.");
      router.push("/login");
      return;
    }

    if (user.id === stream.user_id) {
      alert("You cannot follow yourself.");
      return;
    }

    setFollowLoading(true);

    if (isFollowingHost) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", stream.user_id);

      setFollowLoading(false);

      if (error) {
        alert(error.message);
        return;
      }

      setIsFollowingHost(false);
      return;
    }

    const { error } = await supabase.from("follows").insert([
      {
        follower_id: user.id,
        following_id: stream.user_id,
      },
    ]);

    if (error) {
      setFollowLoading(false);
      alert(error.message);
      return;
    }

    setFollowLoading(false);
    setIsFollowingHost(true);
  }

  async function sendTip() {
    if (!stream?.user_id) {
      alert("Streamer profile not found.");
      return;
    }

    if (blockedAccess || subscriberBlocked) {
      alert("You cannot tip this stream.");
      return;
    }

    if (stream.visibility === "private") {
      alert("Tips are disabled for private video calls.");
      return;
    }

    if (streamStatus !== "live" || !connected) {
      alert("Tips are only available while the stream is live and connected.");
      return;
    }

    const amount =
      selectedTipAmount === "custom"
        ? Number(customTipAmount)
        : Number(selectedTipAmount);

    if (!amount || amount < 5) {
      alert("Minimum tip amount is USD 5.");
      return;
    }

    if (amount > 5000) {
      alert("Maximum tip amount is USD 5,000.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to send a tip.");
      router.push("/login");
      return;
    }

    if (user.id === stream.user_id) {
      alert("You cannot tip your own stream.");
      return;
    }

    const confirmed = confirm(`Send USD ${amount} tip?`);

    if (!confirmed) return;

    setTipSubmitting(true);

    const { error } = await supabase.rpc("create_manual_tip", {
      target_stream_id: stream.id,
      target_creator_id: stream.user_id,
      tip_amount_usd: amount,
      tip_message: tipMessage.trim() || null,
    });

    if (error) {
      setTipSubmitting(false);
      alert(error.message || "Failed to send tip.");
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: stream.user_id,
        type: "tip_received",
        title: "New Tip Received",
        message: `You received USD ${amount} on "${
          stream.title || "your stream"
        }". Creator wallet updated.`,
        link: "/wallet",
        is_read: false,
      },
    ]);

    const tipperName = await getSafeDisplayName(user, "A viewer");

    setMessages((current) => [
      ...current,
      {
        id: `tip-${Date.now()}`,
        username: "StreamHub",
        message: `${tipperName} sent USD ${amount} tip!`,
        created_at: new Date().toISOString(),
      },
    ]);

    setTipSubmitting(false);
    setTipOpen(false);
    setTipMessage("");
    setCustomTipAmount("");
    setSelectedTipAmount(10);

    alert("Tip sent successfully.");
  }

  async function enableAudioManually() {
    try {
      await Promise.all(
        audioElementsRef.current.map((audio) => {
          audio.muted = false;
          audio.volume = 1;
          return audio.play();
        })
      );

      setAudioBlocked(false);
    } catch (error) {
      console.error("Enable audio failed:", error);
      alert("Browser blocked audio. Click the video area and try again.");
    }
  }

  function openHostProfile() {
    if (!host?.id) {
      alert("Streamer profile not found.");
      return;
    }

    router.push(`/profile/${host.id}`);
  }

  async function requestToJoinStream() {
    if (!stream?.id || !stream.user_id) {
      alert("Stream not ready.");
      return;
    }

    if (stream.visibility === "private") {
      alert("Private calls do not support public join requests.");
      return;
    }

    if (streamStatus !== "live" || !connected) {
      alert("You can request to join only while the stream is live.");
      return;
    }

    if (blockedAccess || subscriberBlocked) {
      alert("You cannot request to join this stream.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login to request joining this live.");
      router.push("/login");
      return;
    }

    if (user.id === stream.user_id) {
      alert("You are the host of this stream.");
      return;
    }

    if (joinRequest?.status === "pending") {
      alert("Your request is already pending.");
      return;
    }

    setJoinRequestLoading(true);

    const { data, error } = await supabase
      .from("stream_join_requests")
      .insert([
        {
          stream_id: stream.id,
          requester_id: user.id,
          host_id: stream.user_id,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) {
      setJoinRequestLoading(false);
      alert(error.message);
      return;
    }

    setJoinRequest((data || null) as StreamJoinRequest | null);

    const requesterName = await getSafeDisplayName(user, "A viewer");

    await supabase.from("notifications").insert([
      {
        user_id: stream.user_id,
        type: "stream_join_request",
        title: "Viewer wants to join",
        message: `${requesterName} requested to join "${stream.title || "your live stream"}".`,
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
            userId: stream.user_id,
            title: "Viewer wants to join",
            message: `${requesterName} requested to join your live stream.`,
            url: `/live/${stream.id}`,
            streamId: stream.id,
            notificationType: "stream_join_request",
          }),
        });
      } catch (pushError) {
        console.error("Join request push failed:", pushError);
      }
    }

    setJoinRequestLoading(false);
    setStatus("Request sent. Waiting for host approval...");
  }

  const hostName =
    host?.display_name ||
    host?.username ||
    stream?.user_id ||
    "StreamHub Creator";

  const showFollowButton =
    !!stream?.user_id &&
    !!currentUserId &&
    stream.user_id !== currentUserId &&
    stream.visibility !== "private" &&
    !blockedAccess;

  const showJoinRequestButton =
    !!stream?.user_id &&
    !!currentUserId &&
    stream.user_id !== currentUserId &&
    stream.visibility !== "private" &&
    streamStatus === "live" &&
    connected &&
    !blockedAccess &&
    !subscriberBlocked;

  const joinRequestButtonLabel =
    joinRequestLoading
      ? "..."
      : joinRequest?.status === "pending"
        ? "Pending"
        : joinRequest?.status === "accepted"
          ? "Join"
          : joinRequest?.status === "declined"
            ? "Request"
            : "Request";

  const chatDisabled =
    streamStatus !== "live" ||
    !connected ||
    blockedAccess ||
    subscriberBlocked ||
    isGlobalMuted;

  if (blockedAccess) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-red-500/20 bg-red-950/20 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              â›”
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-red-400 sm:text-sm">
              Access Restricted
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              {stream?.is_suspended
                ? "Stream Suspended"
                : "You Cannot Watch This Stream"}
            </h1>

            <p className="mt-4 text-sm text-white/55 sm:text-base">{status}</p>

            <button
              onClick={() => router.push("/explore")}
              className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 font-bold text-white/75 hover:bg-white/10 sm:w-auto"
            >
              Back to Explore
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (subscriberBlocked) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-yellow-500/20 bg-yellow-950/10 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-yellow-500/20 bg-yellow-500/10 text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              â­
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-yellow-300 sm:text-sm">
              Subscribers Only
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              {stream?.title || "Premium Stream"}
            </h1>

            <p className="mt-4 text-sm text-white/55 sm:text-base">{status}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {stream?.user_id && (
                <button
                  onClick={() => router.push(`/profile/${stream.user_id}`)}
                  className="rounded-2xl bg-yellow-500 px-6 py-3 font-black text-black hover:bg-yellow-400"
                >
                  Subscribe to Watch
                </button>
              )}

              <button
                onClick={() => router.push("/explore")}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 font-bold text-white/75 hover:bg-white/10"
              >
                Back to Explore
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (privateBlocked) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-purple-500/20 bg-purple-950/10 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              ðŸ”’
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-purple-400 sm:text-sm">
              Paid Private Video Call
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              {stream?.title || "Private Stream"}
            </h1>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/45">Call Price</p>
              <p className="mt-1 text-3xl font-black text-purple-300">
                {privateCallPrice > 0 ? `$${privateCallPrice}` : "Free"}
              </p>

              <p
                className={
                  privatePaymentCompleted
                    ? "mt-3 text-sm font-bold text-green-400"
                    : "mt-3 text-sm font-bold text-yellow-300"
                }
              >
                {privatePaymentCompleted
                  ? "Payment confirmed / access allowed"
                  : privateCallPrice > 0
                  ? "Payment required before joining"
                  : "Invite required before joining"}
              </p>
            </div>

            <p className="mt-4 text-sm text-white/55 sm:text-base">{status}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => router.push("/calls")}
                className="rounded-2xl bg-purple-600 px-6 py-3 font-black text-white hover:bg-purple-500"
              >
                Open Calls
              </button>

              <button
                onClick={() => router.push("/explore")}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 font-bold text-white/75 hover:bg-white/10"
              >
                Back to Explore
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {isViewerFullscreen && (
        <div className="fixed inset-0 z-[2147483647] bg-black text-white">
          <div className="relative h-[100dvh] w-screen overflow-hidden bg-black">
            <div
              ref={fullscreenVideoContainerRef}
              className="absolute inset-0 flex h-full w-full items-center justify-center bg-black"
            >
              <div className="px-5 text-center">
                <p className="text-base font-semibold text-white/80 sm:text-lg">
                  {status}
                </p>
                <p className="mt-2 text-xs text-white/40 sm:text-sm">
                  Waiting for broadcaster video...
                </p>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent px-4 pb-16 pt-[calc(18px+env(safe-area-inset-top))]">
              <div className="pointer-events-auto flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wide text-red-400">
                    Live Viewer Mode
                  </p>
                  <h2 className="truncate text-lg font-black sm:text-2xl">
                    {stream?.title || "Live Stream"}
                  </h2>
                  <p className="truncate text-xs text-white/55">
                    {hostName} . {connected ? "Connected" : "Reconnecting"}
                  </p>
                </div>

                <button
                  onClick={closeViewerFullscreen}
                  className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  Exit
                </button>
              </div>
            </div>

            {(showJoinRequestButton ||
              joinRequest?.status === "pending" ||
              joinRequest?.status === "accepted" ||
              joinRequest?.status === "declined") && (
              <div className="pointer-events-none absolute right-3 top-[calc(92px+env(safe-area-inset-top))] z-[75] sm:right-5 sm:top-[calc(104px+env(safe-area-inset-top))]">
                <button
                  onClick={() => {
                    if (joinRequest?.status === "accepted") {
                      router.push(`/live/${streamId}`);
                      return;
                    }

                    requestToJoinStream();
                  }}
                  disabled={
                    joinRequestLoading ||
                    joinRequest?.status === "pending" ||
                    streamStatus !== "live" ||
                    !connected
                  }
                  className="pointer-events-auto rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-black text-white shadow-2xl backdrop-blur-md hover:bg-black/75 disabled:cursor-not-allowed disabled:text-white/45 sm:px-4 sm:py-2 sm:text-sm"
                >
                  {joinRequest?.status === "accepted" ? "Join" : joinRequestButtonLabel}
                </button>
              </div>
            )}

            {fullscreenChatOpen && (
              <div className="absolute inset-x-3 bottom-24 max-h-[48dvh] overflow-hidden rounded-3xl border border-white/10 bg-black/70 p-3 backdrop-blur-xl sm:left-auto sm:right-5 sm:w-[380px]">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-black">Live Chat</h3>
                  <button
                    onClick={() => setFullscreenChatOpen(false)}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>

                <div className="max-h-[32dvh] space-y-2 overflow-auto pr-1">
                  {messages.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/45">
                      No messages yet.
                    </p>
                  ) : (
                    messages.slice(-40).map((msg) => (
                      <div key={msg.id} className="rounded-2xl bg-white/10 p-2">
                        <p className="truncate text-xs font-bold text-red-400">
                          {msg.username}
                        </p>
                        <p className="break-words text-sm leading-5 text-white/85">
                          {msg.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendMessage();
                    }}
                    placeholder={chatDisabled ? "Chat unavailable" : "Type a message..."}
                    disabled={chatDisabled}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-red-500 disabled:text-white/30"
                  />

                  <button
                    onClick={sendMessage}
                    disabled={chatDisabled}
                    className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500 disabled:bg-white/10 disabled:text-white/35"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-16">
              <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
                <button
                  onClick={toggleLike}
                  disabled={streamStatus !== "live" || blockedAccess}
                  className={`rounded-full px-4 py-3 text-sm font-black backdrop-blur ${
                    liked
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-red-600 text-white hover:bg-red-500"
                  } disabled:bg-white/10 disabled:text-white/35`}
                >
                  {liked ? "Liked" : "Like"}
                </button>

                <button
                  onClick={() => setFullscreenChatOpen((current) => !current)}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  Chat {messages.length > 0 ? `(${messages.length})` : ""}
                </button>

                {audioBlocked && (
                  <button
                    onClick={enableAudioManually}
                    className="rounded-full bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500"
                  >
                    Audio
                  </button>
                )}

                <div className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur">
                  Viewers {viewerCount}
                </div>



                <button
                  onClick={closeViewerFullscreen}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black backdrop-blur hover:bg-white/20"
                >
                  Exit Fullscreen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {tipOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-2xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-sm font-bold text-yellow-400">
                    Support Creator
                  </p>
                  <h2 className="text-2xl font-black">Send a Tip</h2>
                </div>

                <button
                  onClick={() => setTipOpen(false)}
                  className="rounded-xl bg-white/10 px-3 py-2 font-bold text-white/70 hover:bg-white/20"
                >
                  Close
                </button>
              </div>

              <div className="mb-5 grid grid-cols-4 gap-2">
                {[5, 10, 25, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setSelectedTipAmount(amount)}
                    className={`rounded-xl px-3 py-3 text-sm font-black ${
                      selectedTipAmount === amount
                        ? "bg-yellow-500 text-black"
                        : "bg-black/40 text-white hover:bg-white/10"
                    }`}
                  >
                    USD {amount}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedTipAmount("custom")}
                className={`mb-3 w-full rounded-xl px-4 py-3 text-sm font-black ${
                  selectedTipAmount === "custom"
                    ? "bg-yellow-500 text-black"
                    : "bg-black/40 text-white hover:bg-white/10"
                }`}
              >
                Custom Amount
              </button>

              {selectedTipAmount === "custom" && (
                <input
                  type="number"
                  min="5"
                  max="5000"
                  value={customTipAmount}
                  onChange={(e) => setCustomTipAmount(e.target.value)}
                  placeholder="Enter amount in USD"
                  className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-yellow-500"
                />
              )}

              <textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Optional message to creator..."
                rows={3}
                className="mb-5 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-yellow-500"
              />

              <button
                onClick={sendTip}
                disabled={tipSubmitting}
                className="w-full rounded-xl bg-yellow-500 px-5 py-3 font-black text-black hover:bg-yellow-400 disabled:bg-white/10 disabled:text-white/35"
              >
                {tipSubmitting ? "Submitting..." : "Send Tip"}
              </button>
            </div>
          </div>
        )}

        <section className="relative">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-2xl sm:rounded-[28px]">
              <div
                ref={videoContainerRef}
                className="relative flex h-[100dvh] items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black"
              >
                <div className="relative px-5 text-center">
                  <p className="text-base font-semibold text-white/80 sm:text-lg">
                    {status}
                  </p>
                  <p className="mt-2 text-xs text-white/40 sm:text-sm">
                    {streamStatus === "live"
                      ? "Waiting for broadcaster video..."
                      : "Offline streams cannot be watched."}
                  </p>
                </div>
              </div>

              {(showJoinRequestButton ||
                joinRequest?.status === "pending" ||
                joinRequest?.status === "accepted" ||
                joinRequest?.status === "declined") && (
                <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
                  <button
                    onClick={() => {
                      if (joinRequest?.status === "accepted") {
                        router.push(`/live/${streamId}`);
                        return;
                      }

                      requestToJoinStream();
                    }}
                    disabled={
                      joinRequestLoading ||
                      joinRequest?.status === "pending" ||
                      streamStatus !== "live" ||
                      !connected
                    }
                    className="pointer-events-auto rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-black text-white shadow-2xl backdrop-blur-md hover:bg-black/75 disabled:cursor-not-allowed disabled:text-white/45 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {joinRequest?.status === "accepted" ? "Join" : joinRequestButtonLabel}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:mt-5 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div
                  onClick={openHostProfile}
                  className="flex min-w-0 cursor-pointer items-center gap-3 sm:gap-4"
                >
                  <img
                    src={host?.avatar_url || "/default-avatar.png"}
                    alt={hostName}
                    className="h-12 w-12 rounded-2xl border border-white/10 object-cover sm:h-14 sm:w-14"
                  />

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-bold hover:text-red-400">
                        {hostName}
                      </p>
                      {host?.is_verified && (
                        <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-white/45">
                      @{host?.username || "streamhub"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  {showFollowButton && (
                    <button
                      onClick={toggleFollowHost}
                      disabled={followLoading}
                      className={`rounded-2xl px-4 py-3 text-sm font-bold transition sm:px-6 ${
                        isFollowingHost
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-purple-600 text-white hover:bg-purple-500"
                      } disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35`}
                    >
                      {followLoading
                        ? "Wait..."
                        : isFollowingHost
                        ? "Following ✓"
                        : "Follow +"}
                    </button>
                  )}

                  {stream?.user_id && currentUserId !== stream.user_id && (
                    <BlockUserButton
                      targetUserId={stream.user_id}
                      onBlocked={() => {
                        setBlockedAccess(true);
                        setStatus("You blocked this creator.");
                      }}
                    />
                  )}

                  {audioBlocked && (
                    <button
                      onClick={enableAudioManually}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 sm:px-6"
                    >
                      Enable Audio
                    </button>
                  )}

                  <button
                    onClick={openViewerFullscreen}
                    disabled={streamStatus !== "live" || !connected || blockedAccess}
                    className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:text-white/35 sm:px-6"
                  >
                    Fullscreen
                  </button>

                  {showJoinRequestButton && (
                    <button
                      onClick={requestToJoinStream}
                      disabled={
                        joinRequestLoading ||
                        joinRequest?.status === "pending" ||
                        joinRequest?.status === "accepted"
                      }
                      className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 sm:px-6"
                    >
                      {joinRequestButtonLabel}
                    </button>
                  )}

                  <button
                    onClick={toggleLike}
                    disabled={streamStatus !== "live" || blockedAccess}
                    className={`rounded-2xl px-4 py-3 text-sm font-bold transition sm:px-6 ${
                      streamStatus === "live" && !blockedAccess
                        ? liked
                          ? "bg-white text-black hover:bg-white/90"
                          : "bg-red-600 text-white hover:bg-red-500"
                        : "cursor-not-allowed bg-white/10 text-white/35"
                    }`}
                  >
                    {liked ? "Liked" : "Like"}
                  </button>

                  {stream?.user_id &&
                    currentUserId !== stream.user_id &&
                    stream.visibility !== "private" && (
                      <button
                        onClick={() => setTipOpen(true)}
                        disabled={
                          streamStatus !== "live" ||
                          !connected ||
                          blockedAccess
                        }
                        className={`rounded-2xl px-4 py-3 text-sm font-bold transition sm:px-6 ${
                          streamStatus === "live" &&
                          connected &&
                          !blockedAccess
                            ? "bg-yellow-500 text-black hover:bg-yellow-400"
                            : "cursor-not-allowed bg-white/10 text-white/35"
                        }`}
                      >
                        Tip 💰
                      </button>
                    )}

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:px-5">
                    <p className="text-xs text-white/40">Likes</p>
                    <p className="text-lg font-black">{likes}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="flex h-[560px] flex-col rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur-xl sm:rounded-[28px] sm:p-5 lg:h-[720px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black sm:text-3xl lg:text-2xl">
                  Live Chat
                </h2>
                <p className="text-xs text-white/45 sm:text-sm">
                  {stream?.visibility === "subscribers"
                    ? "Subscriber-only chat"
                    : isGlobalMuted
                    ? "Your account is globally muted."
                    : isShadowBanned
                    ? "Messages appear sent but are hidden from others."
                    : "Real-time stream conversation"}
                </p>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                {messages.length}
              </span>
            </div>

            <div
              ref={chatBoxRef}
              className="mb-3 flex-1 space-y-3 overflow-auto rounded-3xl border border-white/10 bg-black/30 p-3 sm:mb-4 sm:p-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="text-lg font-bold text-white/70">
                      No messages yet
                    </p>
                    <p className="mt-1 text-sm text-white/40">
                      Be the first to say something.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-red-400">
                        {msg.username}
                      </p>

                      <p className="shrink-0 text-[11px] text-white/30">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <p className="break-words text-sm leading-6 text-white/85">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 bg-transparent">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder={
                  isGlobalMuted
                    ? "Your account is muted"
                    : streamStatus === "live" && connected
                    ? "Type a message..."
                    : "Chat is available when stream is live and connected"
                }
                disabled={chatDisabled}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-red-500 disabled:cursor-not-allowed disabled:text-white/30"
              />

              <button
                onClick={sendMessage}
                disabled={chatDisabled}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 sm:px-5"
              >
                Send
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}




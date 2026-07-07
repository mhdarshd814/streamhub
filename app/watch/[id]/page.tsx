"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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

  async function submitReport() {
    if (reportSubmitting || !stream?.id) return;

    if (!reportReason) {
      alert("Please select a reason for this report.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setReportSubmitting(true);

    const { error } = await supabase.from("stream_reports").insert({
      stream_id: stream.id,
      reporter_id: user.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
      status: "pending",
    });

    setReportSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setReportOpen(false);
    setReportReason("");
    setReportDetails("");
    alert("Report submitted. Thank you — our team will review this.");
  }

  const [tipOpen, setTipOpen] = useState(false);
  const [selectedTipAmount, setSelectedTipAmount] = useState<number | "custom">(
    10
  );
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // TikTok-style overlay is now the default viewing experience (was
  // previously opt-in via a "Fullscreen" button). This reuses the
  // existing, fully-working overlay - no new layout logic added.
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(true);
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
  }

  // The overlay is now the default view (isViewerFullscreen starts true),
  // so the class-adding and video-attach side effects that used to live
  // only inside openViewerFullscreen() must run whenever the overlay is
  // active - including on initial mount, not just on a manual trigger.
  useEffect(() => {
    if (!isViewerFullscreen) return;

    document.documentElement.classList.add("streamhub-theater-mode");
    document.body.classList.add("streamhub-theater-mode");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const attachTimer = setTimeout(() => {
      attachVideoTrackToContainer(
        remoteVideoTrackRef.current,
        fullscreenVideoContainerRef.current,
        "0px"
      );
    }, 100);

    return () => clearTimeout(attachTimer);
  }, [isViewerFullscreen, connected, streamStatus]);

  function closeViewerFullscreen() {
    document.documentElement.classList.remove("streamhub-theater-mode");
    document.body.classList.remove("streamhub-theater-mode");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";

    // The overlay is the only viewing experience now, so "Exit" leaves
    // the stream rather than falling back to the old boxed layout.
    router.push("/live-feed");
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
      <main className="min-h-screen bg-canvas text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-danger/20 bg-danger-soft p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-danger/20 bg-danger-soft text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              â›”
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-accent sm:text-sm">
              Access Restricted
            </p>

            <h1 className="font-display text-3xl font-black sm:text-4xl">
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
      <main className="min-h-screen bg-canvas text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-warning/20 bg-warning-soft p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-warning/20 bg-warning-soft text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              â­
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-warning sm:text-sm">
              Subscribers Only
            </p>

            <h1 className="font-display text-3xl font-black sm:text-4xl">
              {stream?.title || "Premium Stream"}
            </h1>

            <p className="mt-4 text-sm text-white/55 sm:text-base">{status}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {stream?.user_id && (
                <button
                  onClick={() => router.push(`/profile/${stream.user_id}`)}
                  className="rounded-2xl bg-warning px-6 py-3 font-black text-black hover:brightness-90"
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
      <main className="min-h-screen bg-canvas text-white">
        <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-accent/20 bg-accent-soft p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-3xl sm:h-20 sm:w-20 sm:text-4xl">
              ðŸ”’
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-accent sm:text-sm">
              Paid Private Video Call
            </p>

            <h1 className="font-display text-3xl font-black sm:text-4xl">
              {stream?.title || "Private Stream"}
            </h1>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/45">Call Price</p>
              <p className="font-display mt-1 text-3xl font-black text-accent">
                {privateCallPrice > 0 ? `$${privateCallPrice}` : "Free"}
              </p>

              <p
                className={
                  privatePaymentCompleted
                    ? "mt-3 text-sm font-bold text-success"
                    : "mt-3 text-sm font-bold text-warning"
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
                className="rounded-2xl bg-accent px-6 py-3 font-black text-white hover:bg-accent-hover"
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
    <main className="min-h-screen bg-canvas text-white">
      {isViewerFullscreen && (
        <div className="fixed inset-0 z-[2147483647] bg-canvas text-white">
          <div className="relative h-[100dvh] w-screen overflow-hidden bg-canvas">
            <div
              ref={fullscreenVideoContainerRef}
              className="absolute inset-0 flex h-full w-full items-center justify-center bg-canvas"
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

            {/* Top bar: minimal, TikTok-style — just an exit/back button and
                the viewer count. Title/host status live in the bottom-left
                caption block below, next to the video, not up here. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[calc(12px+env(safe-area-inset-top))]">
              <div className="pointer-events-auto flex items-center justify-between">
                <button
                  onClick={closeViewerFullscreen}
                  aria-label="Exit stream"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M15 18L9 12L15 6" />
                  </svg>
                </button>

                <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                  {viewerCount.toLocaleString()} watching
                </span>
              </div>
            </div>

            {(showJoinRequestButton ||
              joinRequest?.status === "pending" ||
              joinRequest?.status === "accepted" ||
              joinRequest?.status === "declined") && (
              <div className="pointer-events-none absolute right-3 top-[calc(68px+env(safe-area-inset-top))] z-[75] sm:right-5 sm:top-[calc(76px+env(safe-area-inset-top))]">
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
              <div
                className="fixed inset-x-3 z-[2147483647] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/25 backdrop-blur-2xl sm:left-auto sm:right-5 sm:w-[300px]"
                style={{
                  // Fixed pixel height (not dvh, not absolute positioning) -
                  // both proved unreliable in this WebView. A hard px height
                  // + overflow:hidden guarantees the input row can never be
                  // pushed out of view or overlap anything below it,
                  // regardless of how many messages arrive. Kept small on
                  // purpose so it covers as little of the video as possible.
                  height: "220px",
                  bottom: "calc(220px + env(safe-area-inset-bottom))",
                  overflow: "hidden",
                }}
              >
                <div className="flex shrink-0 items-center justify-between px-3 pt-3">
                  <h3 className="text-sm font-black text-white/90">Live Chat</h3>
                  <button
                    onClick={() => setFullscreenChatOpen(false)}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
                  {messages.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/45">
                      No messages yet.
                    </p>
                  ) : (
                    messages.slice(-40).map((msg) => (
                      <div key={msg.id} className="max-w-[92%] rounded-2xl bg-black/35 px-2.5 py-1.5">
                        <span className="mr-1.5 text-xs font-bold text-accent">
                          {msg.username}
                        </span>
                        <span className="break-words text-sm leading-5 text-white/90">
                          {msg.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex shrink-0 gap-2 p-3 pt-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendMessage();
                    }}
                    placeholder={chatDisabled ? "Chat unavailable" : "Type a message..."}
                    disabled={chatDisabled}
                    className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none backdrop-blur-md placeholder:text-white/40 focus:border-accent disabled:text-white/30"
                  />

                  <button
                    onClick={sendMessage}
                    disabled={chatDisabled}
                    className="shrink-0 rounded-2xl bg-accent px-4 py-2 text-sm font-bold hover:bg-accent-hover disabled:bg-white/10 disabled:text-white/35"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Bottom: TikTok-style caption (bottom-left, title/host/live
                badge) + a vertical action rail on the right edge (avatar
                with follow badge, like, tip, chat, audio, block, report).
                Same handlers/state as before — layout only. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-24">
              <div className="pointer-events-auto min-w-0 flex-1">
                <span className="badge-live mb-2 inline-flex backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
                <h2 className="font-display truncate text-lg font-black sm:text-2xl">
                  {stream?.title || "Live Stream"}
                </h2>
                <p className="mt-1 truncate text-sm text-white/70">
                  {hostName} · {connected ? "Connected" : "Reconnecting"}
                </p>
              </div>

              <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-2">
                {showFollowButton && (
                  <div className="relative">
                    <button
                      onClick={openHostProfile}
                      aria-label={`View ${hostName}'s profile`}
                      className="avatar relative h-12 w-12 border-2 border-white/60"
                    >
                      {host?.avatar_url ? (
                        <Image
                          src={host.avatar_url}
                          alt={hostName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xl">👤</span>
                      )}
                    </button>
                    <button
                      onClick={toggleFollowHost}
                      disabled={followLoading}
                      aria-label={isFollowingHost ? "Unfollow" : "Follow"}
                      className={`absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-xs font-black text-white disabled:opacity-50 ${
                        isFollowingHost ? "bg-success" : "bg-accent"
                      }`}
                    >
                      {isFollowingHost ? "✓" : "+"}
                    </button>
                  </div>
                )}

                <RailButton
                  onClick={toggleLike}
                  disabled={streamStatus !== "live" || blockedAccess}
                  active={liked}
                  label={likes > 0 ? String(likes) : "Like"}
                  ariaLabel={liked ? "Unlike" : "Like"}
                  icon={
                    <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-9.5-8.5C.8 8.7 2.6 5 6.2 5c2 0 3.6 1.2 4.1 2.6.5-1.4 2.1-2.6 4.1-2.6 3.6 0 5.4 3.7 3.7 7.5C19 16.65 12 21 12 21z" />
                    </svg>
                  }
                />

                {stream?.user_id &&
                  currentUserId !== stream.user_id &&
                  stream.visibility !== "private" && (
                    <RailButton
                      onClick={() => setTipOpen(true)}
                      disabled={streamStatus !== "live" || !connected || blockedAccess}
                      label="Tip"
                      ariaLabel="Send a tip"
                      icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                          <rect x="3" y="8" width="18" height="13" rx="1.5" />
                          <path d="M3 12h18M12 21V8M7.5 8a2.5 2.5 0 010-5C10.5 3 12 8 12 8s1.5-5 4.5-5a2.5 2.5 0 010 5" />
                        </svg>
                      }
                    />
                  )}

                <RailButton
                  onClick={() => setFullscreenChatOpen((current) => !current)}
                  label={messages.length > 0 ? String(messages.length) : "Chat"}
                  ariaLabel="Toggle live chat"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                  }
                />

                {audioBlocked && (
                  <RailButton
                    onClick={enableAudioManually}
                    label="Audio"
                    ariaLabel="Enable audio"
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                        <path d="M11 5L6 9H2v6h4l5 4V5z" />
                        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                      </svg>
                    }
                  />
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

                {stream?.user_id && currentUserId !== stream.user_id && (
                  <RailButton
                    onClick={() => setReportOpen(true)}
                    label="Report"
                    ariaLabel="Report this stream"
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                    }
                  />
                )}
              </div>
            </div>

            {reportOpen && (
              <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-sm rounded-3xl border border-hairline-strong bg-surface p-5">
                  <h3 className="mb-1 text-lg font-black text-white">Report this stream</h3>
                  <p className="mb-4 text-sm text-muted">
                    Our team will review this. Reports are anonymous to the creator.
                  </p>

                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    Reason
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="mb-3 w-full rounded-xl border border-hairline bg-canvas p-3 text-white outline-none focus:border-accent"
                  >
                    <option value="">Select a reason</option>
                    <option value="Nudity or sexual content">Nudity or sexual content</option>
                    <option value="Harassment or bullying">Harassment or bullying</option>
                    <option value="Violence or dangerous acts">Violence or dangerous acts</option>
                    <option value="Hate speech">Hate speech</option>
                    <option value="Spam or scam">Spam or scam</option>
                    <option value="Underage user">Underage user</option>
                    <option value="Other">Other</option>
                  </select>

                  <label className="mb-1.5 block text-xs font-bold text-muted">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Anything else we should know?"
                    className="mb-4 h-20 w-full resize-none rounded-xl border border-hairline bg-canvas p-3 text-sm text-white outline-none focus:border-accent"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setReportOpen(false);
                        setReportReason("");
                        setReportDetails("");
                      }}
                      className="btn-secondary flex-1 rounded-full"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={reportSubmitting}
                      className="btn-danger flex-1 rounded-full"
                    >
                      {reportSubmitting ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {tipOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-md rounded-3xl border border-hairline-strong bg-surface p-5 shadow-2xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-1">
                    Support Creator
                  </p>
                  <h2 className="font-display text-2xl font-black">Send a Tip</h2>
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
                        ? "bg-warning text-black"
                        : "bg-canvas/40 text-white hover:bg-surface-raised"
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
                    ? "bg-warning text-black"
                    : "bg-canvas/40 text-white hover:bg-surface-raised"
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
                  className="mb-4 w-full rounded-xl border border-hairline bg-canvas/40 px-4 py-3 text-white outline-none focus:border-warning"
                />
              )}

              <textarea
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                placeholder="Optional message to creator..."
                rows={3}
                className="mb-5 w-full resize-none rounded-xl border border-hairline bg-canvas/40 px-4 py-3 text-white outline-none placeholder:text-faint focus:border-warning"
              />

              <button
                onClick={sendTip}
                disabled={tipSubmitting}
                className="w-full rounded-xl bg-warning px-5 py-3 font-black text-black shadow-lg shadow-warning/30 hover:brightness-90 disabled:bg-white/10 disabled:text-white/35"
              >
                {tipSubmitting ? "Submitting..." : "Send Tip"}
              </button>
            </div>
          </div>
        )}

        <section className="relative lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-2xl sm:rounded-[28px]">
              <div
                ref={videoContainerRef}
                className="relative flex h-[100dvh] items-center justify-center bg-gradient-to-br from-surface via-surface-raised to-canvas lg:h-[720px]"
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
                  <Image
                    src={host?.avatar_url || "/default-avatar.png"}
                    alt={hostName}
                    width={56}
                    height={56}
                    className="h-12 w-12 rounded-2xl border border-white/10 object-cover sm:h-14 sm:w-14"
                  />

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-bold hover:text-accent">
                        {hostName}
                      </p>
                      {host?.is_verified && (
                        <span className="shrink-0 rounded-full bg-info px-2 py-0.5 text-xs font-black">
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
                          : "bg-accent text-white hover:bg-accent-hover"
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
                      className="rounded-2xl bg-info px-4 py-3 text-sm font-bold text-white transition hover:brightness-90 sm:px-6"
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
                      className="rounded-2xl bg-success px-4 py-3 text-sm font-black text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 sm:px-6"
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
                          : "bg-accent text-white hover:bg-accent-hover"
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
                            ? "bg-warning text-black shadow-lg shadow-warning/30 hover:brightness-90"
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

          <aside className="mt-4 flex h-[560px] flex-col rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur-xl sm:mt-5 sm:rounded-[28px] sm:p-5 lg:mt-0 lg:h-[720px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-black sm:text-3xl lg:text-2xl">
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
                      <p className="truncate text-sm font-bold text-accent">
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
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-accent disabled:cursor-not-allowed disabled:text-white/30"
              />

              <button
                onClick={sendMessage}
                disabled={chatDisabled}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-bold transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 sm:px-5"
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

function RailButton({
  onClick,
  disabled,
  active,
  label,
  ariaLabel,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex flex-col items-center gap-1 disabled:opacity-40"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur ${
          active ? "bg-accent text-white" : "bg-black/40 text-white hover:bg-black/60"
        }`}
      >
        {icon}
      </span>
      <span className="text-xs font-bold text-white drop-shadow">{label}</span>
    </button>
  );
}

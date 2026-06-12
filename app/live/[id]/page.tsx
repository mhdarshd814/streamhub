"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Room, RoomEvent, Track } from "livekit-client";
import { supabase } from "../../../lib/supabase";

type Stream = {
  id: string;
  title: string;
  category: string;
  status: string;
  visibility?: "public" | "private" | "subscribers";
  viewers: number;
  likes: number;
  user_id: string;
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
  const [role, setRole] = useState<"host" | "guest" | "blocked">("blocked");
  const [pendingInvite, setPendingInvite] = useState<StreamGuest | null>(null);

  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const [isShadowBanned, setIsShadowBanned] = useState(false);

  const [guestInput, setGuestInput] = useState("");
  const [guestInvites, setGuestInvites] = useState<StreamGuest[]>([]);
  const [creatorResults, setCreatorResults] = useState<Profile[]>([]);
  const [creatorSearching, setCreatorSearching] = useState(false);
  const [inviteSendingId, setInviteSendingId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const remoteAudioElementsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    let chatChannel: any;
    let streamChannel: any;
    let guestChannel: any;
    let viewerChannel: any;

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
      } else {
        const { data: invite } = await supabase
          .from("stream_guests")
          .select("*")
          .eq("stream_id", streamId)
          .eq("guest_id", user.id)
          .in("status", ["pending", "accepted"])
          .maybeSingle();

        if (!invite) {
          setRole("blocked");
          setStatusText("You are not invited to join this stream.");
          return;
        }

        setRole("guest");

        if (invite.status === "pending") {
          setPendingInvite(invite);
          setStatusText("You have been invited as a guest streamer.");
          return;
        }

        setStatusText("Guest studio ready.");
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
          }
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
                current.filter((item) => item.id !== deletedMessage.id)
              );
            }
          }
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
          }
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
          }
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
          }
        )
        .subscribe();
    }

    loadData();

    return () => {
      if (chatChannel) supabase.removeChannel(chatChannel);
      if (streamChannel) supabase.removeChannel(streamChannel);
      if (guestChannel) supabase.removeChannel(guestChannel);
      if (viewerChannel) supabase.removeChannel(viewerChannel);

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
    if (role !== "host") return;

    const timer = setTimeout(() => {
      searchCreators();
    }, 350);

    return () => clearTimeout(timer);
  }, [guestInput, role, currentUserId, guestInvites]);

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
      throw new Error(data.error || "Failed to remove participant from LiveKit");
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
      `
      )
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false });

    setGuestInvites((data || []) as StreamGuest[]);
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
      .filter((invite) => invite.status !== "removed")
      .map((invite) => invite.guest_id);

    const filtered = (data || []).filter(
      (profile) =>
        profile.id !== currentUserId &&
        !profile.is_banned &&
        !alreadyInvitedIds.includes(profile.id)
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

    if (status === "live" && !wasAlreadyLive && stream.visibility !== "private") {
      await sendStreamStartedNotifications();
    }

    setStream({
      ...stream,
      status,
      viewers: status === "offline" ? 0 : stream.viewers,
    });

    setIsLive(status === "live");
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

    const [{ data: followers }, { data: subscribers }] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", currentUserId),
      supabase
        .from("creator_subscriptions")
        .select("subscriber_id")
        .eq("creator_id", currentUserId)
        .eq("status", "active"),
    ]);

    const recipientIds = new Set<string>();

    (followers || []).forEach((item: any) => {
      if (item.follower_id && item.follower_id !== currentUserId) {
        recipientIds.add(item.follower_id);
      }
    });

    (subscribers || []).forEach((item: any) => {
      if (item.subscriber_id && item.subscriber_id !== currentUserId) {
        recipientIds.add(item.subscriber_id);
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

    const notifications = recipients.map((userId) => ({
      user_id: userId,
      type: "stream_started",
      title,
      message,
      link: `/watch/${stream.id}`,
      is_read: false,
    }));

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notificationError) {
      console.error("Stream notification error:", notificationError.message);
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
              url: `/watch/${stream.id}`,
            }),
          });
        } catch (error) {
          console.error("Push send failed:", error);
        }
      })
    );
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

      const participantName =
        role + "-" + (user.user_metadata?.username || user.email || "Streamer");

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

      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        permissionStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError: any) {
        alert(
          "Camera or microphone permission was denied. Please allow both camera and microphone access in your browser, then try again."
        );
        throw permissionError;
      }

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          attachRemoteAudio(track);
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        try {
          track.detach().forEach((element) => element.remove());
        } catch (error) {
          console.error(error);
        }
      });

      newRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log("Local track published:", publication.kind);
      });

      await newRoom.connect(livekitUrl, tokenData.token);

      await newRoom.localParticipant.setCameraEnabled(true);
      await newRoom.localParticipant.setMicrophoneEnabled(true);

      newRoom.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          const track = publication.track;

          if (track && track.kind === Track.Kind.Audio) {
            attachRemoteAudio(track);
          }
        });
      });

      const attachLocalVideo = () => {
        const videoPublication = Array.from(
          newRoom.localParticipant.videoTrackPublications.values()
        )[0];

        const videoTrack = videoPublication?.track;

        if (videoTrack && localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }
      };

      attachLocalVideo();
      setTimeout(attachLocalVideo, 500);

      roomRef.current = newRoom;
      setRoom(newRoom);
      setCameraOn(true);
      setMicOn(true);

      if (role === "host") {
        await updateStreamStatus("live");
      }

      setStatusText(
        role === "host"
          ? "You are live as host."
          : "You joined as guest streamer."
      );
    } catch (error: any) {
      console.error("LiveKit Error:", error);
      alert(
        `LiveKit Error\n\nName: ${error?.name}\nMessage: ${error?.message}`
      );
    } finally {
      setStarting(false);
    }
  }

  async function stopLiveStream() {
    cleanupRemoteAudio();

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setRoom(null);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
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

    await roomRef.current.localParticipant.setCameraEnabled(nextCameraState);
    setCameraOn(nextCameraState);
  }

  async function toggleMic() {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    if (!roomRef.current) return;

    const nextMicState = !micOn;

    await roomRef.current.localParticipant.setMicrophoneEnabled(nextMicState);
    setMicOn(nextMicState);
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

    const username =
      user.user_metadata?.username ||
      user.user_metadata?.display_name ||
      user.email ||
      "User";

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
      `Mute ${chat.username}? They will not be able to send chat messages in this stream.`
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
      `Remove ${chat.username} from this stream? This will kick them from LiveKit, block them, mute them, and remove their viewer record.`
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
      current.filter((item) => item.user_id !== chat.user_id)
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

    const alreadyInvited = guestInvites.some(
      (invite) => invite.guest_id === profile.id && invite.status !== "removed"
    );

    if (alreadyInvited) {
      alert("This creator is already invited.");
      return;
    }

    setInviteSendingId(profile.id);

    const { error } = await supabase.from("stream_guests").insert([
      {
        stream_id: stream.id,
        host_id: currentUserId,
        guest_id: profile.id,
        status: "pending",
      },
    ]);

    if (error) {
      setInviteSendingId(null);
      alert(error.message);
      return;
    }

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: profile.id,
          type: "guest_invite",
          title: "Guest Stream Invite",
          message: `You have been invited to join "${stream.title}" as a guest streamer.`,
          link: `/invites`,
          is_read: false,
        },
      ]);

    if (notificationError) {
      console.error("Notification error:", notificationError.message);
    }

    setInviteSendingId(null);
    setGuestInput("");
    setCreatorResults([]);
    await loadGuestInvites();
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

    setPendingInvite(null);
    await startLiveStream();
  }

  async function declineInvite() {
    if (!pendingInvite) return;

    await supabase
      .from("stream_guests")
      .update({ status: "declined" })
      .eq("id", pendingInvite.id);

    router.push("/dashboard");
  }

  async function removeGuest(inviteId: string, guestUserId?: string) {
    const allowed = await checkCurrentUserStillAllowed();
    if (!allowed) return;

    const confirmed = confirm(
      "Remove this guest from the stream? They will be kicked from LiveKit and will no longer be allowed to join this room."
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

  if (!stream) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="text-center">
          <div className="mb-4 text-5xl">🎥</div>
          <p className="text-gray-400">{statusText}</p>
        </div>
      </div>
    );
  }

  if (role === "blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white sm:px-6">
        <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center sm:p-8">
          <div className="mb-5 text-5xl">🔒</div>
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
          <div className="mb-5 text-5xl">🎙️</div>
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

  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
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
              {stream.category} •{" "}
              <span className={isLive ? "text-green-500" : "text-gray-500"}>
                {isLive ? "Live Now" : "Offline"}
              </span>{" "}
              •{" "}
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
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h2 className="text-2xl font-black">Live Preview</h2>
                  <p className="text-sm text-gray-400">
                    {isPrivate
                      ? "Private room for host and invited guest streamers only."
                      : "Host and guest streamers join the same LiveKit room."}
                  </p>
                </div>

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

              <div className="relative flex h-[260px] items-center justify-center overflow-hidden bg-black sm:h-[420px] lg:h-[560px]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />

                {!room && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4">
                    <div className="max-w-md text-center">
                      <div className="mb-4 text-5xl sm:mb-5 sm:text-6xl">
                        {isPrivate ? "🔒" : isSubscribersOnly ? "⭐" : "🎥"}
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
              <h2 className="mb-5 text-2xl font-black">Studio Controls</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
                {!room ? (
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
                  onClick={toggleMic}
                  disabled={!room}
                  className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  {micOn ? "Mute Mic" : "Unmute Mic"}
                </button>

                <button
                  onClick={() => {
                    remoteAudioElementsRef.current.forEach((audio) => {
                      audio.play().catch(() => {});
                    });
                  }}
                  disabled={!room}
                  className="rounded-xl bg-gray-800 px-6 py-3 font-bold hover:bg-gray-700 disabled:text-gray-500"
                >
                  Enable Audio
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

            {role === "host" && (
              <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
                <h2 className="mb-2 text-2xl font-black">
                  Invite Guest Streamer
                </h2>

                <p className="mb-5 text-sm text-gray-400">
                  Search creators by name or username, then invite them to join
                  this room.
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
                              disabled={inviteSendingId === profile.id}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
                            >
                              {inviteSendingId === profile.id
                                ? "Inviting..."
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

                  {guestInvites.length === 0 ? (
                    <p className="text-gray-500">No guests invited yet.</p>
                  ) : (
                    guestInvites.map((invite) => (
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
                    <p className="mb-3 text-4xl">💬</p>
                    <p>No chat messages yet.</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((chat) => (
                  <div key={chat.id} className="rounded-xl bg-gray-900 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 truncate font-bold text-red-400">
                          {chat.username}
                        </p>

                        <p className="break-words text-white">
                          {chat.message}
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
                ))
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
  );
}
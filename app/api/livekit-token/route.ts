import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type TokenBody = {
  roomName?: string;
  streamId?: string;
  participantName?: string;
  mode?: "viewer" | "studio" | "guest";
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TokenBody;

    const roomName = body.roomName?.trim();
    const streamId = body.streamId?.trim() || roomName;
    const participantName = body.participantName?.trim() || "StreamHub User";
    const mode = body.mode || "viewer";

    if (!roomName) return bad("roomName is required");
    if (!streamId) return bad("streamId is required");

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !apiSecret) {
      return bad("LiveKit API keys are missing", 500);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return bad("Supabase server keys are missing", 500);
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return bad("Authentication required", 401);
    }

    const userJwt = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(userJwt);

    if (userError || !user) {
      return bad("Invalid or expired session", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, is_banned, is_global_muted, is_shadow_banned"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return bad("Profile not found", 403);
    }

    if (profile.is_banned) {
      return bad("Your account is banned", 403);
    }

    const { data: stream, error: streamError } = await supabase
      .from("streams")
      .select("id, user_id, title, status, visibility, is_suspended")
      .eq("id", streamId)
      .single();

    if (streamError || !stream) {
      return bad("Stream not found", 404);
    }

    if (stream.is_suspended) {
      return bad("This stream has been suspended", 403);
    }

    const isOwner = stream.user_id === user.id;

    let isApprovedGuest = false;

    if (!isOwner) {
      const { data: invite } = await supabase
        .from("stream_guests")
        .select("id, status")
        .eq("stream_id", stream.id)
        .eq("guest_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();

      isApprovedGuest = !!invite;
    }

    if (mode === "studio" && !isOwner) {
      return bad("Only the stream owner can join studio", 403);
    }

    if (mode === "guest" && !isApprovedGuest) {
      return bad("Guest invite required", 403);
    }

    if (mode === "viewer") {
      if (stream.status !== "live") {
        return bad("Stream is offline", 403);
      }

      if (stream.visibility === "private" && !isOwner && !isApprovedGuest) {
        return bad("This stream is private", 403);
      }

      if (stream.visibility === "subscribers" && !isOwner) {
        const { data: subscribed, error: subscriptionError } =
          await supabase.rpc("is_subscribed_to_creator", {
            target_creator_id: stream.user_id,
          });

        if (subscriptionError) {
          return bad("Unable to verify subscription", 403);
        }

        if (subscribed !== true) {
          return bad("Active creator subscription required", 403);
        }
      }
    }

    const canPublish = mode === "studio" || mode === "guest";

    const identity = user.id;
    const displayName =
      profile.display_name ||
      profile.username ||
      participantName ||
      "StreamHub User";

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: "2h",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "livekit_token_created",
      target_type: "stream",
      target_id: stream.id,
      details: {
        mode,
        roomName,
        canPublish,
        visibility: stream.visibility,
      },
    });

    return NextResponse.json({
      token: jwt,
      identity,
      canPublish,
    });
  } catch (error: any) {
    console.error("LiveKit token error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to create LiveKit token" },
      { status: 500 }
    );
  }
}
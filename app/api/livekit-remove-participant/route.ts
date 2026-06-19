import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RemoveParticipantBody = {
  roomName?: string;
  streamId?: string;
  participantIdentity?: string;
  reason?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RemoveParticipantBody;

    const roomName = body.roomName?.trim();
    const streamId = body.streamId?.trim() || roomName;
    const participantIdentity = body.participantIdentity?.trim();
    const reason = body.reason?.trim() || "Removed from stream";

    if (!roomName || !participantIdentity) {
      return bad("roomName and participantIdentity are required");
    }

    if (!streamId) {
      return bad("streamId is required");
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!livekitUrl || !apiKey || !apiSecret) {
      return bad("LiveKit server environment variables are missing", 500);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return bad("Supabase server environment variables are missing", 500);
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
      .select("id, is_admin, is_banned")
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
      .select("id, user_id, title")
      .eq("id", streamId)
      .single();

    if (streamError || !stream) {
      return bad("Stream not found", 404);
    }

    const isAdmin = !!profile.is_admin;
    const isOwner = stream.user_id === user.id;

    if (!isAdmin && !isOwner) {
      return bad("Only admins or the stream owner can remove participants", 403);
    }

    if (!isAdmin && participantIdentity === stream.user_id) {
      return bad("Stream owner cannot remove themselves", 403);
    }

    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

    await roomService.removeParticipant(roomName, participantIdentity);

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "livekit_participant_removed",
      target_type: "stream",
      target_id: stream.id,
      details: {
        roomName,
        participantIdentity,
        reason,
        removedByRole: isAdmin ? "admin" : "stream_owner",
      },
    });

    return NextResponse.json({
      success: true,
      removedParticipant: participantIdentity,
    });
  } catch (error: any) {
    console.error("LiveKit remove participant error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to remove participant" },
      { status: 500 }
    );
  }
}

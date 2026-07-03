import { supabase } from "./supabase";

export type PrivateCallTarget = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export type StartPrivateCallResult =
  | {
      ok: true;
      streamId: string;
      callId: string;
    }
  | {
      ok: false;
      message: string;
      redirectTo?: string;
    };

async function isMutualFollow(callerId: string, targetUserId: string) {
  const [{ data: iFollow }, { data: followsMe }] = await Promise.all([
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", callerId)
      .eq("following_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", targetUserId)
      .eq("following_id", callerId)
      .maybeSingle(),
  ]);

  return !!iFollow && !!followsMe;
}

export async function startPrivateCallRequest(params: {
  callerId: string;
  target: PrivateCallTarget;
  price?: number;
}): Promise<StartPrivateCallResult> {
  const { callerId, target } = params;
  const callPrice = Number(params.price || 0);

  if (!callerId) {
    return {
      ok: false,
      message: "You must be logged in to start a private call.",
      redirectTo: "/login",
    };
  }

  const targetName =
    target.display_name || target.username || "this user";

  const canCall = await isMutualFollow(callerId, target.id);

  if (!canCall) {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", callerId)
      .maybeSingle();

    const callerName =
      myProfile?.display_name || myProfile?.username || "A StreamHub user";

    await supabase.from("notifications").insert([
      {
        user_id: target.id,
        type: "follow_back_for_calls",
        title: "Connection Request",
        message: `${callerName} wants to connect with you. Follow back to enable private calls.`,
        link: `/profile/${callerId}`,
        is_read: false,
      },
    ]);

    return {
      ok: false,
      message:
        "You can only call mutual followers. A follow-back notification has been sent.",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      ok: false,
      message: "Please log in again to start a private call.",
      redirectTo: "/login",
    };
  }

  const callTitle = `Private Call with ${targetName}`;
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const { data: streamData, error: streamError } = await supabase
    .from("streams")
    .insert([
      {
        user_id: callerId,
        title: callTitle,
        category: "One-on-One Call",
        description: "Private one-on-one video call.",
        tags: "private,call,one-on-one",
        visibility: "private",
        status: "offline",
        thumbnail_url: null,
        private_call_price: callPrice,
      },
    ])
    .select()
    .single();

  if (streamError || !streamData) {
    return {
      ok: false,
      message: streamError?.message || "Failed to create private call.",
    };
  }

  const { error: guestError } = await supabase.from("stream_guests").insert([
    {
      stream_id: streamData.id,
      host_id: callerId,
      guest_id: target.id,
      status: "pending",
    },
  ]);

  if (guestError) {
    return {
      ok: false,
      message: guestError.message,
    };
  }

  const { data: callData, error: callError } = await supabase
    .from("private_call_requests")
    .insert([
      {
        caller_id: callerId,
        receiver_id: target.id,
        stream_id: streamData.id,
        status: "pending",
        ring_status: "ringing",
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (callError || !callData) {
    return {
      ok: false,
      message: callError?.message || "Failed to create call request.",
    };
  }

  await supabase.from("notifications").insert([
    {
      user_id: target.id,
      type: "private_call_request",
      title: "Incoming Private Call",
      message: "Someone is calling you on StreamHub.",
      link: `/incoming-call/${callData.id}`,
      is_read: false,
    },
  ]);

  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: target.id,
        title: "Incoming Private Call",
        message: "Someone is calling you on StreamHub.",
        url: `/incoming-call/${callData.id}`,
        notificationType: "incoming_call",
        streamId: streamData.id,
        callId: callData.id,
      }),
    });
  } catch (pushError) {
    console.error("Incoming call push failed:", pushError);
  }

  return {
    ok: true,
    streamId: streamData.id,
    callId: callData.id,
  };
}

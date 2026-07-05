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

  // Single atomic call: mutual-follow check, busy check, and creation of
  // the stream/stream_guests/private_call_requests rows all happen
  // server-side in one transaction. This is what makes the busy check
  // reliable for BOTH web and the native Android app — if this returns
  // busy, no push notification is ever sent, so the receiver's phone
  // never rings for a call they can't take.
  const { data, error } = await supabase.rpc("start_private_call_request", {
    p_receiver_id: target.id,
    p_price: callPrice,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Failed to start private call.",
    };
  }

  if (!data?.ok) {
    if (data?.reason === "not_mutual") {
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

    if (data?.reason === "busy") {
      return {
        ok: false,
        message: "This user is currently on another call.",
      };
    }

    return {
      ok: false,
      message: data?.message || "Failed to start private call.",
    };
  }

  const streamId = data.stream_id as string;
  const callId = data.call_id as string;

  await supabase.from("notifications").insert([
    {
      user_id: target.id,
      type: "private_call_request",
      title: "Incoming Private Call",
      message: "Someone is calling you on StreamHub.",
      link: `/incoming-call/${callId}`,
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
        url: `/incoming-call/${callId}`,
        notificationType: "incoming_call",
        streamId,
        callId,
      }),
    });
  } catch (pushError) {
    console.error("Incoming call push failed:", pushError);
  }

  return {
    ok: true,
    streamId,
    callId,
  };
}

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
      price: number;
    }
  | {
      ok: false;
      message: string;
      redirectTo?: string;
    };

export async function startPrivateCallRequest(params: {
  callerId: string;
  target: PrivateCallTarget;
}): Promise<StartPrivateCallResult> {
  const { callerId, target } = params;

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

  // Price is no longer chosen here. It's the receiver's own preset rate,
  // read server-side inside this RPC — a caller can never set or tamper
  // with what they'll be charged.
  const { data, error } = await supabase.rpc("start_private_call_request", {
    p_receiver_id: target.id,
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

    if (data?.reason === "caller_busy") {
      return {
        ok: false,
        message: "You are already on another call. End it before starting a new one.",
      };
    }

    return {
      ok: false,
      message: data?.message || "Failed to start private call.",
    };
  }

  const streamId = data.stream_id as string;
  const callId = data.call_id as string;
  const price = Number(data.price || 0);

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
    price,
  };
}

/** Fetch a user's own private-call rate (for display before calling them). */
export async function getPrivateCallRate(
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("private_call_rate")
    .eq("id", userId)
    .maybeSingle();

  return Number(data?.private_call_rate || 0);
}

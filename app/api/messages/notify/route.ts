import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const dynamic = "force-dynamic";

type NotifyBody = {
  conversationId?: string;
  messageId?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFirebaseAdmin() {
  if (getApps().length > 0) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing");
  }

  initializeApp({ credential: cert(JSON.parse(raw)) });
}

function previewOf(content: string | null, type: string | null) {
  if (type && type !== "text") return "Sent you a message";
  const text = (content || "").trim();
  if (!text) return "Sent you a message";
  return text.length > 90 ? text.slice(0, 90) + "…" : text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotifyBody;

    if (!body.conversationId || !body.messageId) {
      return bad("conversationId and messageId are required");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return bad("Supabase server keys are missing", 500);
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return bad("Authentication required", 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return bad("Invalid or expired session", 401);
    }

    // The message must exist, belong to the conversation, and have been
    // sent by the authenticated caller. Content is read server-side so
    // notification text cannot be spoofed.
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, type")
      .eq("id", body.messageId)
      .maybeSingle();

    if (messageError) return bad(messageError.message, 500);

    if (
      !message ||
      message.conversation_id !== body.conversationId ||
      message.sender_id !== user.id
    ) {
      return bad("Permission denied for this message", 403);
    }

    // Recipients: every other participant in the conversation.
    const { data: participants, error: participantsError } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", body.conversationId);

    if (participantsError) return bad(participantsError.message, 500);

    const recipientIds = (participants || [])
      .map((p) => p.user_id)
      .filter((id) => id !== user.id);

    if (recipientIds.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Sender name for the notification title.
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    const senderName =
      senderProfile?.display_name || senderProfile?.username || "New message";

    const title = senderName;
    const bodyText = previewOf(message.content, message.type);
    const url = `/messages/${body.conversationId}`;

    let sent = 0;
    let failed = 0;

    for (const recipientId of recipientIds) {
      // ---- Android (FCM) ----
      const { data: androidTokens } = await supabase
        .from("push_tokens")
        .select("id, token")
        .eq("user_id", recipientId)
        .eq("platform", "android")
        .eq("is_active", true);

      if ((androidTokens?.length || 0) > 0) {
        getFirebaseAdmin();

        await Promise.all(
          (androidTokens || []).map(async (row) => {
            try {
              await getMessaging().send({
                token: row.token,
                notification: { title, body: bodyText },
                data: {
                  type: "direct_message",
                  notificationType: "direct_message",
                  url,
                  link: url,
                  conversationId: body.conversationId || "",
                },
                android: {
                  priority: "high",
                  notification: {
                    channelId: "default",
                    sound: "default",
                    priority: "high",
                    visibility: "private",
                  },
                },
              });
              sent++;
            } catch (error: any) {
              failed++;
              const code = error?.code || "";
              if (
                code.includes("registration-token-not-registered") ||
                code.includes("invalid-registration-token")
              ) {
                await supabase
                  .from("push_tokens")
                  .update({
                    is_active: false,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", row.id);
              }
            }
          })
        );
      }

      // ---- Web push ----
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidEmail = process.env.VAPID_EMAIL;

      if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
        webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", recipientId);

        const webPayload = JSON.stringify({
          title,
          body: bodyText,
          url,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          type: "direct_message",
          notificationType: "direct_message",
        });

        await Promise.all(
          (subscriptions || []).map(async (subscription) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                webPayload
              );
              sent++;
            } catch (error: any) {
              failed++;
              if (error?.statusCode === 404 || error?.statusCode === 410) {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("id", subscription.id);
              }
            }
          })
        );
      }
    }

    return NextResponse.json({ success: true, sent, failed });
  } catch (error: any) {
    console.error("Message notify error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send message notification" },
      { status: 500 }
    );
  }
}

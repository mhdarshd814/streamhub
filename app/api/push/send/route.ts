import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const dynamic = "force-dynamic";

type PushSendBody = {
  userId?: string;
  title?: string;
  message?: string;
  url?: string;
  streamId?: string;
  notificationType?: string;
  callId?: string;
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

  const serviceAccount = JSON.parse(raw);

  initializeApp({
    credential: cert(serviceAccount),
  });
}

function getCallIdFromUrl(url?: string, explicitCallId?: string) {
  if (explicitCallId) return explicitCallId;

  if (!url) return "";

  const match = url.match(/\/incoming-call\/([^/?#]+)/);
  return match?.[1] || "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushSendBody;

    if (!body.userId || !body.title) {
      return bad("userId and title are required");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL;

    if (!supabaseUrl || !serviceRoleKey) {
      return bad("Supabase server keys are missing", 500);
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return bad("Authentication required", 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return bad("Invalid or expired session", 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      return bad("Banned users cannot send push notifications", 403);
    }

    let allowedToSend = false;

    if (profile?.is_admin) allowedToSend = true;
    if (user.id === body.userId) allowedToSend = true;

    if (!allowedToSend && body.streamId) {
      const { data: streamData, error: streamError } = await supabase
        .from("streams")
        .select("id, user_id, visibility")
        .eq("id", body.streamId)
        .maybeSingle();

      if (streamError) {
        return bad(streamError.message, 500);
      }

      if (streamData?.user_id === user.id) {
        allowedToSend = true;
      }
    }

    if (!allowedToSend) {
      return bad("Permission denied for this push notification", 403);
    }

    const notificationType = body.notificationType || "general";
    const url = body.url || "/notifications";
    const callId = getCallIdFromUrl(url, body.callId);

    let webSent = 0;
    let webFailed = 0;
    let androidSent = 0;
    let androidFailed = 0;

    if (vapidPublicKey && vapidPrivateKey && vapidEmail) {
      webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", body.userId);

      if (subError) {
        return bad(subError.message, 500);
      }

      const webPayload = JSON.stringify({
        title: body.title,
        body: body.message || "",
        url,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        notificationType,
        type: notificationType,
        streamId: body.streamId || "",
        callId,
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

            webSent++;
          } catch (error: any) {
            webFailed++;

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

    const { data: androidTokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", body.userId)
      .eq("platform", "android")
      .eq("is_active", true);

    if (tokenError) {
      return bad(tokenError.message, 500);
    }

    if (androidTokens && androidTokens.length > 0) {
      getFirebaseAdmin();

      await Promise.all(
        androidTokens.map(async (row) => {
          try {
            const isIncomingCall =
              notificationType === "incoming_call";

            await getMessaging().send({
              token: row.token,
              ...(isIncomingCall
                ? {}
                : {
                    notification: {
                      title: body.title || "StreamHub",
                      body: body.message || "New notification",
                    },
                  }),
              data: {
                type: notificationType,
                notificationType,
                url,
                link: url,
                streamId: body.streamId || "",
                callId,
              },
              android: {
                priority: "high",
                ttl: 60 * 1000,
                notification: {
                  channelId:
                    notificationType === "incoming_call"
                      ? "incoming_calls"
                      : "default",
                  sound: "default",
                  priority: "max",
                  visibility: "public",
                  defaultSound: true,
                  defaultVibrateTimings: true,
                },
              },
            });

            androidSent++;
          } catch (error: any) {
            androidFailed++;

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

    return NextResponse.json({
      success: true,
      webSent,
      webFailed,
      androidSent,
      androidFailed,
      totalSent: webSent + androidSent,
      totalFailed: webFailed + androidFailed,
    });
  } catch (error: any) {
    console.error("Push send error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send push notification" },
      { status: 500 }
    );
  }
}



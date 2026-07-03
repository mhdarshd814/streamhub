import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const dynamic = "force-dynamic";

type Body = {
  userId?: string;
  title?: string;
  message?: string;
  url?: string;
  type?: string;
  streamId?: string;
  callId?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFirebaseAdminApp() {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin environment variables are missing.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.userId || !body.title) {
      return bad("userId and title are required");
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return bad("Authentication required", 401);
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return bad("Supabase server keys are missing", 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return bad("Invalid or expired session", 401);
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("is_admin, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (senderProfile?.is_banned) {
      return bad("Banned users cannot send notifications", 403);
    }

    const notificationType = body.type || "general";
    const isIncomingCall =
      notificationType === "incoming_call" ||
      notificationType === "incoming_private_call";

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", body.userId)
      .eq("is_active", true);

    if (tokenError) {
      return bad(tokenError.message, 500);
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: "No Android push tokens found for this user.",
      });
    }

    const app = getFirebaseAdminApp();
    const messaging = getMessaging(app);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      tokens.map(async (item) => {
        try {
          if (isIncomingCall) {
            // TRUE data-only for calls: no notification block anywhere, so
            // onMessageReceived fires even in background/killed state and
            // IncomingCallService owns the ringing UI. A notification block
            // here would make FCM auto-display its own notification and
            // bypass the native call flow entirely.
            await messaging.send({
              token: item.token,
              data: {
                type: notificationType,
                title: body.title || "Incoming Private Call",
                message: body.message || "Someone is calling you on StreamHub",
                url: body.url || "/",
                streamId: body.streamId || "",
                callId: body.callId || "",
              },
              android: {
                priority: "high",
                ttl: 60 * 1000,
              },
            });
          } else {
            await messaging.send({
              token: item.token,
              notification: {
                title: body.title,
                body: body.message || "",
              },
              data: {
                url: body.url || "/calls",
                type: notificationType,
                streamId: body.streamId || "",
                callId: body.callId || "",
              },
              android: {
                priority: "high",
                notification: {
                  channelId: "default",
                  priority: "high",
                  sound: "default",
                  clickAction: "OPEN_STREAMHUB",
                },
              },
            });
          }

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
              .eq("id", item.id);
          }

          console.error("FCM send failed:", error?.message || error);
        }
      })
    );

    return NextResponse.json({
      success: true,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error("FCM send error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send FCM notification" },
      { status: 500 }
    );
  }
}

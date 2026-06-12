import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

type PushSendBody = {
  userId?: string;
  title?: string;
  message?: string;
  url?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      return bad("VAPID keys are missing", 500);
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

    if (!profile?.is_admin && user.id !== body.userId) {
      return bad("Admin permission required", 403);
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", body.userId);

    if (subError) {
      return bad(subError.message, 500);
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.message || "",
      url: body.url || "/notifications",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });

    let sent = 0;
    let failed = 0;

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
            payload
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

    return NextResponse.json({
      success: true,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error("Push send error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to send push notification" },
      { status: 500 }
    );
  }
}
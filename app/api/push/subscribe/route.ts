import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PushSubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  userAgent?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushSubscribeBody;

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return bad("Invalid push subscription data");
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
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      return bad("Banned users cannot enable push notifications", 403);
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgent || req.headers.get("user-agent") || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,endpoint",
      }
    );

    if (error) {
      return bad(error.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Push subscribe error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
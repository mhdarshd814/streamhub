import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PushUnsubscribeBody = {
  endpoint?: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushUnsubscribeBody;

    if (!body.endpoint) {
      return bad("endpoint is required");
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

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", body.endpoint);

    if (error) {
      return bad(error.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Push unsubscribe error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to remove push subscription" },
      { status: 500 }
    );
  }
}

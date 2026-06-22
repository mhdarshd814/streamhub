import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server keys missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const now = new Date().toISOString();

    const { data: expiredCalls, error: lookupError } = await supabase
      .from("private_call_requests")
      .select("id, stream_id, caller_id, receiver_id")
      .eq("status", "pending")
      .lt("expires_at", now)
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    const calls = expiredCalls || [];

    if (calls.length === 0) {
      return NextResponse.json({ success: true, expired: 0 });
    }

    const ids = calls.map((item: any) => item.id).filter(Boolean);
    const streamIds = calls.map((item: any) => item.stream_id).filter(Boolean);

    await supabase
      .from("private_call_requests")
      .update({
        status: "missed",
        ring_status: "expired",
        missed_at: now,
      })
      .in("id", ids)
      .eq("status", "pending");

    if (streamIds.length > 0) {
      await supabase
        .from("streams")
        .update({
          status: "offline",
          viewers: 0,
        })
        .in("id", streamIds);

      await supabase
        .from("stream_viewers")
        .delete()
        .in("stream_id", streamIds);

      await supabase
        .from("stream_guests")
        .update({ status: "declined" })
        .in("stream_id", streamIds)
        .eq("status", "pending");
    }

    return NextResponse.json({
      success: true,
      expired: calls.length,
      streamIds,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to expire private calls" },
      { status: 500 }
    );
  }
}

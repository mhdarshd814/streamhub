import { supabase } from "./supabase";

type ParticipantRole = "host" | "guest" | "viewer" | "caller" | "receiver";

export async function startAttendanceSession(input: {
  streamId: string;
  participantId: string;
  participantRole: ParticipantRole;
  callRequestId?: string | null;
}) {
  try {
    if (!input.streamId || !input.participantId || !input.participantRole) {
      return null;
    }

    const { data, error } = await supabase
      .from("session_attendance")
      .insert([
        {
          stream_id: input.streamId,
          call_request_id: input.callRequestId || null,
          participant_id: input.participantId,
          participant_role: input.participantRole,
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.warn("Attendance start skipped:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.warn("Attendance start failed:", error);
    return null;
  }
}

export async function endAttendanceSession(attendanceId: string | null) {
  try {
    if (!attendanceId) return;

    const { data, error: lookupError } = await supabase
      .from("session_attendance")
      .select("joined_at")
      .eq("id", attendanceId)
      .maybeSingle();

    if (lookupError || !data?.joined_at) {
      console.warn("Attendance lookup skipped:", lookupError?.message);
      return;
    }

    const joinedAt = new Date(data.joined_at).getTime();
    const now = Date.now();
    const durationSeconds = Math.max(0, Math.floor((now - joinedAt) / 1000));

    const { error } = await supabase
      .from("session_attendance")
      .update({
        left_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq("id", attendanceId);

    if (error) {
      console.warn("Attendance end skipped:", error.message);
    }
  } catch (error) {
    console.warn("Attendance end failed:", error);
  }
}
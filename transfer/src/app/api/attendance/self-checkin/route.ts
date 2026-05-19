import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/services/supabase-server";

function getManilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function calculateHours(checkIn: string, checkOut: string) {
  const [inH, inM, inS = 0] = checkIn.split(":").map(Number);
  const [outH, outM, outS = 0] = checkOut.split(":").map(Number);
  const inTotal = inH * 3600 + inM * 60 + inS;
  const outTotal = outH * 3600 + outM * 60 + outS;
  const diffSeconds = outTotal >= inTotal
    ? outTotal - inTotal
    : 24 * 3600 - inTotal + outTotal;
  if (diffSeconds <= 0) return 0;
  return Math.round((diffSeconds / 3600) * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Resolve employee by profile_id
    const { data: emp } = await supabase
      .from("employees")
      .select("id, status")
      .eq("profile_id", user.id)
      .single();
    if (!emp || emp.status !== "active") return NextResponse.json({ ok: false, error: "Employee not found or inactive" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const deviceId = (body.deviceId as string) || (body.device_id as string) || "WEB-SELF";
    const rawTs = (body.timestampUTC as string) || (body.timestamp as string) || new Date().toISOString();
    const parsed = Date.parse(rawTs);
    const timestampUTC = Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();

    const scanDate = new Date(timestampUTC);
    const { date: scanDay, time: timeStr } = getManilaParts(scanDate);

    // Use admin client for writes to bypass RLS when needed
    const admin = await createAdminSupabaseClient();

    const { data: existingLog } = await admin
      .from("attendance_logs")
      .select("id, check_in, check_out")
      .eq("employee_id", emp.id)
      .eq("date", scanDay)
      .maybeSingle();

    if (existingLog?.check_in && existingLog?.check_out) {
      return NextResponse.json({ ok: true, ignored: true, message: "Already timed in and out today" });
    }

    const eventType = existingLog?.check_in ? "OUT" : "IN";
    const eventId = `EVT-${nanoid(8)}`;
    const nowISO = new Date().toISOString();

    const { error: eventError } = await admin.from("attendance_events").insert({
      id: eventId,
      employee_id: emp.id,
      event_type: eventType,
      timestamp_utc: timestampUTC,
      device_id: deviceId,
      created_at: nowISO,
    });
    if (eventError) return NextResponse.json({ ok: false, error: eventError.message }, { status: 500 });

    if (eventType === "IN") {
      await admin.from("attendance_logs").upsert(
        {
          id: existingLog?.id || `ATT-${scanDay}-${emp.id}`,
          employee_id: emp.id,
          date: scanDay,
          check_in: timeStr,
          check_in_method: "self_checkin",
          status: "present",
          updated_at: nowISO,
        },
        { onConflict: "employee_id,date" }
      );
    } else if (existingLog) {
      const checkIn = existingLog.check_in as string;
      await admin.from("attendance_logs").update({
        check_out: timeStr,
        hours: calculateHours(checkIn, timeStr),
        updated_at: nowISO,
      }).eq("id", existingLog.id);
    }

    return NextResponse.json({ ok: true, employeeId: emp.id, eventType, attendanceDate: scanDay, time: timeStr });
  } catch (err) {
    console.error("[self-checkin]", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

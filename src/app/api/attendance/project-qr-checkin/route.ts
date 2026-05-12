import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/services/supabase-server";
import { validateProjectQR } from "@/services/qr-token.service";

/**
 * POST /api/attendance/project-qr-checkin
 *
 * Employee-authenticated project QR check-in via phone scan.
 * Unlike /api/attendance/validate-qr (kiosk API key auth),
 * this route uses Supabase session auth so employees can use it
 * directly from the /checkin deep-link page without a kiosk device.
 *
 * Body: { payload: string, location: { lat: number, lng: number, accuracy?: number } }
 * Response: { ok: boolean, eventType?, time?, projectName?, employeeName?, error? }
 */

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
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function calcHours(checkIn: string, checkOut: string): number {
  const [ih, im, is_ = 0] = checkIn.split(":").map(Number);
  const [oh, om, os = 0] = checkOut.split(":").map(Number);
  const inSec = ih * 3600 + im * 60 + is_;
  const outSec = oh * 3600 + om * 60 + os;
  const diff = outSec >= inSec ? outSec - inSec : 24 * 3600 - inSec + outSec;
  if (diff > 0 && diff < 60) return 0.01;
  return Math.round((diff / 3600) * 100) / 100;
}

export async function POST(req: Request) {
  try {
    // Session auth — employee must be logged in
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Resolve employee record
    const { data: emp } = await supabase
      .from("employees")
      .select("id, name, status")
      .eq("profile_id", user.id)
      .single();
    if (!emp || emp.status !== "active") {
      return NextResponse.json({ ok: false, error: "Employee not found or inactive" }, { status: 404 });
    }

    // Parse and validate body
    let body: { payload?: unknown; location?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }

    const { payload, location } = body;
    if (!payload || typeof payload !== "string") {
      return NextResponse.json({ ok: false, error: "Missing QR payload" }, { status: 400 });
    }
    if (
      !location ||
      typeof location !== "object" ||
      typeof (location as Record<string, unknown>).lat !== "number" ||
      typeof (location as Record<string, unknown>).lng !== "number"
    ) {
      return NextResponse.json({ ok: false, error: "Location required for project QR check-in" }, { status: 400 });
    }

    const loc = location as { lat: number; lng: number; accuracy?: number };

    // Validate the project QR (HMAC + geofence)
    // validateProjectQR requires a kioskId param (we pass a placeholder — it only logs)
    const validation = await validateProjectQR(payload, "PHONE_SCAN", loc);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: "QR validation error" }, { status: 500 });
    }
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.message ?? "Invalid QR code" }, { status: 422 });
    }

    const projectId = validation.projectId!;

    // Fetch project details (name)
    const admin = await createAdminSupabaseClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    // Verify employee is assigned to this project
    const { data: assignment } = await admin
      .from("project_assignments")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("employee_id", emp.id)
      .maybeSingle();
    if (!assignment) {
      return NextResponse.json({ ok: false, error: "You are not assigned to this project" }, { status: 403 });
    }

    // Determine IN vs OUT
    const now = new Date();
    const { date: today, time: timeStr } = getManilaParts(now);
    const nowISO = now.toISOString();

    const { data: existingLog } = await admin
      .from("attendance_logs")
      .select("id, check_in, check_out")
      .eq("employee_id", emp.id)
      .eq("date", today)
      .maybeSingle();

    // Guard: already fully clocked
    if (existingLog?.check_in && existingLog?.check_out) {
      return NextResponse.json({
        ok: false,
        error: "You have already checked in and out today",
      }, { status: 409 });
    }

    const eventType = existingLog?.check_in ? "OUT" : "IN";
    const eventId = `EVT-${nanoid(8)}`;

    // Write attendance event
    const { error: evtErr } = await admin.from("attendance_events").insert({
      id: eventId,
      employee_id: emp.id,
      event_type: eventType,
      timestamp_utc: nowISO,
      device_id: "PHONE_QR",
      created_at: nowISO,
    });
    if (evtErr) {
      return NextResponse.json({ ok: false, error: evtErr.message }, { status: 500 });
    }

    // Write attendance evidence for audit trail
    const evidenceId = `EVI-${nanoid(8)}`;
    await admin.from("attendance_evidence").insert({
      id: evidenceId,
      event_id: eventId,
      gps_lat: loc.lat,
      gps_lng: loc.lng,
      gps_accuracy_meters: loc.accuracy ?? null,
      geofence_pass: validation.geofencePass ?? true,
      qr_token_id: null,
      device_integrity_result: null,
      face_verified: null,
      mock_location_detected: false,
    });

    // Upsert attendance log (daily summary)
    if (eventType === "IN") {
      await admin.from("attendance_logs").upsert(
        {
          id: existingLog?.id ?? `ATT-${today}-${emp.id}`,
          employee_id: emp.id,
          date: today,
          check_in: timeStr,
          status: "present",
          project_id: projectId,
          updated_at: nowISO,
        },
        { onConflict: "employee_id,date" },
      );
    } else if (existingLog) {
      await admin.from("attendance_logs").update({
        check_out: timeStr,
        hours: calcHours(existingLog.check_in as string, timeStr),
        updated_at: nowISO,
      }).eq("id", existingLog.id);
    }

    return NextResponse.json({
      ok: true,
      eventType,
      time: timeStr,
      projectName: project.name as string,
      employeeName: emp.name as string,
    });
  } catch (err) {
    console.error("[project-qr-checkin]", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

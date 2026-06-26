import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { nanoid } from "nanoid";

const ALLOWED_ROLES = ["admin", "hr", "finance", "payroll_admin", "supervisor"];

async function resolveCallerEmployee(supabase: Awaited<ReturnType<typeof createAdminSupabaseClient>>, userId: string, userEmail: string) {
  const { data } = await supabase
    .from("employees")
    .select("id, role, department, company_id")
    .or(`profile_id.eq.${userId},email.eq.${userEmail}`)
    .single();
  return data;
}

function getManilaDate(utcIso: string) {
  const date = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function resolveAttendanceSource(
  log: Record<string, unknown>
): "biometric" | "mobile_gps" | "web" | "manual" {
  const method = String(log.check_in_method || log.check_out_method || log.source || "");
  if (method.includes("mobile") || method.includes("gps")) return "mobile_gps";
  if (
    method.includes("fingerprint") ||
    method.includes("face") ||
    method.includes("rfid") ||
    method.includes("biometric")
  )
    return "biometric";
  if (method.includes("manual")) return "manual";
  return "web";
}

function resolveAttendanceStatus(
  log: Record<string, unknown>
): "pending" | "approved" | "rejected" | "edited" {
  const attendanceStatus = log.attendance_status as string | undefined;
  if (attendanceStatus === "pending_review") return "pending";
  if (log.approved_by) {
    if (attendanceStatus === "absent") return "rejected";
    if (log.check_in_method === "manual" || log.check_out_method === "manual") return "edited";
    return "approved";
  }
  return "approved";
}

/**
 * GET /api/attendance/review
 * Fetch attendance logs for HR review.
 * Query params: startDate, endDate, departmentId?, employeeId?, source?, status?
 */
export async function GET(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const departmentId = searchParams.get("departmentId");
    const employeeId = searchParams.get("employeeId");
    const source = searchParams.get("source");
    const status = searchParams.get("status");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "startDate and endDate required" },
        { status: 400 }
      );
    }

    // Resolve department name from ID if provided
    let targetDeptName: string | null = null;
    if (departmentId) {
      const { data: dept } = await supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .maybeSingle();
      targetDeptName = dept?.name ?? null;
    }

    // Query attendance logs with employee join
    let query = supabase
      .from("attendance_logs")
      .select(`*, employee:employees(id, name, department, role)`)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data: rawLogs, error: logsError } = await query;
    if (logsError) {
      return NextResponse.json({ ok: false, message: logsError.message }, { status: 500 });
    }

    let logs = (rawLogs ?? []) as Record<string, unknown>[];

    // Department filter: supervisors see only their dept
    if (caller.role === "supervisor") {
      logs = logs.filter(
        (l) => (l.employee as Record<string, unknown>)?.department === caller.department
      );
    } else if (targetDeptName) {
      logs = logs.filter(
        (l) => (l.employee as Record<string, unknown>)?.department === targetDeptName
      );
    }

    // Batch-fetch attendance events + evidence for these employees+dates
    const employeeIds = Array.from(new Set(logs.map((l) => l.employee_id as string)));
    const eventsGrouped: Record<string, Record<string, unknown>[]> = {};

    if (employeeIds.length > 0) {
      const { data: eventsData } = await supabase
        .from("attendance_events")
        .select(`
          id, employee_id, event_type, timestamp_utc,
          evidence:attendance_evidence(
            gps_lat, gps_lng, geofence_pass, selfie_url, distance_from_location_meters
          )
        `)
        .in("employee_id", employeeIds)
        .gte("timestamp_utc", `${startDate}T00:00:00Z`)
        .lte("timestamp_utc", `${endDate}T23:59:59Z`);

      for (const event of (eventsData ?? []) as Record<string, unknown>[]) {
        const manilaDate = getManilaDate(event.timestamp_utc as string);
        const key = `${event.employee_id}_${manilaDate}`;
        if (!eventsGrouped[key]) eventsGrouped[key] = [];
        eventsGrouped[key].push(event);
      }
    }

    const records = logs.map((log) => {
      const dayEvents = eventsGrouped[`${log.employee_id}_${log.date}`] || [];
      const inEvent = (dayEvents.find((e) => e.event_type === "IN") ||
        dayEvents[0]) as Record<string, unknown> | undefined;
      const evidenceArr =
        inEvent?.evidence ||
        dayEvents.find((e) => (e.evidence as unknown[])?.length)?.evidence;
      const evidence = Array.isArray(evidenceArr)
        ? (evidenceArr[0] as Record<string, unknown>)
        : null;

      return {
        id: log.id,
        employeeId: log.employee_id,
        employeeName:
          (log.employee as Record<string, unknown>)?.name || log.employee_id,
        date: log.date,
        clockIn: log.check_in ?? null,
        clockOut: log.check_out ?? null,
        source: resolveAttendanceSource(log),
        locationLat: log.location_lat != null ? Number(log.location_lat) : null,
        locationLng: log.location_lng != null ? Number(log.location_lng) : null,
        selfieUrl: evidence?.selfie_url ?? null,
        distanceMeters:
          evidence?.distance_from_location_meters != null
            ? Number(evidence.distance_from_location_meters)
            : null,
        isWithinGeofence: evidence?.geofence_pass ?? null,
        status: resolveAttendanceStatus(log),
      };
    });

    // Client-side source/status filter
    const filtered = records.filter(
      (r) =>
        (!source || r.source === source) &&
        (!status || r.status === status)
    );

    return NextResponse.json({ ok: true, records: filtered });
  } catch (err) {
    console.error("GET /api/attendance/review error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/attendance/review
 * Approve, reject, edit, or add remarks to an attendance log.
 * Body: { id, action, remarks?, editedClockIn?, editedClockOut? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !["admin", "hr", "payroll_admin", "finance"].includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, action, remarks, editedClockIn, editedClockOut } = body ?? {};

    if (!id || !action) {
      return NextResponse.json({ ok: false, message: "id and action required" }, { status: 400 });
    }

    const { data: log, error: logErr } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("id", id)
      .single();

    if (logErr || !log) {
      return NextResponse.json({ ok: false, message: "Attendance log not found" }, { status: 404 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("id, shift_id, company_id")
      .eq("id", log.employee_id)
      .maybeSingle();

    const companyId = employee?.company_id || log.company_id || "default";
    const now = new Date().toISOString();
    const beforeSnapshot = { ...log };

    const updates: Record<string, unknown> = { updated_at: now };
    let auditAction = "attendance_correction";

    if (action === "approve") {
      updates.attendance_status = "present";
      updates.status = "present";
      updates.approved_by = caller.id;
      updates.approved_at = now;
      updates.needs_review = false;
      auditAction = "timesheet_approved";
    } else if (action === "reject") {
      updates.attendance_status = "absent";
      updates.status = "absent";
      updates.approved_by = caller.id;
      updates.approved_at = now;
      updates.needs_review = false;
      auditAction = "timesheet_rejected";
    } else if (action === "edit") {
      const clockIn = editedClockIn || log.check_in;
      const clockOut = editedClockOut || log.check_out;

      // Recompute hours
      let hours: number | null = log.hours as number | null;
      if (clockIn && clockOut) {
        const [inH, inM] = String(clockIn).split(":").map(Number);
        const [outH, outM] = String(clockOut).split(":").map(Number);
        if (![inH, inM, outH, outM].some(Number.isNaN)) {
          const diffMin = outH * 60 + outM - (inH * 60 + inM);
          hours = Math.round((Math.max(0, diffMin) / 60) * 10) / 10;
        }
      }

      // Recompute late minutes from shift
      let lateMinutes: number = (log.late_minutes as number) ?? 0;
      const shiftId = employee?.shift_id || (log.shift_id as string | null);
      if (clockIn && shiftId) {
        const { data: shift } = await supabase
          .from("shift_templates")
          .select("start_time, grace_period")
          .eq("id", shiftId)
          .maybeSingle();

        if (shift?.start_time) {
          const [inH, inM] = String(clockIn).split(":").map(Number);
          const [shH, shM] = shift.start_time.split(":").map(Number);
          if (![inH, inM, shH, shM].some(Number.isNaN)) {
            const checkInMin = inH * 60 + inM;
            const shiftMin = shH * 60 + shM + (shift.grace_period ?? 0);
            lateMinutes = checkInMin > shiftMin ? checkInMin - shiftMin : 0;
          }
        }
      }

      updates.check_in = clockIn;
      updates.check_out = clockOut;
      updates.hours = hours;
      updates.late_minutes = lateMinutes;
      updates.check_in_method = "manual";
      updates.check_out_method = "manual";
      updates.attendance_status = "present";
      updates.status = "present";
      updates.approved_by = caller.id;
      updates.approved_at = now;
      updates.needs_review = false;
      auditAction = "attendance_correction";
    } else if (action === "add_remarks") {
      // Remarks-only — no log mutation, just audit
      auditAction = "attendance_correction";
    } else {
      return NextResponse.json({ ok: false, message: `Invalid action: ${action}` }, { status: 400 });
    }

    // Apply updates (skip for add_remarks — audit only)
    if (action !== "add_remarks") {
      const { error: updateErr } = await supabase
        .from("attendance_logs")
        .update(updates)
        .eq("id", id);
      if (updateErr) {
        return NextResponse.json({ ok: false, message: updateErr.message }, { status: 500 });
      }
    }

    // Fetch after snapshot for audit trail
    const { data: afterLog } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("id", id)
      .single();

    // Insert audit log
    await supabase.from("audit_logs").insert({
      id: `AUD-${nanoid(8)}`,
      entity_type: "attendance_logs",
      entity_id: id,
      action: auditAction,
      performed_by: caller.id,
      timestamp: now,
      reason: remarks ?? null,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterLog ?? null,
      company_id: companyId,
    });

    return NextResponse.json({ ok: true, message: `Action '${action}' applied successfully` });
  } catch (err) {
    console.error("PATCH /api/attendance/review error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

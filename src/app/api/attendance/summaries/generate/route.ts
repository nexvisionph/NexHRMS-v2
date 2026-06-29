import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

const ALLOWED_ROLES = ["admin", "hr", "payroll_admin"];



function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHours(m: number): number {
  return Math.round((m / 60) * 100) / 100;
}

function calcNightDiffMinutes(
  checkIn: string | null,
  checkOut: string | null,
  nightStart: number, // minutes from midnight, e.g. 22*60 = 1320
  nightEnd: number    // minutes from midnight, e.g. 6*60 = 360
): number {
  if (!checkIn || !checkOut) return 0;
  const inMin = timeToMinutes(checkIn);
  const outMin = timeToMinutes(checkOut);
  if (outMin <= inMin) return 0; // skip overnight splits for now

  let nightMins = 0;
  // Segment: checkIn to midnight (0-1440)
  if (inMin < outMin) {
    // Overlap with [nightStart, 1440) — after 10 PM
    const overlapStart = Math.max(inMin, nightStart);
    const overlapEnd = Math.min(outMin, 24 * 60);
    if (overlapEnd > overlapStart) nightMins += overlapEnd - overlapStart;
    // Overlap with [0, nightEnd) — before 6 AM  
    const overlapStart2 = Math.max(inMin, 0);
    const overlapEnd2 = Math.min(outMin, nightEnd);
    if (overlapEnd2 > overlapStart2) nightMins += overlapEnd2 - overlapStart2;
  }
  return nightMins;
}

/**
 * POST /api/attendance/summaries/generate
 * Generate attendance_summaries from attendance_logs for a date range.
 * Body: { startDate: string, endDate: string, employeeIds?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();

    // Resolve caller
    const { data: caller } = await supabase
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { startDate, endDate, employeeIds } = body ?? {};

    if (!startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "startDate and endDate required" },
        { status: 400 }
      );
    }

    // Fetch attendance logs for the period
    let logsQuery = supabase
      .from("attendance_logs")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);

    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      logsQuery = logsQuery.in("employee_id", employeeIds);
    }

    const { data: rawLogs, error: logsError } = await logsQuery;
    if (logsError) {
      return NextResponse.json({ ok: false, message: logsError.message }, { status: 500 });
    }

    if (!rawLogs || rawLogs.length === 0) {
      return NextResponse.json({ ok: true, generated: 0, message: "No logs found for period" });
    }

    // Fetch shifts for late/overtime/undertime calculation
    const empIds = Array.from(new Set(rawLogs.map((l: Record<string, unknown>) => l.employee_id as string)));

    const { data: empShifts } = await supabase
      .from("employee_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", empIds);

    const { data: allShifts } = await supabase
      .from("shift_templates")
      .select("id, start_time, end_time, grace_period, break_duration");

    const shiftByEmployee: Record<string, string> = {};
    for (const es of empShifts ?? []) {
      shiftByEmployee[es.employee_id] = es.shift_id;
    }

    const shiftById: Record<string, { start_time: string; end_time: string; grace_period: number; break_duration: number }> = {};
    for (const s of allShifts ?? []) {
      shiftById[s.id] = s;
    }

    // Fetch reconciliation priority settings
    const { data: locConfig } = await supabase
      .from("location_config")
      .select("reconciliation_priority")
      .eq("id", "default")
      .single();

    const priorityArray: string[] = locConfig?.reconciliation_priority ?? ["biometric", "mobile_gps", "web", "manual"];
    // Map priority array to priority scores: elements earlier in the array have HIGHER priority
    const dynamicPriorityMap: Record<string, number> = {};
    priorityArray.forEach((source, index) => {
      dynamicPriorityMap[source] = priorityArray.length - index;
    });

    // Group logs by employee+date, pick best source
    type LogRow = Record<string, unknown>;
    const grouped: Record<string, LogRow[]> = {};
    for (const log of rawLogs as LogRow[]) {
      const key = `${log.employee_id}_${log.date}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    }

    // Night diff settings (DOLE PH defaults: 22:00–06:00)
    const NIGHT_START = 22 * 60; // 1320 minutes
    const NIGHT_END = 6 * 60;    // 360 minutes

    const summaries: Record<string, unknown>[] = [];

    for (const [, dayLogs] of Object.entries(grouped)) {
      // Pick highest-priority source log
      const primaryLog = dayLogs.reduce((best, cur) => {
        const bestPriority = dynamicPriorityMap[best.source as string] ?? 0;
        const curPriority = dynamicPriorityMap[cur.source as string] ?? 0;
        return curPriority > bestPriority ? cur : best;
      });

      const employeeId = primaryLog.employee_id as string;
      const attendanceDate = primaryLog.date as string;
      const checkIn = primaryLog.check_in as string | null;
      const checkOut = primaryLog.check_out as string | null;
      const hours = primaryLog.hours != null ? Number(primaryLog.hours) : null;

      // Resolve shift
      const shiftId = shiftByEmployee[employeeId] || (primaryLog.shift_id as string | null);
      const shift = shiftId ? shiftById[shiftId] : null;

      // Compute work hours
      let totalWorkHours = hours ?? 0;
      let lateMinutes = (primaryLog.late_minutes as number) ?? 0;
      let undertimeMinutes = 0;
      let overtimeMinutes = 0;
      let nightDiffMinutes = 0;

      if (checkIn && checkOut) {
        const inMin = timeToMinutes(checkIn);
        const outMin = timeToMinutes(checkOut);
        const rawWorkMin = Math.max(0, outMin - inMin);
        const breakMin = shift?.break_duration ?? 60;
        const netWorkMin = Math.max(0, rawWorkMin - breakMin);
        totalWorkHours = minutesToHours(netWorkMin);

        if (shift) {
          const shiftStartMin = timeToMinutes(shift.start_time);
          const shiftEndMin = timeToMinutes(shift.end_time);
          const shiftDurationMin = Math.max(0, shiftEndMin - shiftStartMin - breakMin);

          // Late minutes (recompute from shift)
          const grace = shift.grace_period ?? 0;
          lateMinutes = Math.max(0, inMin - (shiftStartMin + grace));

          // Undertime: scheduled hours - actual hours (floored at 0)
          undertimeMinutes = Math.max(0, shiftDurationMin - netWorkMin);

          // Overtime: worked beyond shift end
          overtimeMinutes = Math.max(0, outMin - shiftEndMin);
        }

        // Night differential minutes
        nightDiffMinutes = calcNightDiffMinutes(checkIn, checkOut, NIGHT_START, NIGHT_END);
      }

      // Determine attendance status
      let attendanceStatus = primaryLog.attendance_status as string || primaryLog.status as string || "present";
      if (!["present", "absent", "late", "undertime", "half_day", "rest_day_work", "holiday_work", "pending_review"].includes(attendanceStatus)) {
        attendanceStatus = "present";
      }
      if (lateMinutes > 0 && attendanceStatus === "present") {
        attendanceStatus = "late";
      }

      // Build source summary string
      const uniqueSources = Array.from(
        new Set(
          dayLogs
            .map((l) => l.source as string || l.check_in_method as string || "web")
            .filter(Boolean)
        )
      );

      const sources = dayLogs.length > 1
        ? `[${uniqueSources.join(", ")}] (Reconciled: ${primaryLog.source})`
        : uniqueSources.join(", ");

      summaries.push({
        id: `AS-${employeeId}-${attendanceDate}`,
        employee_id: employeeId,
        attendance_date: attendanceDate,
        first_clock_in: checkIn,
        last_clock_out: checkOut,
        total_work_hours: totalWorkHours,
        late_minutes: lateMinutes,
        undertime_minutes: undertimeMinutes,
        overtime_minutes: overtimeMinutes,
        night_diff_minutes: nightDiffMinutes,
        attendance_status: attendanceStatus,
        attendance_source_summary: sources,
        scheduled_shift_id: shiftId ?? null,
        approved_by: primaryLog.approved_by as string ?? null,
        approved_at: primaryLog.approved_at as string ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    if (summaries.length === 0) {
      return NextResponse.json({ ok: true, generated: 0 });
    }

    // Upsert summaries (one row per employee+date)
    const { error: upsertErr } = await supabase
      .from("attendance_summaries")
      .upsert(summaries, { onConflict: "employee_id,attendance_date" });

    if (upsertErr) {
      return NextResponse.json({ ok: false, message: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      generated: summaries.length,
      message: `Generated ${summaries.length} attendance summary records`,
    });
  } catch (err) {
    console.error("POST /api/attendance/summaries/generate error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

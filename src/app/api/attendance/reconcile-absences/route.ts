/**
 * POST /api/attendance/reconcile-absences
 *
 * Automatically marks employees as "absent" for past work days where they
 * didn't check in. This ensures the attendance heatmap accurately reflects
 * missed days.
 *
 * Body (optional):
 *   - startDate: ISO date string (default: 30 days ago)
 *   - endDate: ISO date string (default: yesterday)
 *
 * Returns:
 *   - { ok: true, created: number, details: [...] }
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

interface ReconcileResult {
  employeeId: string;
  employeeName: string;
  date: string;
  status: "created" | "skipped";
  reason?: string;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let startDate: string;
  let endDate: string;
  try {
    const body = await req.json().catch(() => ({}));
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    startDate = body.startDate || thirtyDaysAgo.toISOString().split("T")[0];
    endDate = body.endDate || yesterday.toISOString().split("T")[0];
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 1. Get all active employees with their work_days
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, name, work_days, join_date, status")
    .eq("status", "active");

  if (empErr) {
    console.error("[reconcile-absences] Failed to fetch employees:", empErr);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }

  if (!employees || employees.length === 0) {
    return NextResponse.json({
      ok: true,
      created: 0,
      message: "No active employees found",
    });
  }

  // 2. Get all holidays in the date range
  const { data: holidays } = await supabase
    .from("holidays")
    .select("date")
    .gte("date", startDate)
    .lte("date", endDate);

  const holidaySet = new Set((holidays || []).map((h) => h.date));

  // 3. Get all existing attendance logs in the date range
  const { data: existingLogs } = await supabase
    .from("attendance_logs")
    .select("employee_id, date")
    .gte("date", startDate)
    .lte("date", endDate);

  // Build a set of "employeeId|date" for quick lookup
  const existingLogSet = new Set(
    (existingLogs || []).map((l) => `${l.employee_id}|${l.date}`)
  );

  // 4. Get all attendance events (check-ins) in the date range
  const { data: events } = await supabase
    .from("attendance_events")
    .select("employee_id, timestamp_utc")
    .eq("event_type", "IN")
    .gte("timestamp_utc", `${startDate}T00:00:00`)
    .lte("timestamp_utc", `${endDate}T23:59:59`);

  // Build a set of "employeeId|date" for employees who checked in
  const checkInSet = new Set(
    (events || []).map((e) => {
      const date = e.timestamp_utc.split("T")[0];
      return `${e.employee_id}|${date}`;
    })
  );

  // 5. Get all leave requests (approved) in the date range
  const { data: leaveRequests } = await supabase
    .from("leave_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .or(`start_date.lte.${endDate},end_date.gte.${startDate}`);

  // Build a helper to check if employee is on leave on a given date
  const onLeaveMap = new Map<string, Array<{ start: string; end: string }>>();
  for (const lr of leaveRequests || []) {
    const arr = onLeaveMap.get(lr.employee_id) || [];
    arr.push({ start: lr.start_date, end: lr.end_date });
    onLeaveMap.set(lr.employee_id, arr);
  }

  function isOnLeave(employeeId: string, date: string): boolean {
    const leaves = onLeaveMap.get(employeeId);
    if (!leaves) return false;
    return leaves.some((l) => date >= l.start && date <= l.end);
  }

  // 6. Generate all work days in the date range
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const workDays: string[] = [];
  const current = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay();

    // Skip holidays
    if (!holidaySet.has(dateStr)) {
      workDays.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  // 7. For each employee and each work day, check if they should be marked absent
  const toInsert: Array<{
    id: string;
    employee_id: string;
    date: string;
    status: string;
    created_at: string;
    updated_at: string;
  }> = [];

  const results: ReconcileResult[] = [];
  const now = new Date().toISOString();

  for (const emp of employees) {
    // Default work days if not set
    const empWorkDays: string[] =
      emp.work_days || ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const joinDate = emp.join_date || "2020-01-01";

    for (const date of workDays) {
      // Skip if date is before employee join date
      if (date < joinDate) continue;

      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      const dayName = dayNames[dayOfWeek];

      // Skip if not a work day for this employee
      if (!empWorkDays.includes(dayName)) continue;

      const key = `${emp.id}|${date}`;

      // Skip if already has a log
      if (existingLogSet.has(key)) {
        continue;
      }

      // Skip if employee checked in
      if (checkInSet.has(key)) {
        continue;
      }

      // Check if on approved leave
      if (isOnLeave(emp.id, date)) {
        // Create on_leave log instead of absent
        toInsert.push({
          id: `ATT-${date}-${emp.id}`,
          employee_id: emp.id,
          date,
          status: "on_leave",
          created_at: now,
          updated_at: now,
        });
        results.push({
          employeeId: emp.id,
          employeeName: emp.name,
          date,
          status: "created",
          reason: "on_leave",
        });
        existingLogSet.add(key); // Prevent duplicates
        continue;
      }

      // Mark as absent
      toInsert.push({
        id: `ATT-${date}-${emp.id}`,
        employee_id: emp.id,
        date,
        status: "absent",
        created_at: now,
        updated_at: now,
      });
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        date,
        status: "created",
        reason: "absent - no check-in",
      });
      existingLogSet.add(key); // Prevent duplicates
    }
  }

  // 8. Batch insert (upsert to handle any edge cases)
  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("attendance_logs")
      .upsert(toInsert, { onConflict: "id", ignoreDuplicates: true });

    if (insertErr) {
      console.error("[reconcile-absences] Insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to insert absence records", details: insertErr.message },
        { status: 500 }
      );
    }
  }

  console.log(
    `[reconcile-absences] Created ${toInsert.length} absence records for ${employees.length} employees (${startDate} to ${endDate})`
  );

  return NextResponse.json({
    ok: true,
    created: toInsert.length,
    employeesProcessed: employees.length,
    dateRange: { start: startDate, end: endDate },
    details: results.slice(0, 50), // Limit to first 50 for response size
  });
}

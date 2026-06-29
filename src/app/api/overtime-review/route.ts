import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { computeOTRecords, recalcApprovedAmount } from "@/lib/ot-computation";
import { nanoid } from "nanoid";
import type { AttendanceLog, ShiftTemplate, Holiday } from "@/types";
import { rowsToTs } from "@/lib/db-mappers";

const ALLOWED_ROLES = ["admin", "hr", "finance", "payroll_admin", "supervisor"];

async function resolveCallerEmployee(supabase: ReturnType<typeof createAdminSupabaseClient> extends Promise<infer T> ? T : never, userId: string, userEmail: string) {
  const { data } = await supabase
    .from("employees")
    .select("id, role, department")
    .or(`profile_id.eq.${userId},email.eq.${userEmail}`)
    .single();
  return data;
}

/**
 * GET /api/overtime-review
 * Fetch ot_records with optional filters.
 * Query params: periodStart, periodEnd, department, employeeId, status, otType
 */
export async function GET(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    const department = searchParams.get("department");
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const otType = searchParams.get("otType");

    let query = supabase
      .from("ot_records")
      .select(`
        *,
        employee:employees(id, name, department, job_title)
      `)
      .order("ot_date", { ascending: false });

    if (periodStart && periodEnd) {
      const periodId = `${periodStart}/${periodEnd}`;
      query = query.eq("payroll_period_id", periodId);
    }
    if (employeeId) query = query.eq("employee_id", employeeId);
    if (status) query = query.eq("status", status);
    if (otType) query = query.eq("ot_type", otType);

    // Supervisor: restrict to own department
    if (caller.role === "supervisor") {
      query = query.eq("employee.department", caller.department);
    }

    const { data: records, error } = await query;
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    // Department filter applied post-query (join filtering)
    const filtered = department
      ? (records ?? []).filter((r) => r.employee?.department === department)
      : (records ?? []);

    return NextResponse.json({ ok: true, records: filtered });
  } catch (err) {
    console.error("GET /api/overtime-review error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/overtime-review
 * Compute OT records for a payroll period from attendance_logs.
 * Body: { periodStart: string, periodEnd: string }
 */
export async function POST(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !["admin", "hr", "payroll_admin"].includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { periodStart, periodEnd } = body ?? {};
    if (!periodStart || !periodEnd) {
      return NextResponse.json({ ok: false, message: "periodStart and periodEnd required" }, { status: 400 });
    }

    const periodId = `${periodStart}/${periodEnd}`;

    // Load attendance logs for period (either present or computed)
    const { data: rawLogs } = await supabase
      .from("attendance_logs")
      .select("*")
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .in("status", ["present", "computed"]);

    // Load shifts + employee-shift mappings
    const { data: shiftTemplates } = await supabase.from("shift_templates").select("*");
    const { data: empShifts } = await supabase.from("employee_shifts").select("employee_id, shift_id");
    const { data: holidays } = await supabase
      .from("holidays")
      .select("*")
      .gte("date", periodStart)
      .lte("date", periodEnd);

    // Load employees for salary data (to compute hourly rates)
    const { data: employees } = await supabase
      .from("employees")
      .select("id, salary");

    // Load OT settings
    const { data: otSettingsRow } = await supabase
      .from("ot_settings")
      .select("*")
      .eq("id", "default")
      .single();

    const settings = {
      enableOtReview: otSettingsRow?.enable_ot_review ?? true,
      minimumOtMinutes: otSettingsRow?.minimum_ot_minutes ?? 30,
      otGracePeriodMinutes: otSettingsRow?.ot_grace_period_minutes ?? 0,
      requireSupervisorApproval: otSettingsRow?.require_supervisor_approval ?? false,
      allowPartialApproval: otSettingsRow?.allow_partial_approval ?? true,
      allowPayrollOfficerOverride: otSettingsRow?.allow_payroll_officer_override ?? true,
      includePendingInPayroll: otSettingsRow?.include_pending_in_payroll ?? false,
    };

    // Build hourly rate map: monthly_salary / 22 work days / 8 hours
    const hourlyRates: Record<string, number> = {};
    for (const emp of employees ?? []) {
      hourlyRates[emp.id] = Math.round((emp.salary / 22 / 8) * 100) / 100;
    }

    const employeeShifts: Record<string, string> = {};
    for (const es of empShifts ?? []) {
      employeeShifts[es.employee_id] = es.shift_id;
    }

    // Find existing OT records for this period to avoid duplicates
    const { data: existingRecords } = await supabase
      .from("ot_records")
      .select("attendance_id")
      .eq("payroll_period_id", periodId);
    const existingAttendanceIds = new Set((existingRecords ?? []).map((r) => r.attendance_id).filter(Boolean));

    // Map snake_case database logs to camelCase structures
    const mappedLogs = (rowsToTs(rawLogs ?? []) as any[]).map(l => ({
      ...l,
      status: (l.status as string) === "computed" ? "present" : l.status
    })) as AttendanceLog[];

    const mappedShifts = rowsToTs(shiftTemplates ?? []) as any as ShiftTemplate[];

    // Filter logs that don't already have an OT record
    const logsToProcess = mappedLogs.filter((l) => !existingAttendanceIds.has(l.id));

    const computed = computeOTRecords({
      logs: logsToProcess,
      shiftTemplates: mappedShifts,
      employeeShifts,
      holidays: (holidays ?? []) as Holiday[],
      settings,
      payrollPeriodId: periodId,
      hourlyRates,
    });

    if (computed.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: logsToProcess.length });
    }

    // Insert OT records
    const rows = computed.map((r) => ({
      id: r.id,
      employee_id: r.employeeId,
      attendance_id: r.attendanceId,
      payroll_period_id: r.payrollPeriodId,
      ot_date: r.otDate,
      scheduled_time_out: r.scheduledTimeOut,
      actual_time_out: r.actualTimeOut,
      computed_ot_hours: r.computedOtHours,
      ot_type: r.otType,
      computed_amount: r.computedAmount,
      status: "pending",
    }));

    const { error: insertErr } = await supabase.from("ot_records").insert(rows);
    if (insertErr) {
      return NextResponse.json({ ok: false, message: insertErr.message }, { status: 500 });
    }

    // Write audit logs (system computed)
    const auditRows = computed.map((r) => ({
      id: `OTAL-${nanoid(8)}`,
      ot_record_id: r.id,
      action: "computed",
      new_value: { status: "pending", computedOtHours: r.computedOtHours, otType: r.otType },
      performed_by: "SYSTEM",
      performed_at: new Date().toISOString(),
    }));
    await supabase.from("ot_audit_logs").insert(auditRows).throwOnError();

    return NextResponse.json({ ok: true, created: computed.length, skipped: logsToProcess.length - computed.length });
  } catch (err) {
    console.error("POST /api/overtime-review error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/overtime-review
 * Batch approve/reject OT records.
 * Body: { action: "batch_approve" | "batch_reject" | "mark_included_in_payroll", ids: string[], remarks?, reviewedBy? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !["admin", "hr", "payroll_admin", "finance"].includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, ids, remarks, reviewedBy } = body ?? {};

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, message: "action and ids[] required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const performedBy = reviewedBy ?? caller.id;

    if (action === "batch_approve") {
      // Fetch records to get computed hours for approved_hours/amount
      const { data: records } = await supabase
        .from("ot_records")
        .select("id, computed_ot_hours, computed_amount, ot_type")
        .in("id", ids);

      for (const record of records ?? []) {
        await supabase.from("ot_records").update({
          status: "approved",
          approved_ot_hours: record.computed_ot_hours,
          approved_amount: record.computed_amount,
          reviewed_by: performedBy,
          reviewed_at: now,
          remarks: remarks ?? null,
          updated_at: now,
        }).eq("id", record.id);
      }

      const auditRows = (records ?? []).map((r) => ({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: r.id,
        action: "approved",
        old_value: { status: "pending" },
        new_value: { status: "approved", approvedOtHours: r.computed_ot_hours },
        performed_by: performedBy,
        performed_at: now,
        remarks: remarks ?? null,
      }));
      if (auditRows.length > 0) await supabase.from("ot_audit_logs").insert(auditRows);

    } else if (action === "batch_reject") {
      await supabase.from("ot_records").update({
        status: "rejected",
        approved_ot_hours: 0,
        approved_amount: 0,
        reviewed_by: performedBy,
        reviewed_at: now,
        remarks: remarks ?? null,
        updated_at: now,
      }).in("id", ids);

      const auditRows = ids.map((id) => ({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: id,
        action: "rejected",
        old_value: { status: "pending" },
        new_value: { status: "rejected" },
        performed_by: performedBy,
        performed_at: now,
        remarks: remarks ?? null,
      }));
      await supabase.from("ot_audit_logs").insert(auditRows);

    } else if (action === "mark_included_in_payroll") {
      await supabase.from("ot_records").update({
        status: "included_in_payroll",
        updated_at: now,
      }).in("id", ids);

      const auditRows = ids.map((id) => ({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: id,
        action: "included_in_payroll",
        new_value: { status: "included_in_payroll" },
        performed_by: performedBy,
        performed_at: now,
      }));
      await supabase.from("ot_audit_logs").insert(auditRows);

    } else {
      return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (err) {
    console.error("PATCH /api/overtime-review error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

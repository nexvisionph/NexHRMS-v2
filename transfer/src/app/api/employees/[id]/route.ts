import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function deleteWhere(
  admin: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  table: string,
  column: string,
  value: string
) {
  const { error } = await admin.from(table).delete().eq(column, value);
  if (error && error.code !== "42P01") {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function deleteIn(
  admin: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  table: string,
  column: string,
  values: string[]
) {
  if (values.length === 0) return;
  const { error } = await admin.from(table).delete().in(column, values);
  if (error && error.code !== "42P01") {
    throw new Error(`${table}: ${error.message}`);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing employee id" }, { status: 400 });
    }

    const serverSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminSupabaseClient();
    const { data: actor, error: actorError } = await admin
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email ?? ""}`)
      .limit(1)
      .maybeSingle();

    if (actorError) {
      console.error("[employees/delete] actor lookup:", actorError.message);
      return NextResponse.json({ ok: false, error: "Actor lookup failed" }, { status: 500 });
    }

    const actorRole = String(actor?.role || "").toLowerCase();
    if (!["admin", "hr"].includes(actorRole)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (actor?.id === id) {
      return NextResponse.json({ ok: false, error: "You cannot delete your own employee record" }, { status: 400 });
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, profile_id")
      .eq("id", id)
      .maybeSingle();

    if (employeeError) {
      console.error("[employees/delete] employee lookup:", employeeError.message);
      return NextResponse.json({ ok: false, error: "Employee lookup failed" }, { status: 500 });
    }

    if (!employee?.id) {
      return NextResponse.json({ ok: true, deleted: false });
    }

    const { data: eventRows } = await admin
      .from("attendance_events")
      .select("id")
      .eq("employee_id", id);
    const eventIds = (eventRows ?? []).map((row) => row.id).filter(Boolean);

    const { data: loanRows } = await admin
      .from("loans")
      .select("id")
      .eq("employee_id", id);
    const loanIds = (loanRows ?? []).map((row) => row.id).filter(Boolean);

    const { data: payslipRows } = await admin
      .from("payslips")
      .select("id")
      .eq("employee_id", id);
    const payslipIds = (payslipRows ?? []).map((row) => row.id).filter(Boolean);

    await deleteIn(admin, "attendance_evidence", "event_id", eventIds);
    await deleteWhere(admin, "attendance_exceptions", "employee_id", id);
    await deleteWhere(admin, "attendance_events", "employee_id", id);
    await deleteWhere(admin, "attendance_logs", "employee_id", id);

    await deleteWhere(admin, "employee_shifts", "employee_id", id);
    await deleteWhere(admin, "employee_documents", "employee_id", id);
    await deleteWhere(admin, "face_enrollments", "employee_id", id);
    await deleteWhere(admin, "project_assignments", "employee_id", id);
    await deleteWhere(admin, "qr_tokens", "employee_id", id);

    await deleteWhere(admin, "leave_balances", "employee_id", id);
    await deleteWhere(admin, "leave_requests", "employee_id", id);
    await deleteWhere(admin, "overtime_requests", "employee_id", id);
    await deleteWhere(admin, "penalty_records", "employee_id", id);
    await deleteWhere(admin, "manual_checkins", "employee_id", id);
    await deleteWhere(admin, "manual_checkins", "performed_by", id);
    await deleteWhere(admin, "notification_logs", "employee_id", id);
    await deleteWhere(admin, "push_subscriptions", "employee_id", id);

    await deleteWhere(admin, "location_pings", "employee_id", id);
    await deleteWhere(admin, "break_records", "employee_id", id);
    await deleteWhere(admin, "site_survey_photos", "employee_id", id);
    await deleteWhere(admin, "task_comments", "employee_id", id);
    await deleteWhere(admin, "task_completion_reports", "employee_id", id);
    await deleteWhere(admin, "timesheets", "employee_id", id);

    await deleteWhere(admin, "salary_change_requests", "employee_id", id);
    await deleteWhere(admin, "salary_history", "employee_id", id);
    await deleteWhere(admin, "payroll_adjustments", "employee_id", id);
    await deleteWhere(admin, "final_pay_computations", "employee_id", id);
    await deleteWhere(admin, "deduction_overrides", "employee_id", id);
    await deleteWhere(admin, "employee_deduction_assignments", "employee_id", id);

    await deleteIn(admin, "loan_deductions", "loan_id", loanIds);
    await deleteIn(admin, "loan_repayment_schedule", "loan_id", loanIds);
    await deleteIn(admin, "loan_balance_history", "loan_id", loanIds);
    await deleteWhere(admin, "loans", "employee_id", id);

    await deleteIn(admin, "payslip_line_items", "payslip_id", payslipIds);
    await deleteIn(admin, "payroll_run_payslips", "payslip_id", payslipIds);
    await deleteWhere(admin, "payslips", "employee_id", id);

    const { error: deleteError } = await admin.from("employees").delete().eq("id", id);
    if (deleteError) {
      console.error("[employees/delete] employee delete:", deleteError.message);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[employees/delete] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Employee delete failed" },
      { status: 500 }
    );
  }
}

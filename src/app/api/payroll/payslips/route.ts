import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { keysToSnake } from "@/lib/db-utils";
import type { Payslip, PayrollRun } from "@/types";

const ALLOWED_ROLES = ["admin", "hr", "finance", "payroll_admin"];

/**
 * POST /api/payroll/payslips
 * Create or update payslips and their parent run (admin client — bypasses RLS).
 * Body: { payslips: Payslip[], run?: PayrollRun }
 */
export async function POST(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();

    const { data: emp } = await supabase
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!emp || !ALLOWED_ROLES.includes(emp.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { payslips, run } = body as { payslips: Payslip[]; run?: PayrollRun };

    if (!Array.isArray(payslips) || payslips.length === 0) {
      return NextResponse.json({ ok: false, message: "payslips array required" }, { status: 400 });
    }

    // Strip local-only fields and convert keys to snake_case
    const rows = payslips.map((ps) => {
      const row: Record<string, unknown> = { ...(ps as unknown as Record<string, unknown>) };
      delete row.holdNote;
      delete row.heldAt;
      delete row.grossOverrideApplied;
      delete row.attendanceDaysPresent;
      delete row.attendanceDaysAbsent;
      delete row.attendanceLateMinutes;
      delete row.attendanceUndertimeHours;
      return keysToSnake(row);
    });

    const { error: upsertErr } = await supabase
      .from("payslips")
      .upsert(rows, { onConflict: "id" });

    if (upsertErr) {
      console.error("[api/payroll/payslips] payslip upsert error:", upsertErr);
      return NextResponse.json({ ok: false, message: upsertErr.message }, { status: 500 });
    }

    // Upsert run if provided
    if (run) {
      const runRow: Record<string, unknown> = { ...(run as unknown as Record<string, unknown>) };
      const payslipIds = (runRow.payslipIds as string[]) ?? [];
      delete runRow.payslipIds;
      const dbRun = keysToSnake(runRow);

      const { error: runErr } = await supabase
        .from("payroll_runs")
        .upsert(dbRun, { onConflict: "id" });

      if (runErr) {
        console.error("[api/payroll/payslips] run upsert error:", runErr);
      }

      // Sync junction table
      if (payslipIds.length > 0 && run.id) {
        const junctionRows = payslipIds.map((pid) => ({ run_id: run.id, payslip_id: pid }));
        await supabase
          .from("payroll_run_payslips")
          .upsert(junctionRows, { onConflict: "run_id,payslip_id" });
      }
    }

    return NextResponse.json({ ok: true, count: payslips.length });
  } catch (err) {
    console.error("[api/payroll/payslips] error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/payslips
 * Delete payslips by IDs (admin client — bypasses RLS).
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();

    const { data: emp } = await supabase
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!emp || !ALLOWED_ROLES.includes(emp.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, message: "ids array required" }, { status: 400 });
    }

    const { error } = await supabase.from("payslips").delete().in("id", ids);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error("[api/payroll/payslips] delete error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

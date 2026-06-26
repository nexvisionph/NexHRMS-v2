import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { recalcApprovedAmount, deriveOTStatus } from "@/lib/ot-computation";
import { nanoid } from "nanoid";

const ALLOWED_ROLES = ["admin", "hr", "finance", "payroll_admin", "supervisor"];

/**
 * GET /api/overtime-review/[id]
 * Fetch a single OT record + its audit logs.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const params = { id };
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const { data: caller } = await supabase
      .from("employees")
      .select("id, role, department")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!caller || !ALLOWED_ROLES.includes(caller.role)) {
      // Also allow employee to view own record
      const { data: record } = await supabase
        .from("ot_records")
        .select("employee_id")
        .eq("id", params.id)
        .single();
      if (!record || record.employee_id !== caller?.id) {
        return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const { data: record, error } = await supabase
      .from("ot_records")
      .select(`*, employee:employees(id, name, department, job_title)`)
      .eq("id", params.id)
      .single();

    if (error || !record) {
      return NextResponse.json({ ok: false, message: "OT record not found" }, { status: 404 });
    }

    const { data: auditLogs } = await supabase
      .from("ot_audit_logs")
      .select("*")
      .eq("ot_record_id", params.id)
      .order("performed_at", { ascending: false });

    return NextResponse.json({ ok: true, record, auditLogs: auditLogs ?? [] });
  } catch (err) {
    console.error(`GET /api/overtime-review/${params.id} error:`, err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/overtime-review/[id]
 * Approve, partially approve, or reject a single OT record.
 * Body: { action: "approve"|"reject"|"lock", approvedOtHours?, remarks?, reviewedBy? }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const params = { id };
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const { data: caller } = await supabase
      .from("employees")
      .select("id, role, salary")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!caller || !["admin", "hr", "finance", "payroll_admin"].includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, approvedOtHours, remarks, reviewedBy } = body ?? {};

    // Fetch current record
    const { data: record, error: fetchErr } = await supabase
      .from("ot_records")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({ ok: false, message: "OT record not found" }, { status: 404 });
    }

    if (record.status === "locked" || record.status === "included_in_payroll") {
      return NextResponse.json({ ok: false, message: `Record is ${record.status} and cannot be modified` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const performedBy = reviewedBy ?? caller.id;

    if (action === "approve") {
      const approved = approvedOtHours != null ? Number(approvedOtHours) : record.computed_ot_hours;
      const newStatus = deriveOTStatus(record.computed_ot_hours, approved);

      // Get employee hourly rate
      const { data: emp } = await supabase
        .from("employees")
        .select("salary")
        .eq("id", record.employee_id)
        .single();
      const hourlyRate = emp ? Math.round((emp.salary / 22 / 8) * 100) / 100 : 0;
      const approvedAmount = recalcApprovedAmount(approved, record.ot_type, hourlyRate);

      await supabase.from("ot_records").update({
        status: newStatus,
        approved_ot_hours: approved,
        approved_amount: approvedAmount,
        reviewed_by: performedBy,
        reviewed_at: now,
        remarks: remarks ?? record.remarks,
        updated_at: now,
      }).eq("id", params.id);

      await supabase.from("ot_audit_logs").insert({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: params.id,
        action: newStatus,
        old_value: { status: record.status, approvedOtHours: record.approved_ot_hours },
        new_value: { status: newStatus, approvedOtHours: approved, approvedAmount },
        performed_by: performedBy,
        performed_at: now,
        remarks: remarks ?? null,
      });

      return NextResponse.json({ ok: true, status: newStatus, approvedOtHours: approved, approvedAmount });

    } else if (action === "reject") {
      await supabase.from("ot_records").update({
        status: "rejected",
        approved_ot_hours: 0,
        approved_amount: 0,
        reviewed_by: performedBy,
        reviewed_at: now,
        remarks: remarks ?? null,
        updated_at: now,
      }).eq("id", params.id);

      await supabase.from("ot_audit_logs").insert({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: params.id,
        action: "rejected",
        old_value: { status: record.status },
        new_value: { status: "rejected" },
        performed_by: performedBy,
        performed_at: now,
        remarks: remarks ?? null,
      });

      return NextResponse.json({ ok: true, status: "rejected" });

    } else if (action === "lock") {
      await supabase.from("ot_records").update({
        status: "locked",
        updated_at: now,
      }).eq("id", params.id);

      await supabase.from("ot_audit_logs").insert({
        id: `OTAL-${nanoid(8)}`,
        ot_record_id: params.id,
        action: "locked",
        old_value: { status: record.status },
        new_value: { status: "locked" },
        performed_by: performedBy,
        performed_at: now,
      });

      return NextResponse.json({ ok: true, status: "locked" });

    } else {
      return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error(`PATCH /api/overtime-review/${params.id} error:`, err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

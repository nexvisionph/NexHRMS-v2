import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { nanoid } from "nanoid";

/**
 * POST /api/attendance/overtime
 * Submit a new overtime request. The caller must be authenticated; the
 * request is filed against the calling user's employee record (or the
 * provided employeeId if the caller is admin/HR/supervisor filing on behalf).
 * Body: { employeeId?, date, hoursRequested, reason, projectId? }
 */
export async function POST(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();

    // Resolve the calling employee
    const { data: callerEmp } = await supabase
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!callerEmp) {
      return NextResponse.json({ ok: false, message: "Employee record not found" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, date, hoursRequested, reason, projectId } = body ?? {};

    // Default the OT subject to the caller; admins/HR/supervisors may file on behalf.
    const subjectId =
      employeeId && employeeId !== callerEmp.id
        ? (["admin", "hr", "supervisor", "payroll_admin"].includes(callerEmp.role) ? employeeId : null)
        : callerEmp.id;

    if (!subjectId) {
      return NextResponse.json({ ok: false, message: "Forbidden — cannot file OT for another employee" }, { status: 403 });
    }
    if (!date || typeof date !== "string") {
      return NextResponse.json({ ok: false, message: "date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    const hours = Number(hoursRequested);
    if (!Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json({ ok: false, message: "hoursRequested must be > 0" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json({ ok: false, message: "reason is required (min 3 chars)" }, { status: 400 });
    }

    const id = `OT-${nanoid(8)}`;
    const now = new Date().toISOString();

    const row = {
      id,
      employee_id: subjectId,
      date,
      hours_requested: hours,
      reason: reason.trim(),
      project_id: projectId ?? null,
      status: "pending" as const,
      requested_at: now,
    };

    const { error: insertErr } = await supabase.from("overtime_requests").insert(row);
    if (insertErr) {
      return NextResponse.json({ ok: false, message: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      request: {
        id,
        employeeId: subjectId,
        date,
        hoursRequested: hours,
        reason: reason.trim(),
        projectId: projectId ?? undefined,
        status: "pending",
        requestedAt: now,
      },
    });
  } catch (err) {
    console.error("POST /api/attendance/overtime error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/attendance/overtime
 * Approve or reject an overtime request.
 * Body: { id, action: "approve" | "reject", reason?: string }
 * Admin/HR/Supervisor only.
 */
export async function PUT(request: NextRequest) {
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

    if (!emp || !["admin", "hr", "supervisor", "payroll_admin"].includes(emp.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, reason } = body;

    if (!id || !action) {
      return NextResponse.json({ ok: false, message: "id and action are required" }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, message: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    // Fetch the OT request
    const { data: otReq, error: fetchErr } = await supabase
      .from("overtime_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !otReq) {
      return NextResponse.json({ ok: false, message: "Overtime request not found" }, { status: 404 });
    }

    if (otReq.status !== "pending") {
      return NextResponse.json({ ok: false, message: `Request already ${otReq.status}` }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "approve") {
      // Update OT request status
      const { error: updateErr } = await supabase
        .from("overtime_requests")
        .update({ status: "approved", reviewed_by: emp.id, reviewed_at: now })
        .eq("id", id);

      if (updateErr) {
        return NextResponse.json({ ok: false, message: updateErr.message }, { status: 500 });
      }

      // Also update the attendance log with approved OT hours
      if (otReq.date && otReq.employee_id) {
        const { data: log } = await supabase
          .from("attendance_logs")
          .select("id, approved_ot_hours")
          .eq("employee_id", otReq.employee_id)
          .eq("date", otReq.date)
          .single();

        if (log) {
          const currentOT = log.approved_ot_hours ?? 0;
          await supabase
            .from("attendance_logs")
            .update({ approved_ot_hours: currentOT + (otReq.hours_requested ?? 0), updated_at: now })
            .eq("id", log.id);
        }
      }

      return NextResponse.json({ ok: true, status: "approved" });
    } else {
      // Reject
      const { error: updateErr } = await supabase
        .from("overtime_requests")
        .update({ status: "rejected", reviewed_by: emp.id, reviewed_at: now, rejection_reason: reason || "" })
        .eq("id", id);

      if (updateErr) {
        return NextResponse.json({ ok: false, message: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: "rejected" });
    }
  } catch (err) {
    console.error("PUT /api/attendance/overtime error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

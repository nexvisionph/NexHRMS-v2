import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/payroll/acknowledge
 * Employee acknowledges receipt of payment after signing.
 * Body: { payslipId, employeeId }
 * Auth: Requires valid Supabase session; verifies employee ownership.
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rl = kioskRateLimiter.check(getClientIp(request));
  if (!rl.ok) {
    return NextResponse.json({ ok: false, message: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { payslipId, employeeId } = body;

    if (!payslipId || !employeeId) {
      return NextResponse.json(
        { ok: false, message: "Missing payslipId or employeeId" },
        { status: 400 }
      );
    }

    // Authenticate the caller via session
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminSupabaseClient();

    // Verify the session user owns this employee record
    // Check by profile_id first, fallback to email if profile_id is null
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, profile_id, email")
      .eq("id", employeeId)
      .single();

    if (empErr || !emp) {
      return NextResponse.json(
        { ok: false, message: "Employee not found" },
        { status: 404 }
      );
    }

    // Ownership check: profile_id match OR email match (for unlinked employees)
    const ownsEmployee = emp.profile_id === user.id || emp.email?.toLowerCase() === user.email?.toLowerCase();
    if (!ownsEmployee) {
      return NextResponse.json(
        { ok: false, message: "Forbidden — employee does not match session" },
        { status: 403 }
      );
    }

    // Verify payslip exists and belongs to the employee
    const { data: payslip, error: fetchErr } = await supabase
      .from("payslips")
      .select("id, employee_id, status, signed_at, acknowledged_at")
      .eq("id", payslipId)
      .single();

    if (fetchErr || !payslip) {
      return NextResponse.json(
        { ok: false, message: "Payslip not found" },
        { status: 404 }
      );
    }

    if (payslip.employee_id !== employeeId) {
      return NextResponse.json(
        { ok: false, message: "Payslip does not belong to this employee" },
        { status: 403 }
      );
    }

    if (payslip.acknowledged_at) {
      return NextResponse.json(
        { ok: false, message: "Payslip already acknowledged" },
        { status: 409 }
      );
    }

    if (payslip.status !== "paid") {
      return NextResponse.json(
        { ok: false, message: `Cannot acknowledge payslip in "${payslip.status}" status. Must be paid.` },
        { status: 400 }
      );
    }

    if (!payslip.signed_at) {
      return NextResponse.json(
        { ok: false, message: "Must sign payslip before acknowledging" },
        { status: 400 }
      );
    }

    // Update payslip
    const now = new Date().toISOString();
    const { data: updatedPayslip, error: updateErr } = await supabase
      .from("payslips")
      .update({
        status: "acknowledged",
        acknowledged_at: now,
        acknowledged_by: employeeId,
      })
      .eq("id", payslipId)
      .select()
      .single();

    if (updateErr) {
      console.error("[api/payroll/acknowledge] update error:", updateErr.message);
      return NextResponse.json(
        { ok: false, message: "Failed to acknowledge payslip" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, acknowledgedAt: now, payslip: updatedPayslip });
  } catch (err) {
    console.error("[api/payroll/acknowledge] error:", err);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

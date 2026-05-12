import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/payroll/sign
 * Employee e-signs a payslip to acknowledge receipt.
 * Body: { payslipId, employeeId, signatureDataUrl }
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
    const { payslipId, employeeId, signatureDataUrl } = body;

    if (!payslipId || !employeeId || !signatureDataUrl) {
      return NextResponse.json(
        { ok: false, message: "Missing payslipId, employeeId, or signatureDataUrl" },
        { status: 400 }
      );
    }

    // Validate signature is a data URL (not arbitrary content)
    if (!signatureDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { ok: false, message: "Invalid signature format" },
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

    // Verify the requested employeeId belongs to the session user.
    // The client resolves myEmployee by profile_id, email, OR name — we must accept all 3.
    const { data: requestedEmp } = await supabase
      .from("employees")
      .select("id, profile_id, email, name")
      .eq("id", employeeId)
      .single();

    if (!requestedEmp) {
      return NextResponse.json(
        { ok: false, message: "Employee not found" },
        { status: 404 }
      );
    }

    // Check ownership: does this employee belong to the authenticated user?
    const { data: profile } = await serverClient
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    const ownsEmployee =
      requestedEmp.profile_id === user.id ||
      (user.email && requestedEmp.email?.toLowerCase() === user.email.toLowerCase()) ||
      (profile?.name && requestedEmp.name?.toLowerCase() === profile.name.toLowerCase());

    if (!ownsEmployee) {
      console.warn("[api/payroll/sign] ownership mismatch:", {
        authUserId: user.id,
        authEmail: user.email,
        profileName: profile?.name,
        requestedEmp: { id: requestedEmp.id, profile_id: requestedEmp.profile_id, email: requestedEmp.email, name: requestedEmp.name },
      });
      return NextResponse.json(
        { ok: false, message: "Forbidden — employee does not match session" },
        { status: 403 }
      );
    }

    // Auto-fix stale profile_id if needed
    if (requestedEmp.profile_id !== user.id) {
      await supabase.from("employees").update({ profile_id: user.id }).eq("id", employeeId);
    }

    // Verify payslip exists and belongs to the employee
    const { data: payslip, error: fetchErr } = await supabase
      .from("payslips")
      .select("id, employee_id, status, signed_at")
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

    if (payslip.signed_at) {
      return NextResponse.json(
        { ok: false, message: "Payslip already signed" },
        { status: 409 }
      );
    }

    if (payslip.status !== "published") {
      return NextResponse.json(
        { ok: false, message: `Cannot sign payslip in "${payslip.status}" status. Must be published.` },
        { status: 400 }
      );
    }

    // Update payslip with signature and transition to "signed" status
    const now = new Date().toISOString();
    const { data: updatedPayslip, error: updateErr } = await supabase
      .from("payslips")
      .update({
        status: "signed",
        signed_at: now,
        signature_data_url: signatureDataUrl,
      })
      .eq("id", payslipId)
      .select()
      .single();

    if (updateErr) {
      console.error("[api/payroll/sign] update error:", updateErr.message);
      return NextResponse.json(
        { ok: false, message: "Failed to save signature" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, signedAt: now, payslip: updatedPayslip });
  } catch (err) {
    console.error("[api/payroll/sign] error:", err);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

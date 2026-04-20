import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";

const MAX_BATCH_SIZE = 100;

/**
 * POST /api/payroll/status
 * Admin/Finance transitions a payslip or batch of payslips to the next status.
 * Body: { payslipIds: string[], action: "confirm" | "publish" | "record_payment", paymentMethod?, bankReferenceId?, cashAmount?, paymentProofUrl?, performedBy }
 * Auth: Requires valid Supabase session with admin/finance/payroll_admin role.
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rl = kioskRateLimiter.check(getClientIp(request));
  if (!rl.ok) {
    return NextResponse.json({ ok: false, message: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { payslipIds, action, paymentMethod, bankReferenceId, cashAmount, paymentProofUrl, performedBy } = body;

    if (!payslipIds || !Array.isArray(payslipIds) || payslipIds.length === 0 || !action || !performedBy) {
      return NextResponse.json(
        { ok: false, message: "Missing payslipIds, action, or performedBy" },
        { status: 400 }
      );
    }

    if (payslipIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { ok: false, message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    const validActions = ["confirm", "publish", "record_payment"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { ok: false, message: `Invalid action. Must be one of: ${validActions.join(", ")}` },
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

    // Verify the caller has an admin/finance/payroll_admin role
    const { data: profile } = await supabase
      .from("employees")
      .select("role")
      .eq("profile_id", user.id)
      .single();

    const allowedRoles = ["admin", "finance", "payroll_admin"];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { ok: false, message: "Forbidden — requires admin, finance, or payroll_admin role" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const errors: string[] = [];

    // Determine required status and update payload for this action
    let requiredStatus = "";
    let update: Record<string, unknown> = {};

    switch (action) {
      case "confirm":
        // In the simplified flow, confirm is a no-op — go straight to publish
        requiredStatus = "draft";
        update = { status: "draft" };
        break;
      case "publish":
        requiredStatus = "draft";
        update = { status: "published", published_at: now };
        break;
      case "record_payment":
        requiredStatus = "signed";
        update = {
          paid_at: now,
          payment_method: paymentMethod || "bank_transfer",
          bank_reference_id: bankReferenceId || null,
          cash_amount: paymentMethod === "cash" ? cashAmount : null,
          payment_proof_url: paymentProofUrl || null,
          paid_confirmed_by: performedBy,
          paid_confirmed_at: now,
        };
        break;
    }

    // Batch fetch all payslips in a single query
    const { data: allPayslips, error: fetchErr } = await supabase
      .from("payslips")
      .select("id, status")
      .in("id", payslipIds);

    if (fetchErr) {
      return NextResponse.json({ ok: false, message: "Failed to fetch payslips" }, { status: 500 });
    }

    const fetchedMap = new Map((allPayslips ?? []).map((p) => [p.id, p.status]));

    // Validate each payslip and collect eligible IDs
    const eligibleIds: string[] = [];
    for (const id of payslipIds) {
      const status = fetchedMap.get(id);
      if (status === undefined) {
        errors.push(`${id}: not found`);
      } else if (status !== requiredStatus) {
        errors.push(`${id}: expected "${requiredStatus}" status, got "${status}"`);
      } else {
        eligibleIds.push(id);
      }
    }

    // Batch update all eligible payslips in a single query
    let successCount = 0;
    if (eligibleIds.length > 0) {
      const { error: updateErr, count } = await supabase
        .from("payslips")
        .update(update)
        .in("id", eligibleIds)
        .eq("status", requiredStatus);

      if (updateErr) {
        errors.push(`batch update failed: ${updateErr.message}`);
      } else {
        successCount = count ?? eligibleIds.length;
      }
    }

    return NextResponse.json({
      ok: true,
      successCount,
      totalRequested: payslipIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[api/payroll/status] error:", err);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

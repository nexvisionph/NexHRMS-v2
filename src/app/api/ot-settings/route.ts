import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/ot-settings
 * Fetch OT settings (singleton row, id='default').
 */
export async function GET() {
  try {
    const supabase = await createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("ot_settings")
      .select("*")
      .eq("id", "default")
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    // Return defaults if no row yet
    const settings = data ?? {
      enable_ot_review: true,
      minimum_ot_minutes: 30,
      ot_grace_period_minutes: 0,
      require_supervisor_approval: false,
      allow_partial_approval: true,
      allow_payroll_officer_override: true,
      include_pending_in_payroll: false,
    };

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error("GET /api/ot-settings error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/ot-settings
 * Upsert OT settings.
 * Body: OTSettings (camelCase — converted to snake_case for DB)
 */
export async function PUT(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const { data: caller } = await supabase
      .from("employees")
      .select("role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!caller || !["admin", "hr", "payroll_admin"].includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const row = {
      id: "default",
      enable_ot_review: body.enableOtReview ?? true,
      minimum_ot_minutes: body.minimumOtMinutes ?? 30,
      ot_grace_period_minutes: body.otGracePeriodMinutes ?? 0,
      require_supervisor_approval: body.requireSupervisorApproval ?? false,
      allow_partial_approval: body.allowPartialApproval ?? true,
      allow_payroll_officer_override: body.allowPayrollOfficerOverride ?? true,
      include_pending_in_payroll: body.includePendingInPayroll ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("ot_settings")
      .upsert(row, { onConflict: "id" });

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/ot-settings error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

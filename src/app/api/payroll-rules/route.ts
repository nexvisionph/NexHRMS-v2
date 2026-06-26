import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";
import { nanoid } from "nanoid";

const ADMIN_ROLES = ["admin", "hr", "payroll_admin"];
const READ_ROLES  = ["admin", "hr", "finance", "payroll_admin", "auditor", "supervisor", "employee"];

async function resolveCallerEmployee(supabase: Awaited<ReturnType<typeof createAdminSupabaseClient>>, userId: string, userEmail: string) {
  const { data } = await supabase
    .from("employees")
    .select("id, role, company_id")
    .or(`profile_id.eq.${userId},email.eq.${userEmail}`)
    .single();
  return data;
}

/**
 * GET /api/payroll-rules
 * Fetch the active payroll rules (default or company-scoped).
 */
export async function GET(_request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !READ_ROLES.includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: rules, error } = await supabase
      .from("payroll_rules")
      .select("*")
      .eq("id", "default")
      .single();

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, rules });
  } catch (err) {
    console.error("GET /api/payroll-rules error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/payroll-rules
 * Update payroll rules. All fields optional — partial update.
 * Body: Partial<PayrollRules> & { reason?: string, ip_address?: string }
 *
 * Special: if compliance_mode changes to 'custom', requires confirmed: true
 */
export async function PATCH(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    const supabase = await createAdminSupabaseClient();
    const caller = await resolveCallerEmployee(supabase, user.id, user.email ?? "");
    if (!caller || !ADMIN_ROLES.includes(caller.role)) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { reason, ip_address, confirmed, ...updates } = body ?? {};

    // Compliance mode switch to custom requires explicit confirmation
    if (updates.compliance_mode === "custom" && !confirmed) {
      return NextResponse.json(
        { ok: false, message: "Confirmation required to switch to Custom Company Policy.", requiresConfirmation: true },
        { status: 409 }
      );
    }

    // Fetch current values for audit delta
    const { data: current } = await supabase
      .from("payroll_rules")
      .select("*")
      .eq("id", "default")
      .single();

    if (!current) {
      return NextResponse.json({ ok: false, message: "Payroll rules not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Append compliance mode confirmation metadata if switching
    if (updates.compliance_mode && updates.compliance_mode !== current.compliance_mode) {
      updates.compliance_mode_confirmed_by = caller.id;
      updates.compliance_mode_confirmed_at = now;
    }

    updates.updated_by = caller.id;

    const { error: updateErr } = await supabase
      .from("payroll_rules")
      .update(updates)
      .eq("id", "default");

    if (updateErr) return NextResponse.json({ ok: false, message: updateErr.message }, { status: 500 });

    // Write granular audit log entries for each changed field
    const auditRows: Record<string, unknown>[] = [];
    const trackFields = [
      "compliance_mode",
      "regular_ot_multiplier", "restday_ot_multiplier",
      "special_holiday_multiplier", "regular_holiday_multiplier", "restday_holiday_multiplier",
      "night_diff_multiplier", "enable_night_diff", "night_diff_start", "night_diff_end",
      "minimum_ot_minutes", "grace_period_minutes", "rounding_rule",
      "require_ot_review", "require_supervisor_review", "allow_partial_ot",
      "include_pending_in_payroll", "work_days_divisor", "hours_per_day",
    ];

    for (const field of trackFields) {
      if (field in updates && JSON.stringify(updates[field]) !== JSON.stringify(current[field])) {
        auditRows.push({
          id: `PRAL-${nanoid(8)}`,
          rules_id: "default",
          field_changed: field,
          old_value: { value: current[field] },
          new_value: { value: updates[field] },
          changed_by: caller.id,
          changed_at: now,
          reason: reason ?? null,
          ip_address: ip_address ?? null,
        });
      }
    }

    if (auditRows.length > 0) {
      // Use service-role client to bypass RLS for audit insert
      await supabase.from("payroll_rules_audit_logs").insert(auditRows);
    }

    // Return updated rules
    const { data: updated } = await supabase.from("payroll_rules").select("*").eq("id", "default").single();

    return NextResponse.json({ ok: true, rules: updated, auditCount: auditRows.length });
  } catch (err) {
    console.error("PATCH /api/payroll-rules error:", err);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/payroll-rules/audit
 * Actually handled by /api/payroll-rules/audit/route.ts — placeholder here.
 */

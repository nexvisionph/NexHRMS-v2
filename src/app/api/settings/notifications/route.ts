import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

// ─── Rule: camelCase ↔ snake_case mapping ────────────────────────────────────

function ruleToDb(r: Record<string, unknown>) {
  return {
    id: r.id,
    trigger: r.trigger,
    enabled: r.enabled,
    channel: r.channel,
    recipient_roles: r.recipientRoles,
    timing: r.timing,
    schedule_time: r.scheduleTime ?? null,
    reminder_days: r.reminderDays ?? null,
    subject_template: r.subjectTemplate,
    body_template: r.bodyTemplate,
    sms_template: r.smsTemplate ?? null,
  };
}

function ruleFromDb(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    trigger: row.trigger as string,
    enabled: row.enabled as boolean,
    channel: row.channel as string,
    recipientRoles: (row.recipient_roles as string[]) ?? [],
    timing: row.timing as string,
    scheduleTime: row.schedule_time as string | undefined,
    reminderDays: row.reminder_days as number[] | undefined,
    subjectTemplate: row.subject_template as string,
    bodyTemplate: row.body_template as string,
    smsTemplate: row.sms_template as string | undefined,
  };
}

// ─── Provider config: camelCase ↔ snake_case ─────────────────────────────────

function providerFromDb(row: Record<string, unknown>) {
  return {
    smsProvider: row.sms_provider as string,
    emailProvider: row.email_provider as string,
    smsEnabled: row.sms_enabled as boolean,
    emailEnabled: row.email_enabled as boolean,
    defaultSenderName: row.default_sender_name as string,
  };
}

function providerToDb(config: Record<string, unknown>) {
  const map: Record<string, string> = {
    smsProvider: "sms_provider",
    emailProvider: "email_provider",
    smsEnabled: "sms_enabled",
    emailEnabled: "email_enabled",
    defaultSenderName: "default_sender_name",
  };
  const row: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(config)) {
    const dbCol = map[key];
    if (dbCol) row[dbCol] = val;
  }
  return row;
}

// ─── GET /api/settings/notifications ─────────────────────────────────────────
// Returns { rules: [...], providerConfig: {...} }
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch rules
  const { data: rulesData, error: rulesErr } = await supabase
    .from("notification_rules")
    .select("*")
    .order("id");

  if (rulesErr) {
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }

  // Fetch provider config
  const { data: providerData, error: providerErr } = await supabase
    .from("notification_provider_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (providerErr && providerErr.code !== "PGRST116") {
    return NextResponse.json({ error: providerErr.message }, { status: 500 });
  }

  return NextResponse.json({
    rules: (rulesData || []).map((r: Record<string, unknown>) => ruleFromDb(r)),
    providerConfig: providerData ? providerFromDb(providerData) : null,
  });
}

// ─── PATCH /api/settings/notifications ───────────────────────────────────────
// Body options:
//   { rule: { id: "NR-01", ...patch } }  — update single rule
//   { rules: [...] }                      — bulk upsert all rules
//   { providerConfig: { ...patch } }      — update provider config
export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admin can change notification settings
  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || emp.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // ── Single rule update ──
  if (body.rule && typeof body.rule === "object" && body.rule.id) {
    const dbRule = ruleToDb(body.rule);
    const { error } = await supabase
      .from("notification_rules")
      .upsert(dbRule)
      .eq("id", body.rule.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Bulk rules upsert ──
  if (Array.isArray(body.rules)) {
    const dbRules = body.rules.map((r: Record<string, unknown>) => ruleToDb(r));
    const { error } = await supabase
      .from("notification_rules")
      .upsert(dbRules);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Provider config update ──
  if (body.providerConfig && typeof body.providerConfig === "object") {
    const dbRow = providerToDb(body.providerConfig);
    if (Object.keys(dbRow).length === 0) {
      return NextResponse.json({ error: "No valid provider fields" }, { status: 400 });
    }
    dbRow.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("notification_provider_config")
      .upsert({ id: "default", ...dbRow });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "No valid payload" }, { status: 400 });
}

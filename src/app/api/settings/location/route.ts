import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

// camelCase → snake_case mapping for location_config table
function toDbRow(config: Record<string, unknown>) {
  const map: Record<string, string> = {
    enabled: "enabled",
    pingIntervalMinutes: "ping_interval_minutes",
    requireLocation: "require_location",
    warnEmployeeOutOfFence: "warn_employee_out_of_fence",
    alertAdminOutOfFence: "alert_admin_out_of_fence",
    alertAdminLocationDisabled: "alert_admin_location_disabled",
    trackDuringBreaks: "track_during_breaks",
    retainDays: "retain_days",
    requireSelfie: "require_selfie",
    selfieRequiredProjects: "selfie_required_projects",
    selfieMaxAge: "selfie_max_age",
    showReverseGeocode: "show_reverse_geocode",
    selfieCompressionQuality: "selfie_compression_quality",
    lunchDuration: "lunch_duration",
    lunchGeofenceRequired: "lunch_geofence_required",
    lunchOvertimeThreshold: "lunch_overtime_threshold",
    alertAdminOnGeofenceViolation: "alert_admin_on_geofence_violation",
    allowedBreaksPerDay: "allowed_breaks_per_day",
    breakGracePeriod: "break_grace_period",
  };
  const row: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(config)) {
    const dbCol = map[key];
    if (dbCol) row[dbCol] = val;
  }
  return row;
}

// snake_case → camelCase mapping
function fromDbRow(row: Record<string, unknown>) {
  return {
    enabled: row.enabled as boolean,
    pingIntervalMinutes: row.ping_interval_minutes as number,
    requireLocation: row.require_location as boolean,
    warnEmployeeOutOfFence: row.warn_employee_out_of_fence as boolean,
    alertAdminOutOfFence: row.alert_admin_out_of_fence as boolean,
    alertAdminLocationDisabled: row.alert_admin_location_disabled as boolean,
    trackDuringBreaks: row.track_during_breaks as boolean,
    retainDays: row.retain_days as number,
    requireSelfie: row.require_selfie as boolean,
    selfieRequiredProjects: row.selfie_required_projects as string[] ?? [],
    selfieMaxAge: row.selfie_max_age as number,
    showReverseGeocode: row.show_reverse_geocode as boolean,
    selfieCompressionQuality: Number(row.selfie_compression_quality) || 0.7,
    lunchDuration: row.lunch_duration as number,
    lunchGeofenceRequired: row.lunch_geofence_required as boolean,
    lunchOvertimeThreshold: row.lunch_overtime_threshold as number,
    alertAdminOnGeofenceViolation: row.alert_admin_on_geofence_violation as boolean,
    allowedBreaksPerDay: row.allowed_breaks_per_day as number,
    breakGracePeriod: row.break_grace_period as number,
  };
}

// ─── GET /api/settings/location — Fetch location config ─────────────────────
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("location_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // No row yet — return null so client uses defaults
    return NextResponse.json(null);
  }

  return NextResponse.json(fromDbRow(data));
}

// ─── PATCH /api/settings/location — Update location config ──────────────────
export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admin can change location settings
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

  const dbRow = toDbRow(body);
  if (Object.keys(dbRow).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  dbRow.updated_at = new Date().toISOString();

  // Upsert: insert 'default' row if it doesn't exist, otherwise update
  const { data, error } = await supabase
    .from("location_config")
    .upsert({ id: "default", ...dbRow })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(fromDbRow(data));
}

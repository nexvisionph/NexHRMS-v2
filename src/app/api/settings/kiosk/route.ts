import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

// ─── camelCase → snake_case mapping ──────────────────────────────────────────
function toDbRow(config: Record<string, unknown>) {
  const map: Record<string, string> = {
    kioskEnabled: "kiosk_enabled",
    kioskTitle: "kiosk_title",
    welcomeMessage: "welcome_message",
    footerMessage: "footer_message",
    checkInMethod: "check_in_method",
    enablePin: "enable_pin",
    enableQr: "enable_qr",
    enableFace: "enable_face",
    enableNfc: "enable_nfc",
    allowCheckOut: "allow_check_out",
    pinLength: "pin_length",
    maxPinAttempts: "max_pin_attempts",
    lockoutDuration: "lockout_duration",
    tokenRefreshInterval: "token_refresh_interval",
    tokenLength: "token_length",
    nfcSimulatedDelay: "nfc_simulated_delay",
    kioskTheme: "kiosk_theme",
    clockFormat: "clock_format",
    showClock: "show_clock",
    showDate: "show_date",
    showLogo: "show_logo",
    showDeviceId: "show_device_id",
    showSecurityBadge: "show_security_badge",
    feedbackDuration: "feedback_duration",
    warnOffDay: "warn_off_day",
    playSound: "play_sound",
    idleTimeout: "idle_timeout",
    idleAction: "idle_action",
    requireGeofence: "require_geofence",
    selfieEnabled: "selfie_enabled",
    selfieRequired: "selfie_required",
    faceRecEnabled: "face_rec_enabled",
    faceRecRequired: "face_rec_required",
    faceRecAutoStart: "face_rec_auto_start",
    faceRecCountdown: "face_rec_countdown",
    faceRecPosition: "face_rec_position",
    devOptionsPenaltyEnabled: "dev_options_penalty_enabled",
    devOptionsPenaltyMinutes: "dev_options_penalty_minutes",
    devOptionsPenaltyApplyTo: "dev_options_penalty_apply_to",
    devOptionsPenaltyNotifyAdmin: "dev_options_penalty_notify_admin",
  };
  const row: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(config)) {
    const dbCol = map[key];
    if (dbCol) row[dbCol] = val;
  }
  return row;
}

// ─── snake_case → camelCase mapping ──────────────────────────────────────────
function fromDbRow(row: Record<string, unknown>) {
  return {
    kioskEnabled: row.kiosk_enabled as boolean,
    kioskTitle: row.kiosk_title as string,
    welcomeMessage: row.welcome_message as string,
    footerMessage: row.footer_message as string,
    checkInMethod: row.check_in_method as string,
    enablePin: row.enable_pin as boolean,
    enableQr: row.enable_qr as boolean,
    enableFace: row.enable_face as boolean,
    enableNfc: row.enable_nfc as boolean,
    allowCheckOut: row.allow_check_out as boolean,
    pinLength: row.pin_length as number,
    maxPinAttempts: row.max_pin_attempts as number,
    lockoutDuration: row.lockout_duration as number,
    tokenRefreshInterval: row.token_refresh_interval as number,
    tokenLength: row.token_length as number,
    nfcSimulatedDelay: row.nfc_simulated_delay as number,
    kioskTheme: row.kiosk_theme as string,
    clockFormat: row.clock_format as string,
    showClock: row.show_clock as boolean,
    showDate: row.show_date as boolean,
    showLogo: row.show_logo as boolean,
    showDeviceId: row.show_device_id as boolean,
    showSecurityBadge: row.show_security_badge as boolean,
    feedbackDuration: row.feedback_duration as number,
    warnOffDay: row.warn_off_day as boolean,
    playSound: row.play_sound as boolean,
    idleTimeout: row.idle_timeout as number,
    idleAction: row.idle_action as string,
    requireGeofence: row.require_geofence as boolean,
    selfieEnabled: row.selfie_enabled as boolean,
    selfieRequired: row.selfie_required as boolean,
    faceRecEnabled: row.face_rec_enabled as boolean,
    faceRecRequired: row.face_rec_required as boolean,
    faceRecAutoStart: row.face_rec_auto_start as boolean,
    faceRecCountdown: row.face_rec_countdown as number,
    faceRecPosition: row.face_rec_position as string,
    devOptionsPenaltyEnabled: row.dev_options_penalty_enabled as boolean,
    devOptionsPenaltyMinutes: row.dev_options_penalty_minutes as number,
    devOptionsPenaltyApplyTo: row.dev_options_penalty_apply_to as string,
    devOptionsPenaltyNotifyAdmin: row.dev_options_penalty_notify_admin as boolean,
  };
}

// ─── GET /api/settings/kiosk — Fetch kiosk config ───────────────────────────
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("kiosk_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json(fromDbRow(data));
}

// ─── PATCH /api/settings/kiosk — Update kiosk config ────────────────────────
export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admin can change kiosk settings
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

  const { data, error } = await supabase
    .from("kiosk_config")
    .upsert({ id: "default", ...dbRow })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(fromDbRow(data));
}

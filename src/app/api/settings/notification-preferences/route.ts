import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

const VALID_PREF_KEYS = ["leaveUpdates", "absenceAlerts", "payrollAlerts", "pushEnabled"] as const;

/**
 * GET /api/settings/notification-preferences
 * Returns the current employee's notification preference settings.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("employees")
      .select("id, notification_preferences")
      .eq("profile_id", user.id)
      .single();

    if (error) {
      // Column may not exist yet (pre-migration) — return defaults
      if (error.message?.includes("notification_preferences")) {
        return NextResponse.json({ employeeId: null, preferences: {} });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      employeeId: data?.id ?? null,
      preferences: data?.notification_preferences ?? {},
    });
  } catch (err) {
    console.error("[API] notification-preferences GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/notification-preferences
 * Updates the current employee's notification preferences.
 * Body: { employeeId: string, preferences: { leaveUpdates?: boolean, ... } }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, preferences } = body ?? {};

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json({ error: "preferences object required" }, { status: 400 });
    }

    // Validate preference keys — only allow known boolean keys
    const safePatch: Record<string, boolean> = {};
    for (const key of VALID_PREF_KEYS) {
      if (key in preferences && typeof preferences[key] === "boolean") {
        safePatch[key] = preferences[key];
      }
    }

    // Verify the employee belongs to the current user (ownership check)
    const { data: emp, error: empError } = await supabase
      .from("employees")
      .select("id, profile_id")
      .eq("id", employeeId)
      .single();

    if (empError || !emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (emp.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update notification_preferences jsonb column
    const { error: updateError } = await supabase
      .from("employees")
      .update({ notification_preferences: safePatch })
      .eq("id", employeeId);

    if (updateError) {
      // Column may not exist yet — graceful degradation
      if (updateError.message?.includes("notification_preferences")) {
        return NextResponse.json({ ok: true, note: "Column not yet migrated" });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, preferences: safePatch });
  } catch (err) {
    console.error("[API] notification-preferences PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

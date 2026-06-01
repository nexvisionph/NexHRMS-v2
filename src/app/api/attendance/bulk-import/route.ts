import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

/**
 * POST /api/attendance/bulk-import
 *
 * Bulk upsert attendance logs using the service-role client (bypasses RLS).
 * This ensures biometric/CSV imports from admin/HR users actually persist
 * regardless of RLS policy resolution issues on the browser client.
 *
 * Body: { rows: Array<{ employeeId, date, checkIn?, checkOut?, hours?, status, updatedAt? }> }
 * Returns: { ok: true, inserted: number, failed: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth + role check via cookie-based session
    const serverSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is admin or HR
    const admin = await createAdminSupabaseClient();
    const { data: employee } = await admin
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email ?? ""}`)
      .limit(1)
      .maybeSingle();

    const role = String(employee?.role || "").toLowerCase();
    if (!["admin", "hr"].includes(role)) {
      return NextResponse.json({ error: "Forbidden — admin or HR role required" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const rows: Array<{
      employeeId: string;
      date: string;
      checkIn?: string;
      checkOut?: string;
      hours?: number;
      status: string;
      updatedAt?: string;
      source?: string;
    }> = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Build DB rows in snake_case
    const dbRows = rows.map((r) => ({
      id: `ATT-${r.date}-${r.employeeId}`,
      employee_id: r.employeeId,
      date: r.date,
      check_in: r.checkIn || null,
      check_out: r.checkOut || null,
      hours: r.hours ?? null,
      status: r.status || "present",
      updated_at: r.updatedAt || now,
      created_at: now,
    }));

    // Batch upsert using service-role client (bypasses RLS)
    const CHUNK_SIZE = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < dbRows.length; i += CHUNK_SIZE) {
      const chunk = dbRows.slice(i, i + CHUNK_SIZE);
      const { error } = await admin
        .from("attendance_logs")
        .upsert(chunk, { onConflict: "employee_id,date" });

      if (error) {
        console.error("[attendance/bulk-import] upsert error:", error.message);
        failed += chunk.length;
      } else {
        inserted += chunk.length;
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      inserted,
      failed,
    });
  } catch (error) {
    console.error("[attendance/bulk-import] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

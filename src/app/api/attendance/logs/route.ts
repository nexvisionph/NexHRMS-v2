import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

export const runtime = "nodejs";

function toAttendanceLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    hours: row.hours,
    status: row.status,
    projectId: row.project_id,
    locationSnapshot: row.location_lat != null && row.location_lng != null
      ? { lat: row.location_lat, lng: row.location_lng }
      : undefined,
    faceVerified: row.face_verified,
    lateMinutes: row.late_minutes,
    shiftId: row.shift_id,
    flags: row.flags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminSupabaseClient();
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, role, email, profile_id, biometric_id")
      .or(`profile_id.eq.${user.id},email.eq.${user.email ?? ""}`)
      .limit(1)
      .maybeSingle();

    if (employeeError) {
      console.error("[attendance/logs] employee lookup:", employeeError.message);
      return NextResponse.json({ error: "Employee lookup failed" }, { status: 500 });
    }

    if (!employee?.id) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const role = String(employee.role || "").toLowerCase();
    const canReadAll = ["admin", "hr", "supervisor", "payroll", "finance", "auditor"].includes(role);
    const search = request.nextUrl.searchParams;

    let query = admin
      .from("attendance_logs")
      .select("*")
      .order("date", { ascending: false })
      .order("updated_at", { ascending: false });

    if (!canReadAll) {
      const employeeIds = [employee.id];
      if (employee.biometric_id) {
        const { data: biometricEmployees, error: biometricError } = await admin
          .from("employees")
          .select("id")
          .eq("biometric_id", employee.biometric_id);

        if (biometricError) {
          console.warn("[attendance/logs] biometric employee lookup:", biometricError.message);
        } else {
          for (const row of biometricEmployees ?? []) {
            if (row.id && !employeeIds.includes(row.id)) employeeIds.push(row.id);
          }
        }
      }
      query = query.in("employee_id", employeeIds);
    } else if (search.get("employeeId")) {
      query = query.eq("employee_id", search.get("employeeId"));
    }

    if (search.get("date")) query = query.eq("date", search.get("date"));
    if (search.get("from")) query = query.gte("date", search.get("from"));
    if (search.get("to")) query = query.lte("date", search.get("to"));

    const { data, error } = await query;

    if (error) {
      console.error("[attendance/logs] fetch:", error.message);
      return NextResponse.json({ error: "Attendance logs fetch failed" }, { status: 500 });
    }

    return NextResponse.json({
      logs: (data ?? []).map((row) => toAttendanceLog(row as Record<string, unknown>)),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[attendance/logs] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

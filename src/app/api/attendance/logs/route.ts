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

/**
 * Paginated fetch that works around Supabase's server-side max-rows limit (1000).
 * Uses .range() to fetch in pages until all rows are retrieved.
 */
async function fetchAllRows(
  admin: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  filters: {
    canReadAll: boolean;
    employeeIds?: string[];
    employeeId?: string | null;
    date?: string | null;
    from?: string | null;
    to?: string | null;
  }
) {
  const PAGE_SIZE = 1000;
  const allRows: Record<string, unknown>[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const rangeStart = page * PAGE_SIZE;
    const rangeEnd = rangeStart + PAGE_SIZE - 1;

    let query = admin
      .from("attendance_logs")
      .select("*")
      .order("date", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    // Apply filters
    if (!filters.canReadAll && filters.employeeIds) {
      query = query.in("employee_id", filters.employeeIds);
    } else if (filters.canReadAll && filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    if (filters.date) query = query.eq("date", filters.date);
    if (filters.from) query = query.gte("date", filters.from);
    if (filters.to) query = query.lte("date", filters.to);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    allRows.push(...(rows as Record<string, unknown>[]));

    // If we got fewer rows than PAGE_SIZE, we've reached the end
    hasMore = rows.length === PAGE_SIZE;
    page++;

    // Safety cap: don't fetch more than 10,000 rows total
    if (allRows.length >= 10000) break;
  }

  return allRows;
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

    // Build employee IDs for non-admin users
    let employeeIds: string[] | undefined;
    if (!canReadAll) {
      employeeIds = [employee.id];
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
    }

    const allRows = await fetchAllRows(admin, {
      canReadAll,
      employeeIds,
      employeeId: search.get("employeeId"),
      date: search.get("date"),
      from: search.get("from"),
      to: search.get("to"),
    });

    return NextResponse.json({
      logs: allRows.map((row) => toAttendanceLog(row)),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[attendance/logs] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/attendance/logs
 * Update an existing attendance log record.
 * Body: { employeeId, date, checkIn?, checkOut?, status?, lateMinutes?, hours? }
 * Only admin/hr/supervisor roles can update.
 * Uses employee_id + date composite unique constraint for reliable matching.
 */
export async function PATCH(request: NextRequest) {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await createAdminSupabaseClient();
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, role")
      .or(`profile_id.eq.${user.id},email.eq.${user.email ?? ""}`)
      .limit(1)
      .maybeSingle();

    if (employeeError || !employee?.id) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const role = String(employee.role || "").toLowerCase();
    const canEdit = ["admin", "hr", "supervisor"].includes(role);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, date, checkIn, checkOut, status, lateMinutes, hours } = body;

    if (!employeeId || !date) {
      return NextResponse.json({ error: "Missing employeeId or date" }, { status: 400 });
    }

    // Build the upsert payload — always include employee_id + date for composite key matching
    const payload: Record<string, unknown> = {
      employee_id: employeeId,
      date: date,
      updated_at: new Date().toISOString(),
    };
    if (checkIn !== undefined) payload.check_in = checkIn || null;
    if (checkOut !== undefined) payload.check_out = checkOut || null;
    if (status !== undefined) payload.status = status;
    if (lateMinutes !== undefined) payload.late_minutes = lateMinutes;
    if (hours !== undefined) payload.hours = hours;

    // First try to update existing row by composite key
    const { data: existing, error: lookupError } = await admin
      .from("attendance_logs")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("date", date)
      .maybeSingle();

    if (existing) {
      // Row exists — update it directly by its actual DB id
      const { error: updateError } = await admin
        .from("attendance_logs")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        console.error("[attendance/logs] PATCH update error:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // Row doesn't exist yet — insert with a generated id
      payload.id = `ATT-${date}-${employeeId}`;
      payload.created_at = new Date().toISOString();
      if (!payload.status) payload.status = "absent";

      const { error: insertError } = await admin
        .from("attendance_logs")
        .insert(payload);

      if (insertError) {
        console.error("[attendance/logs] PATCH insert error:", insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[attendance/logs] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

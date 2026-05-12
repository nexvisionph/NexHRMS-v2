import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/export/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns attendance events + evidence within the date range, joined with employee names.
 * Admin/HR only.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || !["admin", "hr", "supervisor"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to date params required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Fetch attendance events within the date range
  let { data: events, error: evErr } = await supabase
    .from("attendance_events")
    .select("*, employees!attendance_events_employee_id_fkey(name, email, department)")
    .gte("timestamp_utc", `${from}T00:00:00`)
    .lte("timestamp_utc", `${to}T23:59:59`)
    .order("timestamp_utc", { ascending: false });

  if (evErr) {
    // Fallback without join
    const res = await supabase
      .from("attendance_events")
      .select("*")
      .gte("timestamp_utc", `${from}T00:00:00`)
      .lte("timestamp_utc", `${to}T23:59:59`)
      .order("timestamp_utc", { ascending: false });
    events = res.data;
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  // Fetch evidence for these events
  const eventIds = (events || []).map((e: Record<string, unknown>) => e.id as string);
  let evidence: Record<string, unknown>[] = [];
  if (eventIds.length > 0) {
    // Batch fetch evidence in chunks of 500 to avoid URL length limits
    const chunks: string[][] = [];
    for (let i = 0; i < eventIds.length; i += 500) {
      chunks.push(eventIds.slice(i, i + 500));
    }
    for (const chunk of chunks) {
      const { data: evData } = await supabase
        .from("attendance_evidence")
        .select("*")
        .in("event_id", chunk);
      if (evData) evidence = evidence.concat(evData);
    }
  }

  // Build evidence lookup
  const evidenceMap = new Map<string, Record<string, unknown>>();
  for (const ev of evidence) {
    evidenceMap.set(ev.event_id as string, ev);
  }

  // Flatten events with employee data and evidence
  const flatEvents = (events || []).map((e: Record<string, unknown>) => {
    const empData = e.employees as Record<string, unknown> | null;
    const ev = evidenceMap.get(e.id as string);
    return {
      ...e,
      employee_name: empData?.name ?? "",
      employee_email: empData?.email ?? "",
      employee_department: empData?.department ?? "",
      employees: undefined,
      // Evidence fields
      gps_lat: ev?.gps_lat ?? null,
      gps_lng: ev?.gps_lng ?? null,
      gps_accuracy_meters: ev?.gps_accuracy_meters ?? null,
      geofence_pass: ev?.geofence_pass ?? null,
      device_integrity_result: ev?.device_integrity_result ?? null,
      face_verified: ev?.face_verified ?? null,
      mock_location_detected: ev?.mock_location_detected ?? null,
    };
  });

  return NextResponse.json({
    events: flatEvents,
    meta: { from, to, exportedAt: new Date().toISOString(), eventCount: flatEvents.length },
  });
}

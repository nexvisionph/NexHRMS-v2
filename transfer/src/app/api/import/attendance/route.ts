import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

type RowStatus = "valid" | "duplicate" | "error";
interface RowValidation {
  row: number;
  status: RowStatus;
  message: string;
  employee?: string;
  detail?: string;
}

/**
 * POST /api/import/attendance
 * Body: { rows: Record[], dryRun?: boolean }
 *  - dryRun=true  → validate + duplicate-check only, returns per-row status
 *  - dryRun=false → actually inserts records
 * Detects duplicates by (employee_id + event_type + timestamp_utc).
 * Admin/HR only.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || !["admin", "hr", "supervisor"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const rows: Record<string, unknown>[] = body.rows;
  const dryRun: boolean = body.dryRun === true;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "Maximum 1000 rows per import" }, { status: 400 });
  }

  // Build employee lookup by name/email
  const { data: employees } = await supabase.from("employees").select("id, name, email");
  const empByName = new Map<string, string>();
  const empByEmail = new Map<string, string>();
  const empNameById = new Map<string, string>();
  for (const e of employees || []) {
    empByName.set((e.name as string).toLowerCase(), e.id as string);
    empByEmail.set((e.email as string).toLowerCase(), e.id as string);
    empNameById.set(e.id as string, e.name as string);
  }

  // Fetch existing events for duplicate detection (last 90 days to limit query size)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const { data: existingEvents } = await supabase
    .from("attendance_events")
    .select("employee_id, event_type, timestamp_utc")
    .gte("timestamp_utc", cutoffDate.toISOString());

  const existingKeys = new Set(
    (existingEvents || []).map(
      (e) => `${e.employee_id}|${e.event_type}|${e.timestamp_utc}`
    )
  );

  const rowValidations: RowValidation[] = [];
  const imported: string[] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  const VALID_EVENT_TYPES = ["IN", "OUT", "BREAK_START", "BREAK_END"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Resolve employee
    const empName = String(row["Employee Name"] || "").trim();
    const empEmail = String(row["Email"] || "").trim();

    if (!empName && !empEmail) {
      const msg = `Row ${rowNum}: Missing Employee Name and Email`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Missing Employee Name and Email" });
      continue;
    }

    const employeeId =
      empByName.get(empName.toLowerCase()) ||
      empByEmail.get(empEmail.toLowerCase());

    if (!employeeId) {
      const msg = `Row ${rowNum}: Employee not found — "${empName}" / "${empEmail}"`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: `Employee not found: "${empName || empEmail}"`, employee: empName || empEmail });
      continue;
    }

    // Parse event type
    const rawEventType = String(row["Event Type"] || "").trim();
    const eventType = rawEventType.toUpperCase();
    if (!rawEventType) {
      const msg = `Row ${rowNum}: Missing Event Type`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Missing Event Type", employee: empName });
      continue;
    }
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      const msg = `Row ${rowNum}: Invalid event type "${rawEventType}". Must be IN, OUT, BREAK_START, or BREAK_END`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: `Invalid event type: "${rawEventType}". Use: IN, OUT, BREAK_START, BREAK_END`, employee: empName });
      continue;
    }

    // Parse timestamp — support either full ISO or Date + Time columns
    let timestampUtc = String(row["Timestamp (UTC)"] || "").trim();
    if (!timestampUtc) {
      const dateVal = String(row["Date"] || "").trim();
      const timeVal = String(row["Time"] || "").trim();
      if (dateVal && timeVal) {
        timestampUtc = `${dateVal}T${timeVal}Z`;
      } else if (dateVal) {
        timestampUtc = `${dateVal}T${eventType === "IN" ? "08:00:00" : "17:00:00"}Z`;
      }
    }

    if (!timestampUtc) {
      const msg = `Row ${rowNum}: Missing Date/Time or Timestamp`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Missing Date/Time or Timestamp", employee: empName });
      continue;
    }

    // Validate timestamp is a valid date
    const parsedDate = new Date(timestampUtc);
    if (isNaN(parsedDate.getTime())) {
      const msg = `Row ${rowNum}: Invalid timestamp "${timestampUtc}"`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: `Invalid date/time: "${timestampUtc}"`, employee: empName });
      continue;
    }

    // Reject future dates (more than 1 day ahead)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (parsedDate > tomorrow) {
      const msg = `Row ${rowNum}: Future date not allowed "${timestampUtc}"`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Future dates are not allowed", employee: empName });
      continue;
    }

    // Normalize to ISO string
    const normalizedTs = parsedDate.toISOString();

    // Duplicate check
    const key = `${employeeId}|${eventType}|${normalizedTs}`;
    if (existingKeys.has(key)) {
      const resolvedName = empNameById.get(employeeId) || empName;
      const msg = `Row ${rowNum}: ${resolvedName} ${eventType} @ ${normalizedTs}`;
      duplicates.push(msg);
      rowValidations.push({ row: rowNum, status: "duplicate", message: `Duplicate: ${resolvedName} already has ${eventType} at this time`, employee: resolvedName, detail: `${eventType} @ ${normalizedTs.split("T")[0]} ${normalizedTs.split("T")[1]?.split(".")[0]}` });
      continue;
    }

    // Row is valid
    const resolvedName = empNameById.get(employeeId) || empName;
    rowValidations.push({ row: rowNum, status: "valid", message: "Ready to import", employee: resolvedName, detail: `${eventType} @ ${normalizedTs.split("T")[0]} ${normalizedTs.split("T")[1]?.split(".")[0]}` });

    // If dry run, skip actual insert
    if (dryRun) continue;

    const eventId = `AE-IMP-${Date.now()}-${i}`;
    const record: Record<string, unknown> = {
      id: eventId,
      employee_id: employeeId,
      event_type: eventType,
      timestamp_utc: normalizedTs,
      project_id: String(row["Project ID"] || "").trim() || null,
      device_id: String(row["Device ID"] || "").trim() || null,
    };

    const { error: insertErr } = await supabase.from("attendance_events").insert(record);
    if (insertErr) {
      errors.push(`Row ${rowNum}: ${insertErr.message}`);
      rowValidations[rowValidations.length - 1] = { row: rowNum, status: "error", message: insertErr.message, employee: empName };
    } else {
      existingKeys.add(key);
      imported.push(eventId);

      // Also insert evidence if GPS data provided
      const gpsLat = row["GPS Lat"] != null && row["GPS Lat"] !== "" ? Number(row["GPS Lat"]) : null;
      const gpsLng = row["GPS Lng"] != null && row["GPS Lng"] !== "" ? Number(row["GPS Lng"]) : null;
      if (gpsLat != null || gpsLng != null) {
        const geofenceStr = String(row["Geofence Pass"] || "").toLowerCase();
        const faceStr = String(row["Face Verified"] || "").toLowerCase();
        const mockStr = String(row["Mock Location"] || "").toLowerCase();

        await supabase.from("attendance_evidence").insert({
          id: `EV-IMP-${Date.now()}-${i}`,
          event_id: eventId,
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          gps_accuracy_meters: row["GPS Accuracy (m)"] != null ? Number(row["GPS Accuracy (m)"]) : null,
          geofence_pass: geofenceStr === "yes" ? true : geofenceStr === "no" ? false : null,
          face_verified: faceStr === "yes" ? true : faceStr === "no" ? false : null,
          device_integrity_result: String(row["Device Integrity"] || "").trim() || null,
          mock_location_detected: mockStr === "yes" ? true : mockStr === "no" ? false : null,
        });
      }
    }
  }

  // Audit log (skip for dry run)
  if (!dryRun) {
    await supabase.from("audit_logs").insert({
      id: `AL-IMP-${Date.now()}`,
      entity_type: "attendance_events",
      entity_id: "bulk-import",
      action: "import",
      performed_by: emp.id,
      reason: `Imported ${imported.length} events, ${duplicates.length} duplicates skipped, ${errors.length} errors`,
    });
  }

  return NextResponse.json({
    dryRun,
    imported: dryRun ? 0 : imported.length,
    valid: rowValidations.filter((r) => r.status === "valid").length,
    duplicates: duplicates.length,
    errors: errors.length,
    rowValidations,
    duplicateDetails: duplicates,
    errorDetails: errors,
  });
}

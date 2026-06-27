import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { calculateDistanceInMeters } from "@/lib/geofence";

function getManilaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function calculateHours(checkIn: string, checkOut: string) {
  const [inH, inM, inS = 0] = checkIn.split(":").map(Number);
  const [outH, outM, outS = 0] = checkOut.split(":").map(Number);
  const inTotal = inH * 3600 + inM * 60 + inS;
  const outTotal = outH * 3600 + outM * 60 + outS;
  const diffSeconds = outTotal >= inTotal
    ? outTotal - inTotal
    : 24 * 3600 - inTotal + outTotal;
  if (diffSeconds <= 0) return 0;
  return Math.round((diffSeconds / 3600) * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const admin = await createAdminSupabaseClient();
    
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized - No Token" }, { status: 401 });

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ ok: false, error: "Unauthorized - Invalid Token" }, { status: 401 });

    const { data: emp } = await admin
      .from("employees")
      .select("id, status, attendance_method")
      .eq("profile_id", user.id)
      .single();
      
    if (!emp || emp.status !== "active") return NextResponse.json({ ok: false, error: "Employee not found or inactive" }, { status: 404 });

    const validMethods = ["mobile_gps_only", "biometric_mobile"];
    if (emp.attendance_method && !validMethods.includes(emp.attendance_method)) {
      return NextResponse.json({ ok: false, error: "Mobile attendance is not enabled for this employee." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      latitude, longitude, selfieUrl, detectedAddress, 
      gpsAccuracyMeters, deviceId, ipAddress, appVersion, batteryLevel 
    } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ ok: false, error: "GPS coordinates are required for mobile attendance." }, { status: 400 });
    }

    const rawTs = body.timestampUTC || new Date().toISOString();
    const parsed = Date.parse(rawTs);
    const timestampUTC = Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();

    const scanDate = new Date(timestampUTC);
    const { date: scanDay, time: timeStr } = getManilaParts(scanDate);

    // Geofencing Check
    let isGeofencePass = null;
    let distanceMeters = null;

    // Fetch assigned locations for the employee
    const { data: employeeLocations } = await admin
      .from("employee_work_locations")
      .select("work_location_id, work_locations(latitude, longitude, allowed_radius_meters, is_active)")
      .eq("employee_id", emp.id);

    if (employeeLocations && employeeLocations.length > 0) {
      let minDistance = Infinity;
      let passed = false;
      
      for (const loc of employeeLocations) {
        const wl = loc.work_locations as unknown as { latitude: number; longitude: number; allowed_radius_meters: number; is_active: boolean };
        if (!wl || !wl.is_active) continue;
        
        const dist = calculateDistanceInMeters(
          { latitude, longitude },
          { latitude: wl.latitude, longitude: wl.longitude }
        );
        
        if (dist < minDistance) minDistance = dist;
        if (dist <= wl.allowed_radius_meters) {
          passed = true;
          break;
        }
      }
      
      if (minDistance !== Infinity) {
        distanceMeters = minDistance;
        isGeofencePass = passed;
      }
    }

    // Fetch location config to verify geofence mode
    const { data: locConfig } = await admin
      .from("location_config")
      .select("geofence_mode")
      .eq("id", "default")
      .single();

    const isStrict = locConfig?.geofence_mode === "strict";

    if (isStrict && isGeofencePass === false) {
      return NextResponse.json({ 
        ok: false, 
        error: "Outside allowed work location", 
        distanceMeters 
      }, { status: 403 });
    }

    const { data: existingLog } = await admin
      .from("attendance_logs")
      .select("id, check_in, check_out")
      .eq("employee_id", emp.id)
      .eq("date", scanDay)
      .maybeSingle();

    if (existingLog?.check_in && existingLog?.check_out) {
      return NextResponse.json({ ok: true, ignored: true, message: "Already timed in and out today" });
    }

    const eventType = existingLog?.check_in ? "OUT" : "IN";
    const eventId = `EVT-${nanoid(8)}`;
    const nowISO = new Date().toISOString();

    const { error: eventError } = await admin.from("attendance_events").insert({
      id: eventId,
      employee_id: emp.id,
      event_type: eventType,
      timestamp_utc: timestampUTC,
      device_id: deviceId || "MOBILE-GPS",
      created_at: nowISO,
    });
    if (eventError) throw new Error("Failed to save event: " + eventError.message);

    const { error: evidenceError } = await admin.from("attendance_evidence").insert({
      id: `EVD-${nanoid(8)}`,
      event_id: eventId,
      gps_lat: latitude,
      gps_lng: longitude,
      gps_accuracy_meters: gpsAccuracyMeters,
      geofence_pass: isGeofencePass,
      distance_from_location_meters: distanceMeters,
      selfie_url: selfieUrl,
      detected_address: detectedAddress,
      ip_address: ipAddress,
      app_version: appVersion,
      battery_level: batteryLevel
    });
    if (evidenceError) throw new Error("Failed to save evidence: " + evidenceError.message);

    const attendanceStatus = (isGeofencePass === false) ? "pending_review" : "present";

    if (eventType === "IN") {
      await admin.from("attendance_logs").upsert(
        {
          id: existingLog?.id || `ATT-${scanDay}-${emp.id}`,
          employee_id: emp.id,
          date: scanDay,
          check_in: timeStr,
          check_in_method: "mobile_gps",
          source: "mobile_gps",
          status: attendanceStatus,
          attendance_status: attendanceStatus,
          location_lat: latitude,
          location_lng: longitude,
          updated_at: nowISO,
        },
        { onConflict: "employee_id,date" }
      );
    } else if (existingLog) {
      const checkIn = existingLog.check_in as string;
      await admin.from("attendance_logs").update({
        check_out: timeStr,
        check_out_method: "mobile_gps",
        hours: calculateHours(checkIn, timeStr),
        updated_at: nowISO,
      }).eq("id", existingLog.id);
    }

    return NextResponse.json({ 
      ok: true, 
      employeeId: emp.id, 
      eventType, 
      attendanceDate: scanDay, 
      time: timeStr,
      isGeofencePass,
      distanceMeters
    });
  } catch (err: unknown) {
    console.error("[mobile-attendance]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

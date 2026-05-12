import { NextRequest, NextResponse } from "next/server";

/**
 * Self Check-In API
 * Allows employees to check in from their personal devices.
 * Validates GPS location and records attendance event.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, eventType, gpsLat, gpsLng, gpsAccuracy, deviceId } = body;

    if (!employeeId) {
      return NextResponse.json({ ok: false, error: "Employee ID is required" }, { status: 400 });
    }

    if (!eventType || !["IN", "OUT"].includes(eventType)) {
      return NextResponse.json({ ok: false, error: "Event type must be IN or OUT" }, { status: 400 });
    }

    // Validate GPS accuracy (max 30m)
    if (gpsAccuracy && gpsAccuracy > 30) {
      return NextResponse.json({
        ok: false,
        error: `GPS accuracy too low (${Math.round(gpsAccuracy)}m). Please move to an open area.`,
      }, { status: 422 });
    }

    // In production:
    // 1. Verify employee exists and is active
    // 2. Check device binding
    // 3. Validate geofence if required
    // 4. Check for duplicate scans (within 5 minutes)
    // 5. Insert attendance_event + attendance_evidence

    const event = {
      id: crypto.randomUUID(),
      employeeId,
      eventType,
      timestampUTC: new Date().toISOString(),
      deviceId: deviceId || null,
      description: `Self check-${eventType === "IN" ? "in" : "out"}`,
      evidence: {
        gpsLat,
        gpsLng,
        gpsAccuracy,
      },
    };

    return NextResponse.json({ ok: true, data: event });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

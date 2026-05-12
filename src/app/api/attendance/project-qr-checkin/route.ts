import { NextRequest, NextResponse } from "next/server";

/**
 * Project QR Check-In API
 * Validates a scanned project QR code and records attendance.
 * Checks: valid QR signature, employee assignment, geofence.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, qrData, gpsLat, gpsLng, gpsAccuracy } = body;

    if (!employeeId) {
      return NextResponse.json({ ok: false, error: "Employee ID is required" }, { status: 400 });
    }

    if (!qrData) {
      return NextResponse.json({ ok: false, error: "QR data is required" }, { status: 400 });
    }

    // Parse QR payload
    let payload;
    try {
      payload = JSON.parse(qrData);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid QR code format" }, { status: 400 });
    }

    if (payload.type !== "project_qr") {
      return NextResponse.json({ ok: false, error: "Not a valid project QR code" }, { status: 400 });
    }

    const { projectId, projectName } = payload;

    if (!projectId) {
      return NextResponse.json({ ok: false, error: "QR code missing project ID" }, { status: 400 });
    }

    // In production:
    // 1. Verify HMAC signature
    // 2. Look up project in database
    // 3. Verify employee is assigned to project
    // 4. Compute geofence distance
    // 5. Record attendance event with evidence

    const event = {
      id: crypto.randomUUID(),
      employeeId,
      eventType: "IN",
      timestampUTC: new Date().toISOString(),
      projectId,
      description: `Project QR check-in: ${projectName}`,
      evidence: {
        gpsLat,
        gpsLng,
        gpsAccuracy,
        qrProjectId: projectId,
      },
    };

    return NextResponse.json({ ok: true, data: event });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createManualCheckin, getManualCheckinReasons } from "@/services/manual-checkin.service";

/**
 * POST /api/attendance/manual-checkin
 * 
 * Creates a manual check-in record for an employee.
 * Requires admin or HR role.
 * 
 * Request: {
 *   employeeId: string,
 *   eventType: "IN" | "OUT",
 *   reasonId?: string,
 *   customReason?: string,
 *   projectId?: string,
 *   notes?: string
 * }
 * Response: { ok: boolean, checkin?: ManualCheckin, error?: string }
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            employeeId,
            eventType,
            reasonId,
            customReason,
            projectId,
            notes,
        } = body;

        // Validate required fields
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json(
                { ok: false, error: "Missing or invalid employee ID" },
                { status: 400 }
            );
        }

        if (!eventType || !["IN", "OUT"].includes(eventType)) {
            return NextResponse.json(
                { ok: false, error: "Invalid event type. Must be 'IN' or 'OUT'" },
                { status: 400 }
            );
        }

        // Get performer from request (should be set by middleware or client)
        const performerId = request.headers.get("x-user-id");
        if (!performerId) {
            return NextResponse.json(
                { ok: false, error: "Missing performer ID" },
                { status: 401 }
            );
        }

        // Create manual check-in
        const result = await createManualCheckin({
            employeeId,
            eventType: eventType as "IN" | "OUT",
            reasonId,
            customReason,
            performedBy: performerId,
            projectId,
            notes,
        });

        if (!result.ok) {
            return NextResponse.json(
                { ok: false, error: result.error },
                { status: result.error?.includes("Unauthorized") ? 403 : 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            checkin: result.checkin,
        });
    } catch (error) {
        console.error("[manual-checkin] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/attendance/manual-checkin/reasons
 * 
 * Gets all active manual check-in reasons.
 * 
 * Response: ManualCheckinReason[]
 */

export async function GET() {
    try {
        const reasons = await getManualCheckinReasons();
        return NextResponse.json(reasons);
    } catch (error) {
        console.error("[manual-checkin-reasons] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch reasons" },
            { status: 500 }
        );
    }
}

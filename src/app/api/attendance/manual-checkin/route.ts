import { NextRequest, NextResponse } from "next/server";
import { createManualCheckin, getManualCheckinReasons } from "@/services/manual-checkin.service";
import { createServerSupabaseClient } from "@/services/supabase-server";

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
        // Authenticate & authorize caller (admin/HR only)
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Only admin/HR can perform manual check-ins
        const { data: profile } = await supabase
            .from("employees")
            .select("role")
            .eq("profile_id", user.id)
            .single();

        const allowedRoles = ["admin", "hr", "supervisor"];
        if (!profile || !allowedRoles.includes(profile.role)) {
            return NextResponse.json(
                { ok: false, error: "Forbidden — admin or HR role required" },
                { status: 403 }
            );
        }

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

        // Use the authenticated user's ID as performer
        const performerId = user.id;

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

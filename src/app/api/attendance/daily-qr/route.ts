import { NextRequest, NextResponse } from "next/server";
import { generateDailyQRPayload, getTodayDateString } from "@/lib/qr-utils";
import { createAdminSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/attendance/daily-qr?employeeId=xxx
 *
 * Returns today's QR payload for an employee.
 * The payload rotates at midnight automatically.
 * Employees display this as a QR code on their phone/dashboard.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get("employeeId");

        if (!employeeId) {
            return NextResponse.json(
                { error: "Missing employeeId" },
                { status: 400 },
            );
        }

        // Validate employeeId format (alphanumeric, dashes, underscores only)
        if (!/^[a-zA-Z0-9_-]+$/.test(employeeId)) {
            return NextResponse.json(
                { error: "Invalid employeeId format" },
                { status: 400 },
            );
        }

        // Verify the employee actually exists in the database
        const supabase = await createAdminSupabaseClient();
        const { data: emp } = await supabase
            .from("employees")
            .select("id")
            .eq("id", employeeId)
            .single();

        if (!emp) {
            return NextResponse.json(
                { error: "Employee not found" },
                { status: 404 },
            );
        }

        const date = getTodayDateString();
        const payload = await generateDailyQRPayload(employeeId, date);

        return NextResponse.json({
            payload,
            date,
            expiresAt: `${date}T23:59:59`,
        });
    } catch (error) {
        console.error("[daily-qr] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate daily QR" },
            { status: 500 },
        );
    }
}

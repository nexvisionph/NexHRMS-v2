import { NextRequest, NextResponse } from "next/server";
import { generateDailyQRPayload, getTodayDateString } from "@/lib/qr-utils";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/attendance/daily-qr?employeeId=xxx
 *
 * Returns today's QR payload for an employee.
 * The payload rotates at midnight automatically.
 * Employees display this as a QR code on their phone/dashboard.
 * Requires authentication — employee can only get their own QR.
 */
export async function GET(request: NextRequest) {
    try {
        // Verify caller is authenticated
        const authSupabase = await createServerSupabaseClient();
        const { data: { user } } = await authSupabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

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

        // Verify the employee actually exists and caller owns this employee record
        const supabase = await createAdminSupabaseClient();
        const { data: emp } = await supabase
            .from("employees")
            .select("id, profile_id")
            .eq("id", employeeId)
            .single();

        if (!emp) {
            return NextResponse.json(
                { error: "Employee not found" },
                { status: 404 },
            );
        }

        // Ownership check: employee can only request their own QR
        // Admin/HR can request for any employee
        if (emp.profile_id !== user.id) {
            const { data: callerProfile } = await supabase
                .from("employees")
                .select("role")
                .eq("profile_id", user.id)
                .single();
            const adminRoles = ["admin", "hr", "supervisor"];
            if (!callerProfile || !adminRoles.includes(callerProfile.role)) {
                return NextResponse.json(
                    { error: "Forbidden — can only request your own QR code" },
                    { status: 403 },
                );
            }
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

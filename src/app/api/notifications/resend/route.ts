import { NextRequest, NextResponse } from "next/server";
import { notifyProjectAssignment, notifyAbsence } from "@/lib/notifications";
import { createServerSupabaseClient } from "@/services/supabase-server";

export async function POST(request: NextRequest) {
    try {
        // Verify the caller is authenticated
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        // In demo mode, allow without auth for testing; in production, require auth
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
        if (!user && !isDemoMode) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { employeeId, employeeName, employeeEmail, type, projectName, date } = body;

        if (!employeeId || !employeeName || !employeeEmail || !type) {
            return NextResponse.json(
                { success: false, message: "Missing required fields: employeeId, employeeName, employeeEmail, and type" },
                { status: 400 }
            );
        }

        let result;

        switch (type) {
            case "assignment":
            case "reassignment":
                if (!projectName) {
                    return NextResponse.json(
                        { success: false, message: "projectName required for assignment notifications" },
                        { status: 400 }
                    );
                }
                result = notifyProjectAssignment({
                    employeeId,
                    employeeName,
                    employeeEmail,
                    projectName,
                });
                break;

            case "absence":
                if (!date) {
                    return NextResponse.json(
                        { success: false, message: "date required for absence notifications" },
                        { status: 400 }
                    );
                }
                result = notifyAbsence({ employeeId, employeeName, employeeEmail, date });
                break;

            default:
                return NextResponse.json(
                    { success: false, message: `Invalid notification type: ${type}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            message: "Notification sent successfully",
            simulatedEmail: result,
        });
    } catch (error) {
        console.error("Notification API error:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}

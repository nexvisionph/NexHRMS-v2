import { NextResponse } from "next/server";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/attendance/my-status
 * 
 * Returns the current user's attendance log for today.
 * Uses the authenticated session to determine the user.
 * 
 * Response: { log?: AttendanceLog, error?: string }
 */

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get employee record for this user
        const admin = await createAdminSupabaseClient();
        const { data: employee, error: empError } = await admin
            .from("employees")
            .select("id")
            .or(`profile_id.eq.${user.id},email.eq.${user.email ?? ""}`)
            .limit(1)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        // Get today's attendance log
        const today = new Date().toISOString().split("T")[0];
        const { data: log, error: logError } = await admin
            .from("attendance_logs")
            .select("*")
            .eq("employee_id", employee.id)
            .eq("date", today)
            .maybeSingle();

        if (logError) {
            console.error("[my-status] DB error:", logError.message);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        // Get this week's stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        const weekStartStr = weekStart.toISOString().split("T")[0];

        const { data: weekLogs } = await admin
            .from("attendance_logs")
            .select("date, status, hours")
            .eq("employee_id", employee.id)
            .gte("date", weekStartStr)
            .lte("date", today);

        const presentDays = weekLogs?.filter((l) => l.status === "present").length || 0;
        const totalHours = weekLogs?.reduce((sum, l) => sum + (l.hours || 0), 0) || 0;
        const lateDays = weekLogs?.filter((l) => l.status === "present" && (l as { late_minutes?: number }).late_minutes && (l as { late_minutes?: number }).late_minutes! > 0).length || 0;

        return NextResponse.json({
            log: log ? {
                id: log.id,
                employeeId: log.employee_id,
                date: log.date,
                checkIn: log.check_in,
                checkOut: log.check_out,
                status: log.status,
                hours: log.hours,
                lateMinutes: log.late_minutes,
            } : null,
            weekStats: {
                presentDays,
                totalHours: Math.round(totalHours * 10) / 10,
                lateDays,
            },
        });
    } catch (error) {
        console.error("[my-status] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

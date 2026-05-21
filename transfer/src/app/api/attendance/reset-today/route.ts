import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * POST /api/attendance/reset-today
 *
 * Deletes today's attendance_logs, attendance_events, and their child rows
 * (evidence, exceptions) for the requesting employee.
 *
 * Auth: requires a valid Supabase user session.
 * The employee is resolved from the authenticated user's profile_id so an
 * employee can only reset their OWN record.
 *
 * Two-pass delete: after the first delete, waits briefly and re-deletes to
 * catch any rows that were re-created by in-flight write-through upserts
 * that raced with the first delete.
 *
 * Request body: { employeeId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { employeeId } = body;

        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json({ success: false, message: "Missing employeeId" }, { status: 400 });
        }

        // Verify the requesting user owns this employee record
        const serverClient = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await serverClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const adminClient = await createAdminSupabaseClient();

        // Confirm the employee row's profile_id matches the requesting user
        const { data: emp, error: empError } = await adminClient
            .from("employees")
            .select("id, profile_id")
            .eq("id", employeeId)
            .single();

        if (empError || !emp) {
            return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
        }

        // Resolve the requesting user's role so admins/hr can reset any employee.
        const { data: requesterEmp } = await adminClient
            .from("employees")
            .select("role")
            .eq("profile_id", user.id)
            .single();
        const requesterRole = (requesterEmp?.role as string | undefined)?.toLowerCase() ?? "";
        const isPrivileged = ["admin", "hr"].includes(requesterRole);

        if (!isPrivileged && emp.profile_id !== user.id) {
            return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }

        const today = new Date().toISOString().split("T")[0];
        const todayStart = `${today}T00:00:00.000Z`;
        const tomorrowStart = new Date(new Date(todayStart).getTime() + 86400000).toISOString();
        // Also cover yesterday in UTC to handle UTC+X local-time boundary edge cases
        // (e.g. a check-in at 8 AM Manila = midnight UTC the same local day but
        //  the log's `date` field may read as yesterday from the server's UTC clock).
        const yesterdayStart = new Date(new Date(todayStart).getTime() - 86400000).toISOString().split("T")[0];

        /**
         * One full delete sweep.
         *
         * Strategy:
         *  1. Derive log IDs from the event timestamps (covers the 48-hour window to
         *     handle UTC ↔ local timezone boundary edge cases).
         *  2. Also query attendance_logs directly by employee_id for the last 2 days
         *     to catch any log that has no matching event.
         *  3. Delete child rows (evidence, exceptions) before parent events.
         *  4. Delete all discovered log rows by primary key.
         */
        async function deletePass(): Promise<string[]> {
            const errors: string[] = [];

            // ── 1. Fetch today's (and yesterday's) event IDs ─────────
            const { data: recentEvents, error: fetchEvtErr } = await adminClient
                .from("attendance_events")
                .select("id")
                .eq("employee_id", employeeId)
                .gte("timestamp_utc", `${yesterdayStart}T00:00:00.000Z`)
                .lt("timestamp_utc", tomorrowStart);
            if (fetchEvtErr) errors.push(`fetch events: ${fetchEvtErr.message}`);
            const eventIds = (recentEvents ?? []).map((e: { id: string }) => e.id);

            // ── 2. Fetch log rows directly (handles both today & yesterday UTC dates) ──
            const { data: recentLogs, error: fetchLogErr } = await adminClient
                .from("attendance_logs")
                .select("id")
                .eq("employee_id", employeeId)
                .in("date", [yesterdayStart, today]);
            if (fetchLogErr) errors.push(`fetch logs: ${fetchLogErr.message}`);
            const logIds = (recentLogs ?? []).map((l: { id: string }) => l.id);

            // ── 3. Delete evidence + exceptions (FK children of events) ──
            if (eventIds.length > 0) {
                const { error: eviErr } = await adminClient
                    .from("attendance_evidence")
                    .delete()
                    .in("event_id", eventIds);
                if (eviErr) errors.push(`delete evidence: ${eviErr.message}`);

                const { error: excErr } = await adminClient
                    .from("attendance_exceptions")
                    .delete()
                    .in("event_id", eventIds);
                if (excErr) errors.push(`delete exceptions: ${excErr.message}`);
            }

            // ── 4. Delete events by primary key ──────────────────────
            if (eventIds.length > 0) {
                const { error: evtErr } = await adminClient
                    .from("attendance_events")
                    .delete()
                    .in("id", eventIds);
                if (evtErr) errors.push(`delete events: ${evtErr.message}`);
            }

            // ── 5. Delete log rows by primary key ────────────────────
            if (logIds.length > 0) {
                const { data: deletedLogs, error: logErr } = await adminClient
                    .from("attendance_logs")
                    .delete()
                    .in("id", logIds)
                    .select("id");
                if (logErr) errors.push(`delete logs: ${logErr.message}`);
                else if ((deletedLogs?.length ?? 0) < logIds.length) {
                    errors.push(`delete logs: only ${deletedLogs?.length ?? 0}/${logIds.length} rows deleted`);
                }
            }

            return errors;
        }

        // ── Single pass (browser already waited for in-flight upserts) ────
        const passErrors = await deletePass();
        if (passErrors.length > 0) {
            console.error("[reset-today] Delete errors:", passErrors);
        }

        // ── Verify ──────────────────────────────────────────────
        const { data: remaining } = await adminClient
            .from("attendance_logs")
            .select("id")
            .eq("employee_id", employeeId)
            .in("date", [yesterdayStart, today]);

        if ((remaining?.length ?? 0) > 0) {
            console.error("[reset-today] Rows still exist after delete:", remaining);
            // One retry after 1 s — last-resort safety net
            await new Promise((r) => setTimeout(r, 1000));
            const retryErrors = await deletePass();
            if (retryErrors.length > 0) {
                console.error("[reset-today] Retry errors:", retryErrors);
            }
            const { data: stillRemaining } = await adminClient
                .from("attendance_logs")
                .select("id")
                .eq("employee_id", employeeId)
                .in("date", [yesterdayStart, today]);
            if ((stillRemaining?.length ?? 0) > 0) {
                return NextResponse.json({
                    success: false,
                    message: "Reset failed — rows still exist after retry.",
                    remaining: stillRemaining,
                    errors: [...passErrors, ...retryErrors],
                }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, errors: passErrors.length > 0 ? passErrors : undefined });
    } catch (error) {
        console.error("[reset-today] Error:", error);
        return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
    }
}

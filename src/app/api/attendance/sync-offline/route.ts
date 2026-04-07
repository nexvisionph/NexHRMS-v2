import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/services/supabase-server";
import { validateKioskAuth } from "@/lib/kiosk-auth";
import { nanoid } from "nanoid";

/**
 * POST /api/attendance/sync-offline
 * 
 * Syncs offline attendance events from kiosk devices.
 * Validates and writes events that were queued during network outage.
 * Requires kiosk API key authentication.
 * 
 * Request: {
 *   employeeId: string,
 *   eventType: "IN" | "OUT" | "BREAK_START" | "BREAK_END",
 *   timestampUTC: string,
 *   deviceId: string,
 *   projectId?: string,
 *   method: "qr" | "face",
 *   queuedAt: string
 * }
 */

export async function POST(request: NextRequest) {
    // Authenticate kiosk device
    const kioskAuth = validateKioskAuth(request.headers);
    if (!kioskAuth.ok) {
        return NextResponse.json(
            { ok: false, error: kioskAuth.error || "Unauthorized" },
            { status: kioskAuth.status || 401 }
        );
    }

    try {
        const body = await request.json();
        const {
            employeeId,
            eventType,
            timestampUTC,
            deviceId,
            projectId,
            method,
            queuedAt,
        } = body;

        // Validate required fields
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json(
                { ok: false, error: "Missing or invalid employee ID" },
                { status: 400 }
            );
        }

        if (!eventType || !["IN", "OUT", "BREAK_START", "BREAK_END"].includes(eventType)) {
            return NextResponse.json(
                { ok: false, error: "Invalid event type" },
                { status: 400 }
            );
        }

        if (!timestampUTC || !Date.parse(timestampUTC)) {
            return NextResponse.json(
                { ok: false, error: "Invalid timestamp" },
                { status: 400 }
            );
        }

        if (!deviceId || typeof deviceId !== "string") {
            return NextResponse.json(
                { ok: false, error: "Missing device ID" },
                { status: 400 }
            );
        }

        // Check for stale events (older than 24 hours)
        const eventTime = new Date(timestampUTC).getTime();
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (now - eventTime > twentyFourHours) {
            return NextResponse.json(
                { ok: false, error: "Event too old (>24h). Manual correction required." },
                { status: 400 }
            );
        }

        const supabase = await createAdminSupabaseClient();

        // Check for duplicate events (same employee, type, within 5 minutes)
        const fiveMinBefore = new Date(eventTime - 5 * 60 * 1000).toISOString();
        const fiveMinAfter = new Date(eventTime + 5 * 60 * 1000).toISOString();

        const { data: existing } = await supabase
            .from("attendance_events")
            .select("id")
            .eq("employee_id", employeeId)
            .eq("event_type", eventType)
            .gte("timestamp_utc", fiveMinBefore)
            .lte("timestamp_utc", fiveMinAfter)
            .limit(1);

        if (existing && existing.length > 0) {
            return NextResponse.json({
                ok: true,
                message: "Duplicate event detected, skipping",
                duplicate: true,
            });
        }

        // Insert the event
        const eventId = `EVT-${nanoid(8)}`;
        const { error: evtError } = await supabase.from("attendance_events").insert({
            id: eventId,
            employee_id: employeeId,
            event_type: eventType,
            timestamp_utc: timestampUTC,
            device_id: `${deviceId}-OFFLINE`,
            project_id: projectId || null,
            created_at: new Date().toISOString(),
        });

        if (evtError) {
            console.error("[sync-offline] Event insert error:", evtError.message);
            return NextResponse.json(
                { ok: false, error: evtError.message },
                { status: 500 }
            );
        }

        // Update attendance log for IN/OUT events
        if (eventType === "IN" || eventType === "OUT") {
            const eventDate = timestampUTC.split("T")[0];
            const eventTime = new Date(timestampUTC);
            const timeStr = `${String(eventTime.getHours()).padStart(2, "0")}:${String(eventTime.getMinutes()).padStart(2, "0")}`;

            const { data: existingLog } = await supabase
                .from("attendance_logs")
                .select("*")
                .eq("employee_id", employeeId)
                .eq("date", eventDate)
                .single();

            if (eventType === "IN") {
                if (existingLog) {
                    // Update existing log
                    await supabase
                        .from("attendance_logs")
                        .update({
                            check_in: timeStr,
                            status: "present",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", existingLog.id);
                } else {
                    // Create new log
                    await supabase.from("attendance_logs").insert({
                        id: `ATT-${eventDate}-${employeeId}`,
                        employee_id: employeeId,
                        date: eventDate,
                        check_in: timeStr,
                        status: "present",
                        project_id: projectId || null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                }
            } else if (eventType === "OUT" && existingLog) {
                // Calculate hours
                let hours = 0;
                if (existingLog.check_in) {
                    const [inH, inM] = existingLog.check_in.split(":").map(Number);
                    const [outH, outM] = [eventTime.getHours(), eventTime.getMinutes()];
                    const inTotal = inH * 60 + inM;
                    const outTotal = outH * 60 + outM;
                    const diffMin = outTotal >= inTotal
                        ? outTotal - inTotal
                        : 24 * 60 - inTotal + outTotal; // Handle overnight
                    hours = Math.round((diffMin / 60) * 10) / 10;
                }

                await supabase
                    .from("attendance_logs")
                    .update({
                        check_out: timeStr,
                        hours,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingLog.id);
            }
        }

        // Log the offline sync
        await supabase.from("audit_logs").insert({
            id: `AUD-${nanoid(8)}`,
            entity_type: "attendance",
            entity_id: employeeId,
            action: "offline_sync",
            performed_by: "SYSTEM",
            timestamp: new Date().toISOString(),
            reason: `Offline event synced: ${eventType} from ${deviceId}`,
            before_snapshot: null,
            after_snapshot: {
                eventId,
                eventType,
                originalTime: timestampUTC,
                queuedAt,
                method,
                syncedAt: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            ok: true,
            eventId,
            message: "Event synced successfully",
        });
    } catch (error) {
        console.error("[sync-offline] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

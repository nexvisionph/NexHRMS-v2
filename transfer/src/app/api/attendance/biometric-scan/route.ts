import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { validateKioskAuth } from "@/lib/kiosk-auth";
import { getT800Only } from "@/lib/env";
import { createAdminSupabaseClient } from "@/services/supabase-server";

type ScanBody = {
    biometricId?: unknown;
    userId?: unknown;
    user_id?: unknown;
    enroll_id?: unknown;
    pin?: unknown;
    timestampUTC?: unknown;
    timestamp?: unknown;
    io_time?: unknown;
    scanTime?: unknown;
    deviceId?: unknown;
    dev_id?: unknown;
    device_id?: unknown;
    io_mode?: unknown;
    mode?: unknown;
    eventType?: unknown;
};

function firstScalar(body: ScanBody, keys: Array<keyof ScanBody>): string {
    for (const key of keys) {
        const value = body[key];
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed) return trimmed;
        }
        if (typeof value === "number") {
            return String(value);
        }
    }
    return "";
}

function parseSdkDateToUtcIso(value: string): string | null {
    // FK SDK may send "yyyyMMddHHmmss" (device local time, Asia/Manila)
    const compact = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (compact) {
        const [, year, month, day, hour, minute, second] = compact;
        const utcMs = Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour) - 8,
            Number(minute),
            Number(second)
        );
        return new Date(utcMs).toISOString();
    }

    // FK SDK may send "yyyy-MM-dd HH:mm:ss" (device local time, Asia/Manila)
    const normalized = value.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (normalized) {
        const [, year, month, day, hour, minute, second = "00"] = normalized;
        const utcMs = Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour) - 8,
            Number(minute),
            Number(second)
        );
        return new Date(utcMs).toISOString();
    }

    // ISO timestamps or any Date-parseable format
    const parsedMs = Date.parse(value);
    if (!Number.isNaN(parsedMs)) {
        return new Date(parsedMs).toISOString();
    }

    return null;
}

function getManilaParts(date: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        date: `${byType.year}-${byType.month}-${byType.day}`,
        time: `${byType.hour}:${byType.minute}`,
    };
}

function calculateHours(checkIn: string, checkOut: string) {
    const [inH, inM] = checkIn.split(":").map(Number);
    const [outH, outM] = checkOut.split(":").map(Number);
    const inTotal = inH * 60 + inM;
    const outTotal = outH * 60 + outM;
    const diffMin = outTotal >= inTotal
        ? outTotal - inTotal
        : 24 * 60 - inTotal + outTotal;
    return Math.round((diffMin / 60) * 10) / 10;
}

/**
 * POST /api/attendance/biometric-scan
 *
 * Receives scan events from the physical biometric scanner bridge/server.
 * The scanner-side user ID is matched against employees.biometric_id.
 *
 * Rules per employee per Manila calendar day:
 * - first scan: time in
 * - second scan: time out
 * - third and later scans: ignored until the next day
 */
export async function POST(request: NextRequest) {
    if (getT800Only()) {
        return NextResponse.json({ ok: false, error: "Legacy biometric endpoints disabled: use /api/attendance/t800" }, { status: 410 });
    }
    const kioskAuth = validateKioskAuth(request.headers);
    if (!kioskAuth.ok) {
        return NextResponse.json(
            { ok: false, error: kioskAuth.error || "Unauthorized" },
            { status: kioskAuth.status || 401 }
        );
    }

    try {
        async function parseIncomingBody(req: NextRequest): Promise<Record<string, unknown>> {
            // Try JSON first
            try {
                return await req.json() as Record<string, unknown>;
            } catch (e) {
                // Not JSON — try plain text
                try {
                    const txt = await req.text();
                    // If text contains JSON object, extract it
                    const start = txt.indexOf("{");
                    const end = txt.lastIndexOf("}");
                    if (start !== -1 && end !== -1 && end > start) {
                        const part = txt.slice(start, end + 1);
                        try { return JSON.parse(part); } catch (_) { /* fallthrough */ }
                    }
                } catch (_) { /* ignore */ }

                // Try binary body -> decode as utf8 and find JSON block
                try {
                    const buf = await req.arrayBuffer();
                    if (buf && buf.byteLength > 0) {
                        const decoder = new TextDecoder("utf-8");
                        const s = decoder.decode(buf);
                        const start = s.indexOf("{");
                        const end = s.lastIndexOf("}");
                        if (start !== -1 && end !== -1 && end > start) {
                            const part = s.slice(start, end + 1);
                            try { return JSON.parse(part); } catch (_) { /* fallthrough */ }
                        }
                    }
                } catch (_) { /* ignore */ }

                // Give up: return empty object
                return {};
            }
        }

        const body = (await parseIncomingBody(request)) as ScanBody;
        const biometricId = firstScalar(body, [
            "biometricId",
            "userId",
            "user_id",
            "enroll_id",
            "pin",
        ]);
        const deviceId = firstScalar(body, ["deviceId", "dev_id", "device_id"]) || "BIOMETRIC-SCANNER";
        const rawTimestamp = firstScalar(body, ["timestampUTC", "timestamp", "io_time", "scanTime"]);
        const timestampUTC = rawTimestamp ? parseSdkDateToUtcIso(rawTimestamp) || new Date().toISOString() : new Date().toISOString();

        if (!biometricId) {
            return NextResponse.json(
                { ok: false, error: "Missing biometricId" },
                { status: 400 }
            );
        }

        const scanDate = new Date(timestampUTC);
        const { date: scanDay, time: timeStr } = getManilaParts(scanDate);
        const supabase = await createAdminSupabaseClient();

        // Allow authenticated web users to post their own check-in using validated session
        const headerUserId = request.headers.get("x-user-id");
        let employeeId: string | null = null;
        if (headerUserId) {
            // Validate the x-user-id against the actual authenticated session
            const { createServerSupabaseClient: createSessionClient } = await import("@/services/supabase-server");
            const sessionSupabase = await createSessionClient();
            const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser();
            
            // Only trust x-user-id if it matches the authenticated session user
            if (sessionUser && sessionUser.id === headerUserId) {
                const { data: empByProfile, error: profErr } = await supabase
                    .from("employees")
                    .select("id, name, biometric_id, status")
                    .eq("profile_id", headerUserId)
                    .single();
                if (!profErr && empByProfile && empByProfile.status === "active") {
                    employeeId = empByProfile.id as string;
                }
            }
        }

        // If not set by header, fall back to matching by biometricId (scanner-driven)
        if (!employeeId) {
            const { data: employee, error: employeeError } = await supabase
                .from("employees")
                .select("id, name, biometric_id, status")
                .eq("biometric_id", biometricId)
                .eq("status", "active")
                .single();

            if (employeeError || !employee) {
                return NextResponse.json(
                    { ok: false, error: "No active employee found for this biometric ID or user header", biometricId },
                    { status: 404 }
                );
            }

            employeeId = employee.id as string;
        }
        const { data: existingLog } = await supabase
            .from("attendance_logs")
            .select("id, check_in, check_out")
            .eq("employee_id", employeeId)
            .eq("date", scanDay)
            .maybeSingle();

        const { data: existingEvent } = await supabase
            .from("attendance_events")
            .select("id, event_type")
            .eq("employee_id", employeeId)
            .eq("timestamp_utc", timestampUTC)
            .eq("device_id", deviceId)
            .maybeSingle();

        if (existingEvent) {
            return NextResponse.json({
                ok: true,
                duplicate: true,
                ignored: true,
                employeeId,
                biometricId,
                eventId: existingEvent.id,
                eventType: existingEvent.event_type,
                attendanceDate: scanDay,
                time: timeStr,
                message: "Duplicate scanner retry ignored",
            });
        }

        if (existingLog?.check_in && existingLog?.check_out) {
            return NextResponse.json({
                ok: true,
                ignored: true,
                employeeId,
                biometricId,
                message: `Already timed in and out today. Next scan will count on ${scanDay} only if the date changes.`,
            });
        }

        const eventType = existingLog?.check_in ? "OUT" : "IN";
        const eventId = `EVT-${nanoid(8)}`;
        const nowISO = new Date().toISOString();

        const { error: eventError } = await supabase.from("attendance_events").insert({
            id: eventId,
            employee_id: employeeId,
            event_type: eventType,
            timestamp_utc: timestampUTC,
            device_id: deviceId,
            created_at: nowISO,
        });

        if (eventError) {
            return NextResponse.json(
                { ok: false, error: eventError.message },
                { status: 500 }
            );
        }

        if (eventType === "IN") {
            await supabase.from("attendance_logs").upsert(
                {
                    id: existingLog?.id || `ATT-${scanDay}-${employeeId}`,
                    employee_id: employeeId,
                    date: scanDay,
                    check_in: timeStr,
                    status: "present",
                    updated_at: nowISO,
                },
                { onConflict: "employee_id,date" }
            );
        } else if (existingLog) {
            const checkIn = existingLog?.check_in as string;
            await supabase
                .from("attendance_logs")
                .update({
                    check_out: timeStr,
                    hours: calculateHours(checkIn, timeStr),
                    updated_at: nowISO,
                })
                .eq("id", existingLog.id);
        }

        return NextResponse.json({
            ok: true,
            employeeId,
            biometricId,
            eventId,
            eventType,
            attendanceDate: scanDay,
            time: timeStr,
            message: eventType === "IN" ? "Time in recorded" : "Time out recorded",
        });
    } catch (error) {
        console.error("[biometric-scan] Error:", error);
        return NextResponse.json(
            { ok: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

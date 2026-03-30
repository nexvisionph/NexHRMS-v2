import { NextRequest, NextResponse } from "next/server";
import { generateQRToken } from "@/services/qr-token.service";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";
import { validateKioskAuth } from "@/lib/kiosk-auth";

/**
 * POST /api/attendance/generate-qr-token
 * 
 * Generates a dynamic, single-use QR token for an employee.
 * Token expires after 30 seconds.
 * 
 * Request: { employeeId: string, deviceId: string }
 * Response: { token: string, expiresAt: string }
 */

export async function POST(request: NextRequest) {
    // Rate limiting
    const rl = kioskRateLimiter.check(getClientIp(request));
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
        );
    }

    // Kiosk device auth
    const auth = validateKioskAuth(request.headers);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const { employeeId, deviceId } = body;

        // Validate required fields
        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid employee ID" },
                { status: 400 }
            );
        }

        if (!deviceId || typeof deviceId !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid device ID" },
                { status: 400 }
            );
        }

        // Generate token
        const result = await generateQRToken(employeeId, deviceId);

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error || "Failed to generate token" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            token: result.token,
            expiresAt: result.expiresAt,
        });
    } catch (error) {
        console.error("[generate-qr-token] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

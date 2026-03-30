import { NextRequest, NextResponse } from "next/server";
import { validateAnyQR } from "@/services/qr-token.service";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";
import { validateKioskAuth } from "@/lib/kiosk-auth";

/**
 * POST /api/attendance/validate-qr
 * 
 * Universal QR validator — accepts daily, static, or dynamic QR payloads.
 * 
 * Request: { payload: string, kioskId: string, location?: { lat, lng } }
 *   OR legacy: { token: string, kioskId: string, ... }
 *
 * Response: { valid: boolean, employeeId?, qrType?, message }
 */

export async function POST(request: NextRequest) {
    // Rate limiting
    const rl = kioskRateLimiter.check(getClientIp(request));
    if (!rl.ok) {
        return NextResponse.json(
            { valid: false, message: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
        );
    }

    // Kiosk device auth
    const auth = validateKioskAuth(request.headers);
    if (!auth.ok) {
        return NextResponse.json({ valid: false, message: auth.error }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const { payload, token, kioskId, location } = body;

        // Accept either "payload" (new) or "token" (legacy)
        const qrPayload = payload || token;

        if (!qrPayload || typeof qrPayload !== "string") {
            return NextResponse.json(
                { valid: false, message: "Missing QR payload" },
                { status: 400 }
            );
        }

        if (!kioskId || typeof kioskId !== "string") {
            return NextResponse.json(
                { valid: false, message: "Missing kiosk ID" },
                { status: 400 }
            );
        }

        if (location) {
            if (
                typeof location.lat !== "number" || 
                typeof location.lng !== "number" ||
                !Number.isFinite(location.lat) ||
                !Number.isFinite(location.lng)
            ) {
                return NextResponse.json(
                    { valid: false, message: "Invalid location coordinates" },
                    { status: 400 }
                );
            }
        }

        const result = await validateAnyQR(qrPayload, kioskId, location);

        if (!result.ok) {
            return NextResponse.json(
                { valid: false, message: result.error || "Validation failed" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            valid: result.valid,
            employeeId: result.employeeId,
            qrType: result.qrType,
            message: result.message,
        });
    } catch (error) {
        console.error("[validate-qr] Error:", error);
        return NextResponse.json(
            { valid: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}

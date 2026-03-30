import { NextRequest, NextResponse } from "next/server";
import { enrollFace, verifyFace, matchFace, deleteFaceEnrollment, getFaceEnrollmentStatus } from "@/services/face-recognition.service";
import { kioskRateLimiter, getClientIp } from "@/lib/rate-limit";
import { validateKioskAuth } from "@/lib/kiosk-auth";

/**
 * POST /api/face-recognition/enroll
 *
 * Handles both enrollment and verification based on ?action= query param.
 *
 * Enrollment:  POST ?action=enroll  { employeeId, embedding: number[128] }
 * Verify:      POST ?action=verify  { employeeId, embedding: number[128] }
 * Match:       POST ?action=match   { embedding: number[128] }
 */
export async function POST(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action") || "enroll";

    // Rate limit + kiosk auth for unauthenticated kiosk actions (verify, match)
    if (action === "verify" || action === "match") {
        const rl = kioskRateLimiter.check(getClientIp(request));
        if (!rl.ok) {
            return NextResponse.json(
                { ok: false, error: "Too many requests" },
                { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
            );
        }
        const auth = validateKioskAuth(request.headers);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
        }
    }

    try {
        const body = await request.json();

        switch (action) {
            case "enroll":
                return handleEnroll(request, body);
            case "verify":
                return handleVerify(body);
            case "match":
                return handleMatch(body);
            case "delete":
                return handleDelete(request, body);
            default:
                return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
}

/**
 * GET /api/face-recognition/enroll?action=status&employeeId=xxx
 *
 * Check face enrollment status for an employee.
 */
export async function GET(request: NextRequest) {
    try {
        const employeeId = request.nextUrl.searchParams.get("employeeId");

        if (!employeeId) {
            return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });
        }

        const result = await getFaceEnrollmentStatus(employeeId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[face-enroll GET] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleEnroll(request: NextRequest, body: Record<string, unknown>) {
    const { employeeId, embedding, referenceImage } = body as { employeeId?: string; embedding?: number[]; referenceImage?: string };

    if (!employeeId || typeof employeeId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid employee ID" }, { status: 400 });
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
        return NextResponse.json(
            { ok: false, error: "Invalid embedding (expected array of 128 numbers)" },
            { status: 400 },
        );
    }

    const performerId = request.headers.get("x-user-id");
    if (!performerId) {
        return NextResponse.json({ ok: false, error: "Missing performer ID" }, { status: 401 });
    }

    const result = await enrollFace(employeeId, embedding, performerId, referenceImage);

    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enrollment: result.enrollment });
}

async function handleVerify(body: Record<string, unknown>) {
    const { employeeId, embedding, probeImage } = body as { employeeId?: string; embedding?: number[]; probeImage?: string };

    if (!employeeId || typeof employeeId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing employee ID" }, { status: 400 });
    }

    // Validate employeeId format to prevent injection
    if (!/^[a-zA-Z0-9_-]+$/.test(employeeId)) {
        return NextResponse.json({ ok: false, error: "Invalid employee ID format" }, { status: 400 });
    }

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
        return NextResponse.json({ ok: false, error: "Invalid embedding" }, { status: 400 });
    }

    // Validate all embedding values are finite numbers
    if (!embedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
        return NextResponse.json({ ok: false, error: "Embedding contains invalid values" }, { status: 400 });
    }

    const result = await verifyFace(employeeId, embedding, probeImage);

    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
        ok: true,
        verified: result.verified,
        distance: result.distance,
        aiConfidence: result.aiConfidence,
    });
}

async function handleMatch(body: Record<string, unknown>) {
    const { embedding, probeImage } = body as { embedding?: number[]; probeImage?: string };

    if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
        return NextResponse.json({ ok: false, error: "Invalid embedding" }, { status: 400 });
    }

    // Validate all embedding values are finite numbers
    if (!embedding.every((v) => typeof v === "number" && Number.isFinite(v))) {
        return NextResponse.json({ ok: false, error: "Embedding contains invalid values" }, { status: 400 });
    }

    const result = await matchFace(embedding, probeImage);

    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        matched: !!result.employeeId,
        employeeId: result.employeeId,
        distance: result.distance,
        aiConfidence: result.aiConfidence,
    });
}

async function handleDelete(request: NextRequest, body: Record<string, unknown>) {
    const { employeeId } = body as { employeeId?: string };

    if (!employeeId || typeof employeeId !== "string") {
        return NextResponse.json({ ok: false, error: "Missing or invalid employee ID" }, { status: 400 });
    }

    const performerId = request.headers.get("x-user-id");
    if (!performerId) {
        return NextResponse.json({ ok: false, error: "Missing performer ID" }, { status: 401 });
    }

    const result = await deleteFaceEnrollment(employeeId);

    if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

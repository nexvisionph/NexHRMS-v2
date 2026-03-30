/**
 * QR Code Utilities for Employee Attendance
 *
 * Supports two QR formats:
 *
 * 1. **Daily QR** (recommended) — rotates every day, HMAC-signed.
 *    Format: `NEXHRMS-DAY:<employeeId>:<YYYY-MM-DD>:<hmac12>`
 *    Employees view this on their dashboard; it changes at midnight.
 *    Can be used for both check-in and check-out within the same day.
 *
 * 2. **Legacy static QR** — permanent, never changes.
 *    Format: `NEXHRMS-QR:<employeeId>:<hmac8>`
 *    Kept for backward compatibility only.
 */

const QR_SECRET = process.env.QR_HMAC_SECRET || "nexhrms-qr-attendance-2025";
const QR_PREFIX = "NEXHRMS-QR:";
const DAILY_PREFIX = "NEXHRMS-DAY:";

// Log warning if using fallback secret (only once)
if (!process.env.QR_HMAC_SECRET && typeof process !== "undefined") {
    console.warn("[qr-utils] WARNING: QR_HMAC_SECRET env var not set — using insecure fallback. Set this in production!");
}

/** Constant-time string comparison to prevent timing attacks on HMAC tags. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/* ─── HMAC Helper ─────────────────────────────────────────────── */

async function hmacSha256(message: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/* ─── Daily QR (Primary — rotates daily) ─────────────────────── */

/** Returns today's date string as YYYY-MM-DD in local time. */
export function getTodayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Generate a daily QR payload for an employee.
 * Format: NEXHRMS-DAY:<employeeId>:<YYYY-MM-DD>:<hmac12>
 * A new payload is produced each day; old ones become invalid.
 */
export async function generateDailyQRPayload(
    employeeId: string,
    date?: string,
): Promise<string> {
    const dateStr = date || getTodayDateString();
    const message = `${employeeId}:${dateStr}`;
    const hash = await hmacSha256(message, QR_SECRET);
    const tag = hash.slice(0, 12);
    return `${DAILY_PREFIX}${employeeId}:${dateStr}:${tag}`;
}

/**
 * Parse and validate a daily QR payload.
 * Checks HMAC and that the date matches today.
 * Returns employeeId + date if valid.
 */
export async function parseDailyQRPayload(
    payload: string,
): Promise<{ employeeId: string; date: string } | null> {
    if (!payload.startsWith(DAILY_PREFIX)) return null;
    const rest = payload.slice(DAILY_PREFIX.length);
    const parts = rest.split(":");
    // Expected: [employeeId, YYYY-MM-DD, hmac12]
    if (parts.length < 3) return null;

    const tag = parts[parts.length - 1];
    const dateStr = parts[parts.length - 2];
    const employeeId = parts.slice(0, parts.length - 2).join(":");

    if (!employeeId || !dateStr || !tag) return null;

    // Validate date is today
    if (dateStr !== getTodayDateString()) return null;

    // Validate HMAC (constant-time comparison to prevent timing attacks)
    const message = `${employeeId}:${dateStr}`;
    const expectedHash = await hmacSha256(message, QR_SECRET);
    const expectedTag = expectedHash.slice(0, 12);
    if (!timingSafeEqual(tag, expectedTag)) return null;

    return { employeeId, date: dateStr };
}

/* ─── Legacy Static QR (backward compatibility) ──────────────── */

/**
 * Generate a static QR code payload for an employee.
 * Format: NEXHRMS-QR:<employeeId>:<hmac8chars>
 * @deprecated Use generateDailyQRPayload instead
 */
export async function generateEmployeeQRPayload(employeeId: string): Promise<string> {
    const hash = await hmacSha256(employeeId, QR_SECRET);
    const tag = hash.slice(0, 8);
    return `${QR_PREFIX}${employeeId}:${tag}`;
}

/**
 * Parse and validate a scanned static QR code payload.
 * @deprecated Use parseDailyQRPayload instead
 */
export async function parseEmployeeQRPayload(
    payload: string,
): Promise<{ employeeId: string } | null> {
    if (!payload.startsWith(QR_PREFIX)) return null;
    const rest = payload.slice(QR_PREFIX.length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon === -1) return null;
    const employeeId = rest.slice(0, lastColon);
    const tag = rest.slice(lastColon + 1);
    if (!employeeId || !tag) return null;
    const expectedHash = await hmacSha256(employeeId, QR_SECRET);
    const expectedTag = expectedHash.slice(0, 8);
    if (!timingSafeEqual(tag, expectedTag)) return null;
    return { employeeId };
}

/* ─── Detect QR type ─────────────────────────────────────────── */

export type QRType = "daily" | "static" | "dynamic" | "unknown";

export function detectQRType(payload: string): QRType {
    if (payload.startsWith(DAILY_PREFIX)) return "daily";
    if (payload.startsWith(QR_PREFIX)) return "static";
    if (payload.startsWith("NEXHRMS-DYN-")) return "dynamic";
    return "unknown";
}

/**
 * Generate a simple deterministic QR-like visual grid from a payload string.
 * Returns an array of 100 booleans (10x10 grid) for dark/light modules.
 */
export function generateQRGrid(payload: string): boolean[] {
    const grid: boolean[] = [];
    for (let i = 0; i < 100; i++) {
        const charCode = payload.charCodeAt(i % payload.length);
        grid.push((charCode * 17 + i * 7) % 4 !== 0);
    }
    return grid;
}

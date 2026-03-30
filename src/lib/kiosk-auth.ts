/**
 * Kiosk device authentication via API key.
 *
 * Kiosk devices include the key in the `X-Kiosk-Api-Key` header.
 * The server validates against the `KIOSK_API_KEY` environment variable.
 *
 * Skipped when:
 * - NEXT_PUBLIC_DEMO_MODE is "true" (testing/demo)
 * - KIOSK_API_KEY env var is not set (development — logs warning once)
 */

export const KIOSK_AUTH_HEADER = "x-kiosk-api-key";

export interface KioskAuthResult {
  ok: boolean;
  status?: 401 | 403;
  error?: string;
}

let warnedMissingKey = false;

/**
 * Validate the kiosk API key from request headers.
 * Returns { ok: true } if valid, or { ok: false, status, error } if rejected.
 */
export function validateKioskAuth(headers: Headers): KioskAuthResult {
  // Skip in demo mode — no server auth needed
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return { ok: true };
  }

  const expectedKey = process.env.KIOSK_API_KEY;

  // If no KIOSK_API_KEY is configured, allow through (dev/testing) but warn
  if (!expectedKey) {
    if (!warnedMissingKey) {
      console.warn(
        "[kiosk-auth] KIOSK_API_KEY not set — kiosk routes are unprotected. " +
        "Set KIOSK_API_KEY in production."
      );
      warnedMissingKey = true;
    }
    return { ok: true };
  }

  const providedKey = headers.get(KIOSK_AUTH_HEADER);

  if (!providedKey) {
    return { ok: false, status: 401, error: "Missing kiosk API key" };
  }

  // Timing-safe comparison to prevent side-channel attacks
  if (!timingSafeEqual(expectedKey, providedKey)) {
    return { ok: false, status: 403, error: "Invalid kiosk API key" };
  }

  return { ok: true };
}

/**
 * Constant-time string comparison.
 * Prevents timing attacks on API key validation.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Always iterate max(a.length, b.length) to avoid leaking either string's length
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

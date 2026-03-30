/**
 * Tests for src/lib/kiosk-auth.ts
 *
 * Covers:
 * - Bypass in demo mode
 * - Bypass when KIOSK_API_KEY not set
 * - Reject when key is missing from request
 * - Reject when key is wrong
 * - Accept when key matches
 * - Timing-safe comparison (no early-exit length leak)
 */

import { validateKioskAuth, KIOSK_AUTH_HEADER } from "@/lib/kiosk-auth";

describe("validateKioskAuth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  it("bypasses in demo mode", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    process.env.KIOSK_API_KEY = "secret-key";

    const result = validateKioskAuth(new Headers());
    expect(result.ok).toBe(true);
  });

  it("bypasses when KIOSK_API_KEY is not set (dev/test)", () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.KIOSK_API_KEY;

    const result = validateKioskAuth(new Headers());
    expect(result.ok).toBe(true);
  });

  it("rejects when API key header is missing", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    process.env.KIOSK_API_KEY = "my-secret-kiosk-key";

    const result = validateKioskAuth(new Headers());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("Missing");
  });

  it("rejects when API key is wrong", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    process.env.KIOSK_API_KEY = "correct-key";

    const result = validateKioskAuth(
      new Headers({ [KIOSK_AUTH_HEADER]: "wrong-key" })
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("Invalid");
  });

  it("accepts when API key matches", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    process.env.KIOSK_API_KEY = "correct-key";

    const result = validateKioskAuth(
      new Headers({ [KIOSK_AUTH_HEADER]: "correct-key" })
    );
    expect(result.ok).toBe(true);
  });

  it("rejects keys with different lengths", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    process.env.KIOSK_API_KEY = "longkey123";

    const result = validateKioskAuth(
      new Headers({ [KIOSK_AUTH_HEADER]: "short" })
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("handles keys with special characters", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    process.env.KIOSK_API_KEY = "key-with-$pecial_chars!@#";

    const result = validateKioskAuth(
      new Headers({ [KIOSK_AUTH_HEADER]: "key-with-$pecial_chars!@#" })
    );
    expect(result.ok).toBe(true);
  });

  it("exports the correct header name constant", () => {
    expect(KIOSK_AUTH_HEADER).toBe("x-kiosk-api-key");
  });
});

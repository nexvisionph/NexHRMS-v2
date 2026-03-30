/**
 * QR Validation Service — Unit Test Suite
 *
 * Tests the QR validation orchestration layer in qr-token.service.ts.
 * Focuses on:
 *   - validateAnyQR() dispatch routing
 *   - validateDailyQR() integration with parseDailyQRPayload
 *   - validateStaticQR() integration with parseEmployeeQRPayload
 *   - Error handling and edge cases
 *
 * Supabase is fully mocked — no DB calls.
 */

// ─── Mock Supabase before any imports ────────────────────────────────────────

const mockSupabaseFrom = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
    }),
});

const mockSupabaseRpc = jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } });

jest.mock("@/services/supabase-server", () => ({
    createServerSupabaseClient: jest.fn().mockResolvedValue({
        from: mockSupabaseFrom,
        rpc: mockSupabaseRpc,
    }),
    createAdminSupabaseClient: jest.fn().mockResolvedValue({
        from: mockSupabaseFrom,
        rpc: mockSupabaseRpc,
    }),
}));

import {
    validateAnyQR,
    validateDailyQR,
    validateStaticQR,
} from "@/services/qr-token.service";

import {
    generateDailyQRPayload,
    generateEmployeeQRPayload,
    getTodayDateString,
} from "@/lib/qr-utils";

// ═════════════════════════════════════════════════════════════════════════════
// validateDailyQR
// ═════════════════════════════════════════════════════════════════════════════

describe("validateDailyQR", () => {
    it("valid daily payload → returns valid with employeeId", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        const result = await validateDailyQR(payload, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(true);
        expect(result.employeeId).toBe("EMP001");
    });

    it("expired daily payload (yesterday) → returns invalid", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        const payload = await generateDailyQRPayload("EMP001", dateStr);
        const result = await validateDailyQR(payload, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
        expect(result.message).toContain("Invalid or expired");
    });

    it("tampered HMAC → returns invalid", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        const tampered = payload.slice(0, -1) + (payload.slice(-1) === "a" ? "b" : "a");
        const result = await validateDailyQR(tampered, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("empty payload → returns invalid", async () => {
        const result = await validateDailyQR("", "KIOSK-01");
        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("garbage payload → returns invalid", async () => {
        const result = await validateDailyQR("not-a-qr-code", "KIOSK-01");
        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("different employee IDs produce different results", async () => {
        const today = getTodayDateString();
        const p1 = await generateDailyQRPayload("EMP001", today);
        const p2 = await generateDailyQRPayload("EMP027", today);

        const r1 = await validateDailyQR(p1, "KIOSK-01");
        const r2 = await validateDailyQR(p2, "KIOSK-01");

        expect(r1.employeeId).toBe("EMP001");
        expect(r2.employeeId).toBe("EMP027");
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// validateStaticQR
// ═════════════════════════════════════════════════════════════════════════════

describe("validateStaticQR", () => {
    it("valid static payload → returns valid with employeeId", async () => {
        const payload = await generateEmployeeQRPayload("EMP027");
        const result = await validateStaticQR(payload, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(true);
        expect(result.employeeId).toBe("EMP027");
    });

    it("tampered static payload → returns invalid", async () => {
        const payload = await generateEmployeeQRPayload("EMP001");
        const tampered = payload.replace("EMP001", "EMP999");
        const result = await validateStaticQR(tampered, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("empty payload → returns invalid", async () => {
        const result = await validateStaticQR("", "KIOSK-01");
        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });

    it("daily QR format → rejected by static validator", async () => {
        const daily = await generateDailyQRPayload("EMP001");
        const result = await validateStaticQR(daily, "KIOSK-01");

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// validateAnyQR — Dispatch routing
// ═════════════════════════════════════════════════════════════════════════════

describe("validateAnyQR — dispatch", () => {
    it("daily QR → dispatches to daily validator, returns qrType='daily'", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        const result = await validateAnyQR(payload, "KIOSK-01");

        expect(result.qrType).toBe("daily");
        expect(result.valid).toBe(true);
        expect(result.employeeId).toBe("EMP001");
    });

    it("static QR → dispatches to static validator, returns qrType='static'", async () => {
        const payload = await generateEmployeeQRPayload("EMP027");
        const result = await validateAnyQR(payload, "KIOSK-01");

        expect(result.qrType).toBe("static");
        expect(result.valid).toBe(true);
        expect(result.employeeId).toBe("EMP027");
    });

    it("unknown QR format → returns invalid with qrType='unknown'", async () => {
        const result = await validateAnyQR("random-barcode-data", "KIOSK-01");

        expect(result.qrType).toBe("unknown");
        expect(result.valid).toBe(false);
        expect(result.message).toContain("Unrecognized");
    });

    it("empty payload → returns invalid", async () => {
        const result = await validateAnyQR("", "KIOSK-01");

        expect(result.valid).toBe(false);
        expect(result.qrType).toBe("unknown");
    });

    it("dynamic QR prefix → dispatches to dynamic validator, returns qrType='dynamic'", async () => {
        const result = await validateAnyQR("NEXHRMS-DYN-abc123token", "KIOSK-01");

        // Dynamic validator needs DB — with our mock it will fail gracefully
        expect(result.qrType).toBe("dynamic");
    });

    it("tampered daily QR → dispatched but rejected", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        const tampered = payload.replace("EMP001", "FAKE01");

        const result = await validateAnyQR(tampered, "KIOSK-01");
        expect(result.qrType).toBe("daily");
        expect(result.valid).toBe(false);
    });
});

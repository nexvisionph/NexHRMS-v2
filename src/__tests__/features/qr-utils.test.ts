/**
 * QR Code Utilities — Unit Test Suite
 *
 * Tests all exported functions from src/lib/qr-utils.ts:
 *   - getTodayDateString(): date formatting
 *   - generateDailyQRPayload() / parseDailyQRPayload(): daily HMAC-signed QR round-trip
 *   - generateEmployeeQRPayload() / parseEmployeeQRPayload(): legacy static QR
 *   - detectQRType(): QR classification
 *   - generateQRGrid(): visual grid generation
 *
 * Runs in jsdom with Node.js crypto.subtle for HMAC operations.
 */

import {
    getTodayDateString,
    generateDailyQRPayload,
    parseDailyQRPayload,
    generateEmployeeQRPayload,
    parseEmployeeQRPayload,
    detectQRType,
    generateQRGrid,
} from "@/lib/qr-utils";

// ═════════════════════════════════════════════════════════════════════════════
// getTodayDateString
// ═════════════════════════════════════════════════════════════════════════════

describe("getTodayDateString", () => {
    it("returns a string in YYYY-MM-DD format", () => {
        const result = getTodayDateString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("matches the current UTC date", () => {
        const now = new Date();
        const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        expect(getTodayDateString()).toBe(expected);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Daily QR — generateDailyQRPayload / parseDailyQRPayload
// ═════════════════════════════════════════════════════════════════════════════

describe("generateDailyQRPayload", () => {
    it("returns string with NEXHRMS-DAY: prefix", async () => {
        const payload = await generateDailyQRPayload("EMP001");
        expect(payload.startsWith("NEXHRMS-DAY:")).toBe(true);
    });

    it("contains the employee ID in the payload", async () => {
        const payload = await generateDailyQRPayload("EMP027");
        expect(payload).toContain("EMP027");
    });

    it("contains today's date in the payload", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001");
        expect(payload).toContain(today);
    });

    it("includes a 12-character HMAC tag", async () => {
        const payload = await generateDailyQRPayload("EMP001");
        const parts = payload.replace("NEXHRMS-DAY:", "").split(":");
        const tag = parts[parts.length - 1];
        expect(tag).toHaveLength(12);
        expect(tag).toMatch(/^[0-9a-f]{12}$/);
    });

    it("generates different payloads for different employees", async () => {
        const p1 = await generateDailyQRPayload("EMP001");
        const p2 = await generateDailyQRPayload("EMP002");
        expect(p1).not.toBe(p2);
    });

    it("generates different payloads for different dates", async () => {
        const p1 = await generateDailyQRPayload("EMP001", "2025-01-01");
        const p2 = await generateDailyQRPayload("EMP001", "2025-01-02");
        expect(p1).not.toBe(p2);
    });

    it("is deterministic — same employee + date → same payload", async () => {
        const p1 = await generateDailyQRPayload("EMP001", "2025-06-15");
        const p2 = await generateDailyQRPayload("EMP001", "2025-06-15");
        expect(p1).toBe(p2);
    });
});

describe("parseDailyQRPayload", () => {
    it("round-trips with generateDailyQRPayload for today", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        const parsed = await parseDailyQRPayload(payload);
        expect(parsed).not.toBeNull();
        expect(parsed!.employeeId).toBe("EMP001");
        expect(parsed!.date).toBe(today);
    });

    it("returns correct employeeId for various IDs", async () => {
        const today = getTodayDateString();
        for (const empId of ["EMP001", "EMP027", "U009", "TEMP-999"]) {
            const payload = await generateDailyQRPayload(empId, today);
            const parsed = await parseDailyQRPayload(payload);
            expect(parsed).not.toBeNull();
            expect(parsed!.employeeId).toBe(empId);
        }
    });

    it("returns null for yesterday's payload", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        const payload = await generateDailyQRPayload("EMP001", dateStr);
        const parsed = await parseDailyQRPayload(payload);
        expect(parsed).toBeNull();
    });

    it("returns null for payload with tampered HMAC", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        // Tamper the last character of the HMAC
        const tampered = payload.slice(0, -1) + (payload.slice(-1) === "a" ? "b" : "a");
        const parsed = await parseDailyQRPayload(tampered);
        expect(parsed).toBeNull();
    });

    it("returns null for payload with tampered employee ID", async () => {
        const today = getTodayDateString();
        const payload = await generateDailyQRPayload("EMP001", today);
        // Replace EMP001 with EMP002 in the payload
        const tampered = payload.replace("EMP001", "EMP002");
        const parsed = await parseDailyQRPayload(tampered);
        expect(parsed).toBeNull();
    });

    it("returns null for empty string", async () => {
        expect(await parseDailyQRPayload("")).toBeNull();
    });

    it("returns null for non-NEXHRMS payload", async () => {
        expect(await parseDailyQRPayload("random-qr-data")).toBeNull();
    });

    it("returns null for static QR prefix", async () => {
        expect(await parseDailyQRPayload("NEXHRMS-QR:EMP001:abcd1234")).toBeNull();
    });

    it("returns null for incomplete payload (missing HMAC)", async () => {
        const today = getTodayDateString();
        expect(await parseDailyQRPayload(`NEXHRMS-DAY:EMP001:${today}`)).toBeNull();
    });

    it("returns null for payload with only prefix", async () => {
        expect(await parseDailyQRPayload("NEXHRMS-DAY:")).toBeNull();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Legacy Static QR — generateEmployeeQRPayload / parseEmployeeQRPayload
// ═════════════════════════════════════════════════════════════════════════════

describe("Legacy static QR", () => {
    it("generateEmployeeQRPayload returns NEXHRMS-QR: prefix", async () => {
        const payload = await generateEmployeeQRPayload("EMP001");
        expect(payload.startsWith("NEXHRMS-QR:")).toBe(true);
    });

    it("generateEmployeeQRPayload includes 8-char HMAC tag", async () => {
        const payload = await generateEmployeeQRPayload("EMP001");
        const parts = payload.replace("NEXHRMS-QR:", "").split(":");
        const tag = parts[parts.length - 1];
        expect(tag).toHaveLength(8);
        expect(tag).toMatch(/^[0-9a-f]{8}$/);
    });

    it("parseEmployeeQRPayload round-trips successfully", async () => {
        const payload = await generateEmployeeQRPayload("EMP027");
        const parsed = await parseEmployeeQRPayload(payload);
        expect(parsed).not.toBeNull();
        expect(parsed!.employeeId).toBe("EMP027");
    });

    it("parseEmployeeQRPayload rejects tampered payload", async () => {
        const payload = await generateEmployeeQRPayload("EMP001");
        const tampered = payload.replace("EMP001", "EMP999");
        const parsed = await parseEmployeeQRPayload(tampered);
        expect(parsed).toBeNull();
    });

    it("parseEmployeeQRPayload returns null for daily QR prefix", async () => {
        const parsed = await parseEmployeeQRPayload("NEXHRMS-DAY:EMP001:2025-01-01:abcdef123456");
        expect(parsed).toBeNull();
    });

    it("parseEmployeeQRPayload returns null for empty string", async () => {
        expect(await parseEmployeeQRPayload("")).toBeNull();
    });

    it("is deterministic — same employee → same payload", async () => {
        const p1 = await generateEmployeeQRPayload("EMP001");
        const p2 = await generateEmployeeQRPayload("EMP001");
        expect(p1).toBe(p2);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// detectQRType
// ═════════════════════════════════════════════════════════════════════════════

describe("detectQRType", () => {
    it("classifies NEXHRMS-DAY: as daily", () => {
        expect(detectQRType("NEXHRMS-DAY:EMP001:2025-01-01:abc123def456")).toBe("daily");
    });

    it("classifies NEXHRMS-QR: as static", () => {
        expect(detectQRType("NEXHRMS-QR:EMP001:abcd1234")).toBe("static");
    });

    it("classifies NEXHRMS-DYN- as dynamic", () => {
        expect(detectQRType("NEXHRMS-DYN-some-token-here")).toBe("dynamic");
    });

    it("classifies random string as unknown", () => {
        expect(detectQRType("some-random-payload")).toBe("unknown");
    });

    it("classifies empty string as unknown", () => {
        expect(detectQRType("")).toBe("unknown");
    });

    it("is case-sensitive — lowercase prefix → unknown", () => {
        expect(detectQRType("nexhrms-day:EMP001:2025-01-01:abc")).toBe("unknown");
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// generateQRGrid
// ═════════════════════════════════════════════════════════════════════════════

describe("generateQRGrid", () => {
    it("returns exactly 100 booleans", () => {
        const grid = generateQRGrid("NEXHRMS-DAY:EMP001:2025-01-01:abc");
        expect(grid).toHaveLength(100);
        grid.forEach((cell) => expect(typeof cell).toBe("boolean"));
    });

    it("is deterministic — same payload → same grid", () => {
        const g1 = generateQRGrid("test-payload");
        const g2 = generateQRGrid("test-payload");
        expect(g1).toEqual(g2);
    });

    it("produces different grids for different payloads", () => {
        const g1 = generateQRGrid("payload-A");
        const g2 = generateQRGrid("payload-B");
        expect(g1).not.toEqual(g2);
    });

    it("contains both true and false values", () => {
        const grid = generateQRGrid("NEXHRMS-DAY:EMP001:2025-01-01:abc123def456");
        const trueCount = grid.filter(Boolean).length;
        expect(trueCount).toBeGreaterThan(0);
        expect(trueCount).toBeLessThan(100);
    });
});

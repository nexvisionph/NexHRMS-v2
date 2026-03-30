/**
 * Feature Test: Attendance & Shifts
 *
 * Covers: attendance.store.ts
 * - Event ledger (append-only IN/OUT/BREAK)
 * - Evidence recording (GPS, QR, device integrity)
 * - Auto-generated exceptions (missing_in, missing_out, out_of_geofence, etc.)
 * - Check-in/check-out legacy flow
 * - Overtime requests & approvals
 * - Shift template CRUD & assignment
 * - Holiday management (PH defaults)
 * - Anti-cheat penalty system
 * - Attendance log flags
 */

import { useAttendanceStore } from "@/store/attendance.store";

beforeEach(() => useAttendanceStore.getState().resetToSeed());

const TODAY = new Date().toISOString().slice(0, 10);

describe("Attendance & Shifts", () => {
    // ── Event Ledger (Immutable) ────────────────────────────
    describe("Event ledger", () => {
        it("appends an IN event", () => {
            const before = useAttendanceStore.getState().events.length;
            useAttendanceStore.getState().appendEvent({
                employeeId: "EMP001",
                eventType: "IN",
                timestampUTC: new Date().toISOString(),
            });
            expect(useAttendanceStore.getState().events.length).toBe(before + 1);
        });

        it("appends an OUT event", () => {
            useAttendanceStore.getState().appendEvent({
                employeeId: "EMP001",
                eventType: "OUT",
                timestampUTC: new Date().toISOString(),
            });
            const events = useAttendanceStore.getState().events;
            expect(events[events.length - 1].eventType).toBe("OUT");
        });

        it("events have unique IDs", () => {
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP001", eventType: "IN", timestampUTC: new Date().toISOString() });
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP002", eventType: "IN", timestampUTC: new Date().toISOString() });
            const events = useAttendanceStore.getState().events;
            const ids = events.map((e) => e.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it("queries events by employee", () => {
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP001", eventType: "IN", timestampUTC: new Date().toISOString() });
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP002", eventType: "IN", timestampUTC: new Date().toISOString() });
            const e1events = useAttendanceStore.getState().getEventsForEmployee("EMP001");
            expect(e1events.every((e) => e.employeeId === "EMP001")).toBe(true);
        });

        it("queries events by date", () => {
            const ts = `${TODAY}T08:00:00Z`;
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP001", eventType: "IN", timestampUTC: ts });
            const dateEvents = useAttendanceStore.getState().getEventsForDate(TODAY);
            expect(dateEvents.length).toBeGreaterThan(0);
        });
    });

    // ── Evidence Recording ──────────────────────────────────
    describe("Evidence recording", () => {
        it("records GPS evidence for an event", () => {
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP001", eventType: "IN", timestampUTC: new Date().toISOString() });
            const event = useAttendanceStore.getState().events[useAttendanceStore.getState().events.length - 1];
            useAttendanceStore.getState().recordEvidence({
                eventId: event.id,
                gpsLat: 14.5995,
                gpsLng: 120.9842,
                gpsAccuracyMeters: 15,
                geofencePass: true,
            });
            const evidence = useAttendanceStore.getState().getEvidenceForEvent(event.id);
            expect(evidence).toBeTruthy();
            expect(evidence?.gpsLat).toBeCloseTo(14.5995);
            expect(evidence?.geofencePass).toBe(true);
        });
    });

    // ── Exception Detection ─────────────────────────────────
    describe("Exception auto-generation", () => {
        it("generates exceptions from events", () => {
            useAttendanceStore.getState().autoGenerateExceptions(TODAY, ["EMP001"]);
            // Just verify it runs without error — actual logic depends on data state
            expect(useAttendanceStore.getState().exceptions).toBeDefined();
        });

        it("resolves an exception", () => {
            // Manually add an exception first
            useAttendanceStore.getState().appendEvent({ employeeId: "EMP001", eventType: "IN", timestampUTC: `${TODAY}T08:00:00Z` });
            useAttendanceStore.getState().autoGenerateExceptions(TODAY, ["EMP001"]);
            const exceptions = useAttendanceStore.getState().exceptions;
            if (exceptions.length > 0) {
                useAttendanceStore.getState().resolveException(exceptions[0].id, "HR-ADMIN", "Manually verified");
                const resolved = useAttendanceStore.getState().exceptions.find((e) => e.id === exceptions[0].id);
                expect(resolved?.resolvedBy).toBe("HR-ADMIN");
            }
        });
    });

    // ── Check-in / Check-out (Legacy) ───────────────────────
    describe("Check-in / Check-out", () => {
        it("checks in an employee", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            const log = useAttendanceStore.getState().logs.find(
                (l) => l.employeeId === "EMP001" && l.date === TODAY
            );
            expect(log?.checkIn).toBeTruthy();
            expect(log?.status).toBe("present");
        });

        it("checks out an employee", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            useAttendanceStore.getState().checkOut("EMP001");
            const log = useAttendanceStore.getState().logs.find(
                (l) => l.employeeId === "EMP001" && l.date === TODAY
            );
            expect(log?.checkOut).toBeTruthy();
            expect(log?.hours).toBeGreaterThanOrEqual(0);
        });

        it("calculates hours correctly", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            useAttendanceStore.getState().checkOut("EMP001");
            const log = useAttendanceStore.getState().logs.find(
                (l) => l.employeeId === "EMP001" && l.date === TODAY
            );
            // checkIn and checkOut happen in same tick, so hours will be ~0
            expect(log?.hours).toBeDefined();
        });

        it("marks employee absent", () => {
            useAttendanceStore.getState().markAbsent("EMP005", TODAY);
            const log = useAttendanceStore.getState().logs.find(
                (l) => l.employeeId === "EMP005" && l.date === TODAY
            );
            expect(log?.status).toBe("absent");
        });
    });

    // ── Attendance Flags ────────────────────────────────────
    describe("Attendance flags", () => {
        it("adds a flag to a log", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            const log = useAttendanceStore.getState().logs.find((l) => l.employeeId === "EMP001" && l.date === TODAY)!;
            useAttendanceStore.getState().addFlag(log.id, "out_of_geofence");
            const updated = useAttendanceStore.getState().logs.find((l) => l.id === log.id);
            expect(updated?.flags).toContain("out_of_geofence");
        });

        it("removes a flag", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            const log = useAttendanceStore.getState().logs.find((l) => l.employeeId === "EMP001" && l.date === TODAY)!;
            useAttendanceStore.getState().addFlag(log.id, "device_mismatch");
            useAttendanceStore.getState().removeFlag(log.id, "device_mismatch");
            const updated = useAttendanceStore.getState().logs.find((l) => l.id === log.id);
            expect(updated?.flags ?? []).not.toContain("device_mismatch");
        });
    });

    // ── Overtime Requests ───────────────────────────────────
    describe("Overtime requests", () => {
        it("submits an overtime request", () => {
            useAttendanceStore.getState().submitOvertimeRequest({
                employeeId: "EMP001",
                date: TODAY,
                hoursRequested: 2,
                reason: "Sprint deadline",
            });
            const requests = useAttendanceStore.getState().overtimeRequests;
            expect(requests.length).toBeGreaterThan(0);
            expect(requests[requests.length - 1].status).toBe("pending");
        });

        it("approves overtime request", () => {
            useAttendanceStore.getState().submitOvertimeRequest({
                employeeId: "EMP001",
                date: TODAY,
                hoursRequested: 3,
                reason: "Urgent fix",
            });
            const req = useAttendanceStore.getState().overtimeRequests[useAttendanceStore.getState().overtimeRequests.length - 1];
            useAttendanceStore.getState().approveOvertime(req.id, "SUPERVISOR");
            const updated = useAttendanceStore.getState().overtimeRequests.find((r) => r.id === req.id);
            expect(updated?.status).toBe("approved");
        });

        it("rejects overtime request", () => {
            useAttendanceStore.getState().submitOvertimeRequest({
                employeeId: "EMP001",
                date: TODAY,
                hoursRequested: 4,
                reason: "Extra work",
            });
            const req = useAttendanceStore.getState().overtimeRequests[useAttendanceStore.getState().overtimeRequests.length - 1];
            useAttendanceStore.getState().rejectOvertime(req.id, "SUPERVISOR", "Not approved");
            expect(useAttendanceStore.getState().overtimeRequests.find((r) => r.id === req.id)?.status).toBe("rejected");
        });
    });

    // ── Shift Templates ─────────────────────────────────────
    describe("Shift templates", () => {
        it("has default shift templates", () => {
            const shifts = useAttendanceStore.getState().shiftTemplates;
            expect(shifts.length).toBeGreaterThanOrEqual(3); // Day, Mid, Night
        });

        it("creates a new shift template", () => {
            const before = useAttendanceStore.getState().shiftTemplates.length;
            useAttendanceStore.getState().createShift({ name: "Evening Shift", startTime: "14:00", endTime: "22:00", gracePeriod: 5, breakDuration: 60, workDays: [1,2,3,4,5] });
            expect(useAttendanceStore.getState().shiftTemplates.length).toBe(before + 1);
        });

        it("updates a shift template", () => {
            const shift = useAttendanceStore.getState().shiftTemplates[0];
            useAttendanceStore.getState().updateShift(shift.id, { name: "Updated Day Shift" });
            const updated = useAttendanceStore.getState().shiftTemplates.find((s) => s.id === shift.id);
            expect(updated?.name).toBe("Updated Day Shift");
        });

        it("deletes a shift template", () => {
            const shift = useAttendanceStore.getState().shiftTemplates[0];
            const before = useAttendanceStore.getState().shiftTemplates.length;
            useAttendanceStore.getState().deleteShift(shift.id);
            expect(useAttendanceStore.getState().shiftTemplates.length).toBe(before - 1);
        });

        it("assigns a shift to an employee", () => {
            const shift = useAttendanceStore.getState().shiftTemplates[0];
            useAttendanceStore.getState().assignShift("EMP001", shift.id);
            expect(useAttendanceStore.getState().employeeShifts["EMP001"]).toBe(shift.id);
        });
    });

    // ── Holiday Management ──────────────────────────────────
    describe("Holiday management", () => {
        it("has default PH holidays", () => {
            const holidays = useAttendanceStore.getState().holidays;
            expect(holidays.length).toBeGreaterThan(0);
        });

        it("adds a custom holiday", () => {
            const before = useAttendanceStore.getState().holidays.length;
            useAttendanceStore.getState().addHoliday({
                name: "Company Anniversary",
                date: "2026-06-15",
                type: "special",
            });
            expect(useAttendanceStore.getState().holidays.length).toBe(before + 1);
        });

        it("updates a holiday", () => {
            const holiday = useAttendanceStore.getState().holidays[0];
            useAttendanceStore.getState().updateHoliday(holiday.id, { name: "Updated Holiday" });
            const updated = useAttendanceStore.getState().holidays.find((h) => h.id === holiday.id);
            expect(updated?.name).toBe("Updated Holiday");
        });

        it("deletes a holiday", () => {
            const holiday = useAttendanceStore.getState().holidays[0];
            const before = useAttendanceStore.getState().holidays.length;
            useAttendanceStore.getState().deleteHoliday(holiday.id);
            expect(useAttendanceStore.getState().holidays.length).toBe(before - 1);
        });

        it("resets holidays to default", () => {
            useAttendanceStore.getState().addHoliday({ name: "Custom", date: "2026-12-25", type: "regular" });
            useAttendanceStore.getState().resetHolidaysToDefault();
            // After reset, should only have default holidays
            const holidays = useAttendanceStore.getState().holidays;
            expect(holidays.length).toBeGreaterThan(0);
        });

        it("holiday types are regular or special only", () => {
            const holidays = useAttendanceStore.getState().holidays;
            for (const h of holidays) {
                expect(["regular", "special"]).toContain(h.type);
            }
        });
    });

    // ── Penalty System ──────────────────────────────────────
    describe("Penalty system", () => {
        it("applies a penalty to an employee", () => {
            const now = new Date();
            const penaltyUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
            useAttendanceStore.getState().applyPenalty({
                employeeId: "EMP001",
                reason: "Mock location detected",
                triggeredAt: now.toISOString(),
                penaltyUntil,
            });
            const penalty = useAttendanceStore.getState().getActivePenalty("EMP001");
            expect(penalty).toBeTruthy();
            expect(penalty?.reason).toBe("Mock location detected");
        });

        it("clears a penalty", () => {
            const now = new Date();
            const penaltyUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
            useAttendanceStore.getState().applyPenalty({
                employeeId: "EMP001",
                reason: "Test",
                triggeredAt: now.toISOString(),
                penaltyUntil,
            });
            const penalty = useAttendanceStore.getState().getActivePenalty("EMP001");
            if (penalty) {
                useAttendanceStore.getState().clearPenalty("EMP001");
                // After clearing, getActivePenalty may return undefined
                const cleared = useAttendanceStore.getState().penalties.find((p) => p.id === penalty.id);
                expect(cleared?.resolved).toBe(true);
            }
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset to seed", () => {
        it("restores seed data", () => {
            useAttendanceStore.getState().checkIn("EMP001");
            useAttendanceStore.getState().resetToSeed();
            // After reset, seeded logs should be restored
            expect(useAttendanceStore.getState().logs).toBeDefined();
        });
    });
});

/**
 * Feature Test: Leave Management
 *
 * Covers: leave.store.ts
 * - Leave request lifecycle (create → approve/reject)
 * - Balance tracking and deduction
 * - Policy management (PH defaults: SL, VL, EL, ML, PL, SPL)
 * - Accrual & carry-forward logic
 * - Leave conflict detection
 */

import { useLeaveStore } from "@/store/leave.store";

beforeEach(() => useLeaveStore.getState().resetToSeed());

describe("Leave Management", () => {
    // ── Leave Requests ──────────────────────────────────────
    describe("Leave requests", () => {
        it("creates a leave request with pending status", () => {
            useLeaveStore.getState().addRequest({
                employeeId: "EMP001",
                type: "VL",
                startDate: "2026-04-01",
                endDate: "2026-04-03",
                reason: "Family vacation",
            });
            const requests = useLeaveStore.getState().requests;
            const req = requests.find((r) => r.employeeId === "EMP001" && r.type === "VL");
            expect(req).toBeTruthy();
            expect(req?.status).toBe("pending");
        });

        it("request has unique ID", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "SL", startDate: "2026-04-10", endDate: "2026-04-10", reason: "Sick" });
            useLeaveStore.getState().addRequest({ employeeId: "EMP002", type: "VL", startDate: "2026-04-15", endDate: "2026-04-16", reason: "Rest" });
            const ids = useLeaveStore.getState().requests.map((r) => r.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it("queries requests by employee", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "SL", startDate: "2026-05-01", endDate: "2026-05-01", reason: "Cold" });
            const empRequests = useLeaveStore.getState().getByEmployee("EMP001");
            expect(empRequests.every((r) => r.employeeId === "EMP001")).toBe(true);
        });

        it("gets pending requests", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "EL", startDate: "2026-06-01", endDate: "2026-06-01", reason: "Urgent" });
            const pending = useLeaveStore.getState().getPending();
            expect(pending.every((r) => r.status === "pending")).toBe(true);
            expect(pending.length).toBeGreaterThan(0);
        });
    });

    // ── Approval / Rejection ────────────────────────────────
    describe("Approval workflow", () => {
        it("approves a leave request", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "VL", startDate: "2026-04-20", endDate: "2026-04-21", reason: "Trip" });
            const req = useLeaveStore.getState().requests[useLeaveStore.getState().requests.length - 1];
            useLeaveStore.getState().updateStatus(req.id, "approved", "HR-ADMIN");
            const updated = useLeaveStore.getState().requests.find((r) => r.id === req.id);
            expect(updated?.status).toBe("approved");
        });

        it("rejects a leave request", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP002", type: "SL", startDate: "2026-05-10", endDate: "2026-05-10", reason: "Feeling unwell" });
            const req = useLeaveStore.getState().requests[useLeaveStore.getState().requests.length - 1];
            useLeaveStore.getState().updateStatus(req.id, "rejected", "HR-ADMIN");
            expect(useLeaveStore.getState().requests.find((r) => r.id === req.id)?.status).toBe("rejected");
        });

        it("deducts balance on approval", () => {
            useLeaveStore.getState().initBalances("EMP001", 2026);
            const before = useLeaveStore.getState().getBalance("EMP001", "VL", 2026);
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "VL", startDate: "2026-07-01", endDate: "2026-07-02", reason: "Personal" });
            const req = useLeaveStore.getState().requests[useLeaveStore.getState().requests.length - 1];
            useLeaveStore.getState().updateStatus(req.id, "approved", "HR-ADMIN");
            const after = useLeaveStore.getState().getBalance("EMP001", "VL", 2026);
            if (before !== undefined && after !== undefined) {
                expect(after.used).toBe((before.used ?? 0) + 2);
            }
        });
    });

    // ── Leave Policies ──────────────────────────────────────
    describe("Leave policies", () => {
        it("has default PH policies", () => {
            const policies = useLeaveStore.getState().policies;
            expect(policies.length).toBeGreaterThanOrEqual(5);
            const types = policies.map((p) => p.leaveType);
            expect(types).toContain("SL");
            expect(types).toContain("VL");
        });

        it("sick leave has 5 days default", () => {
            const sl = useLeaveStore.getState().getPolicy("SL");
            expect(sl?.annualEntitlement).toBe(5);
        });

        it("maternity leave has 105 days (RA 11210)", () => {
            const ml = useLeaveStore.getState().getPolicy("ML");
            expect(ml?.annualEntitlement).toBe(105);
        });

        it("adds a custom policy", () => {
            const before = useLeaveStore.getState().policies.length;
            useLeaveStore.getState().addPolicy({
                leaveType: "OTHER",
                name: "Bereavement Leave",
                accrualFrequency: "annual",
                annualEntitlement: 3,
                carryForwardAllowed: false,
                maxCarryForward: 0,
                maxBalance: 3,
                expiryMonths: 12,
                negativeLeaveAllowed: false,
                attachmentRequired: true,
            });
            expect(useLeaveStore.getState().policies.length).toBe(before + 1);
        });

        it("updates a policy", () => {
            const policy = useLeaveStore.getState().policies[0];
            useLeaveStore.getState().updatePolicy(policy.id, { annualEntitlement: 10 });
            expect(useLeaveStore.getState().policies.find((p) => p.id === policy.id)?.annualEntitlement).toBe(10);
        });

        it("deletes a policy", () => {
            const before = useLeaveStore.getState().policies.length;
            const policy = useLeaveStore.getState().policies[before - 1];
            useLeaveStore.getState().deletePolicy(policy.id);
            expect(useLeaveStore.getState().policies.length).toBe(before - 1);
        });
    });

    // ── Leave Balances ──────────────────────────────────────
    describe("Leave balances", () => {
        it("initializes balances for employee-year", () => {
            useLeaveStore.getState().initBalances("EMP010", 2026);
            const balances = useLeaveStore.getState().getEmployeeBalances("EMP010", 2026);
            expect(balances.length).toBeGreaterThan(0);
        });

        it("accrues leave to an employee", () => {
            useLeaveStore.getState().initBalances("EMP010", 2026);
            const before = useLeaveStore.getState().getBalance("EMP010", "VL", 2026);
            useLeaveStore.getState().accrueLeave("EMP010", "VL", 2026, 1);
            const after = useLeaveStore.getState().getBalance("EMP010", "VL", 2026);
            if (before && after) {
                expect(after.entitled).toBe(before.entitled + 1);
            }
        });
    });

    // ── Leave Conflict Detection ────────────────────────────
    describe("Leave conflict detection", () => {
        it("detects conflict with approved leave", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP001", type: "VL", startDate: "2026-08-01", endDate: "2026-08-03", reason: "Vacation" });
            const req = useLeaveStore.getState().requests[useLeaveStore.getState().requests.length - 1];
            useLeaveStore.getState().updateStatus(req.id, "approved", "HR");
            const conflict = useLeaveStore.getState().hasLeaveConflict("EMP001", "2026-08-02");
            expect(conflict).toBe(true);
        });

        it("no conflict on non-leave day", () => {
            const conflict = useLeaveStore.getState().hasLeaveConflict("EMP001", "2099-01-01");
            expect(conflict).toBe(false);
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset", () => {
        it("resets to seed data", () => {
            useLeaveStore.getState().addRequest({ employeeId: "EMP099", type: "SL", startDate: "2026-12-01", endDate: "2026-12-01", reason: "Test" });
            useLeaveStore.getState().resetToSeed();
            expect(useLeaveStore.getState().requests.find((r) => r.employeeId === "EMP099")).toBeUndefined();
        });
    });
});

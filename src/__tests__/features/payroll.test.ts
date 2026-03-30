/**
 * Feature Test: Payroll & Payslips
 *
 * Covers: payroll.store.ts
 * - Payslip lifecycle (issue → confirm → publish → pay → acknowledge)
 * - Payslip signing (drawn signature)
 * - Payroll run lifecycle (draft → validate → lock → publish → pay)
 * - Policy snapshot on lock
 * - Payroll adjustments
 * - Final pay computation (resignation)
 * - 13th month generation
 * - Bank file export
 * - Pay schedule config
 */

import { usePayrollStore } from "@/store/payroll.store";

beforeEach(() => usePayrollStore.getState().resetToSeed());

const PAYSLIP_INPUT = {
    employeeId: "EMP001",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-15",
    grossPay: 52500,
    allowances: 2000,
    sssDeduction: 1125,
    philhealthDeduction: 787.5,
    pagibigDeduction: 200,
    taxDeduction: 3500,
    loanDeduction: 0,
    otherDeductions: 0,
    netPay: 46887.5,
};

describe("Payroll & Payslips", () => {
    // ── Payslip Lifecycle ───────────────────────────────────
    describe("Payslip lifecycle", () => {
        it("issues a payslip", () => {
            const before = usePayrollStore.getState().payslips.length;
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            expect(usePayrollStore.getState().payslips.length).toBe(before + 1);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            expect(payslip.status).toBe("issued");
            expect(payslip.netPay).toBe(46887.5);
        });

        it("confirms a payslip", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            expect(usePayrollStore.getState().payslips.find((p) => p.id === payslip.id)?.status).toBe("confirmed");
        });

        it("publishes a payslip", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            usePayrollStore.getState().publishPayslip(payslip.id);
            expect(usePayrollStore.getState().payslips.find((p) => p.id === payslip.id)?.status).toBe("published");
        });

        it("records payment for payslip", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            usePayrollStore.getState().publishPayslip(payslip.id);
            usePayrollStore.getState().recordPayment(payslip.id, "bank_transfer", "REF-001");
            expect(usePayrollStore.getState().payslips.find((p) => p.id === payslip.id)?.status).toBe("paid");
        });

        it("queries payslips by employee", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const empPayslips = usePayrollStore.getState().getByEmployee("EMP001");
            expect(empPayslips.every((p) => p.employeeId === "EMP001")).toBe(true);
        });

        it("queries payslips by status", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const issued = usePayrollStore.getState().getPayslipsByStatus("issued");
            expect(issued.every((p) => p.status === "issued")).toBe(true);
        });
    });

    // ── Payslip Signing ─────────────────────────────────────
    describe("Payslip signing", () => {
        it("signs a published payslip", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            usePayrollStore.getState().publishPayslip(payslip.id);
            usePayrollStore.getState().signPayslip(payslip.id, "data:image/png;base64,iVBOR...");
            const signed = usePayrollStore.getState().payslips.find((p) => p.id === payslip.id);
            expect(signed?.signatureDataUrl).toBeTruthy();
            expect(signed?.signedAt).toBeTruthy();
        });

        it("acknowledges a payslip", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            usePayrollStore.getState().publishPayslip(payslip.id);
            usePayrollStore.getState().recordPayment(payslip.id, "bank_transfer", "REF-001");
            usePayrollStore.getState().signPayslip(payslip.id, "data:image/png;base64,iVBOR...");
            usePayrollStore.getState().acknowledgePayslip(payslip.id, "EMP001");
            expect(usePayrollStore.getState().payslips.find((p) => p.id === payslip.id)?.status).toBe("acknowledged");
        });

        it("gets unsigned published payslips", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const payslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(payslip.id);
            usePayrollStore.getState().publishPayslip(payslip.id);
            const unsigned = usePayrollStore.getState().getUnsignedPublished();
            expect(unsigned.find((p) => p.id === payslip.id)).toBeTruthy();
        });
    });

    // ── Payroll Runs ────────────────────────────────────────
    describe("Payroll runs", () => {
        it("creates a draft run", () => {
            usePayrollStore.getState().createDraftRun("2026-03-15", []);
            const runs = usePayrollStore.getState().runs;
            expect(runs.length).toBeGreaterThan(0);
            expect(runs[runs.length - 1].status).toBe("draft");
        });

        it("back-links payslips with payrollBatchId", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            const ps = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().createDraftRun("2026-04-01", [ps.id]);
            const updated = usePayrollStore.getState().payslips.find((p) => p.id === ps.id);
            expect(updated?.payrollBatchId).toBe("RUN-2026-04-01");
        });

        it("validates a run", () => {
            usePayrollStore.getState().createDraftRun("2026-03-15", []);
            usePayrollStore.getState().validateRun("2026-03-15");
            expect(usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-15")?.status).toBe("validated");
        });

        it("locks a run with policy snapshot", () => {
            usePayrollStore.getState().createDraftRun("2026-03-15", []);
            usePayrollStore.getState().validateRun("2026-03-15");
            usePayrollStore.getState().lockRun("2026-03-15");
            const locked = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-15");
            expect(locked?.status).toBe("locked");
            expect(locked?.policySnapshot).toBeTruthy();
        });

        it("publishes a locked run", () => {
            usePayrollStore.getState().createDraftRun("2026-03-15", []);
            usePayrollStore.getState().validateRun("2026-03-15");
            usePayrollStore.getState().lockRun("2026-03-15");
            usePayrollStore.getState().publishRun("2026-03-15");
            expect(usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-15")?.status).toBe("published");
        });

        it("marks run as paid", () => {
            usePayrollStore.getState().createDraftRun("2026-03-15", []);
            usePayrollStore.getState().validateRun("2026-03-15");
            usePayrollStore.getState().lockRun("2026-03-15");
            usePayrollStore.getState().publishRun("2026-03-15");
            usePayrollStore.getState().markRunPaid("2026-03-15");
            expect(usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-15")?.status).toBe("paid");
        });
    });

    // ── Adjustments ─────────────────────────────────────────
    describe("Payroll adjustments", () => {
        it("creates an adjustment", () => {
            usePayrollStore.getState().createAdjustment({
                payrollRunId: "RUN-2026-03-15",
                employeeId: "EMP001",
                adjustmentType: "earnings",
                amount: 5000,
                reason: "Bonus payment",
                referencePayslipId: "PS-001",
                createdBy: "ADMIN",
            });
            const adj = usePayrollStore.getState().adjustments;
            expect(adj.length).toBeGreaterThan(0);
            expect(adj[adj.length - 1].status).toBe("pending");
        });

        it("approves an adjustment", () => {
            usePayrollStore.getState().createAdjustment({ payrollRunId: "RUN-2026-03-15", employeeId: "EMP001", adjustmentType: "earnings", amount: 3000, reason: "Overtime correction", referencePayslipId: "PS-001", createdBy: "ADMIN" });
            const adj = usePayrollStore.getState().adjustments[usePayrollStore.getState().adjustments.length - 1];
            usePayrollStore.getState().approveAdjustment(adj.id, "FINANCE-ADMIN");
            expect(usePayrollStore.getState().adjustments.find((a) => a.id === adj.id)?.status).toBe("approved");
        });

        it("rejects an adjustment", () => {
            usePayrollStore.getState().createAdjustment({ payrollRunId: "RUN-2026-03-15", employeeId: "EMP001", adjustmentType: "deduction", amount: 1000, reason: "Error", referencePayslipId: "PS-001", createdBy: "ADMIN" });
            const adj = usePayrollStore.getState().adjustments[usePayrollStore.getState().adjustments.length - 1];
            usePayrollStore.getState().rejectAdjustment(adj.id, "FINANCE-ADMIN");
            expect(usePayrollStore.getState().adjustments.find((a) => a.id === adj.id)?.status).toBe("rejected");
        });
    });

    // ── Final Pay ───────────────────────────────────────────
    describe("Final pay computation", () => {
        it("computes final pay for a resigned employee", () => {
            usePayrollStore.getState().computeFinalPay({
                employeeId: "EMP001",
                resignedAt: "2026-03-15",
                salary: 50000,
                unpaidOTHours: 10,
                leaveDays: 5,
                loanBalance: 2000,
            });
            const fp = usePayrollStore.getState().getFinalPay("EMP001");
            expect(fp).toBeTruthy();
            expect(fp?.netFinalPay).toBeGreaterThan(0);
        });
    });

    // ── 13th Month ──────────────────────────────────────────
    describe("13th month pay", () => {
        it("generates 13th month payslips", () => {
            const before = usePayrollStore.getState().payslips.length;
            usePayrollStore.getState().generate13thMonth([
                { id: "EMP001", salary: 47500 },
                { id: "EMP002", salary: 52500 },
            ]);
            expect(usePayrollStore.getState().payslips.length).toBe(before + 2);
        });
    });

    // ── Bank File Export ────────────────────────────────────
    describe("Bank file export", () => {
        it("exports a bank file without error", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            // exportBankFile triggers a browser download (Blob/URL) — just verify it doesn't throw
            expect(() => {
                usePayrollStore.getState().exportBankFile("2026-03-15", [
                    { id: "EMP001", name: "Test Employee", salary: 50000 },
                ]);
            }).not.toThrow();
        });
    });

    // ── Pay Schedule ────────────────────────────────────────
    describe("Pay schedule config", () => {
        it("has default semi-monthly config", () => {
            const schedule = usePayrollStore.getState().paySchedule;
            expect(schedule.defaultFrequency).toBe("semi_monthly");
        });

        it("updates pay schedule", () => {
            usePayrollStore.getState().updatePaySchedule({ defaultFrequency: "monthly" });
            expect(usePayrollStore.getState().paySchedule.defaultFrequency).toBe("monthly");
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset", () => {
        it("resets to seed data", () => {
            usePayrollStore.getState().issuePayslip(PAYSLIP_INPUT);
            usePayrollStore.getState().resetToSeed();
            // Verify clean state (seed payslips present, new one gone)
            const all = usePayrollStore.getState().payslips;
            expect(all.find((p) => p.employeeId === "EMP001" && p.netPay === 46887.5)).toBeUndefined();
        });
    });
});

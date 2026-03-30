/**
 * Feature Test: Semi-Monthly Payroll — Full End-to-End Flow
 *
 * Simulates the COMPLETE bi-monthly (semi-monthly) payroll cycle as performed
 * by Admin/HR/Finance, then employee receives, signs, and acknowledges.
 *
 * Flow tested:
 *   1. HR configures pay schedule (semi-monthly, gov deductions on 2nd cutoff)
 *   2. Admin issues payslips for 1st cutoff (1st–15th) with PH deductions
 *   3. Admin issues payslips for 2nd cutoff (16th–EOM) with gov deductions
 *   4. Admin creates a payroll run, links payslips
 *   5. Admin validates → locks (policy snapshot) → publishes run
 *   6. Employees sign their published payslips
 *   7. Finance records payment (bank transfer)
 *   8. Employees acknowledge receipt
 *   9. Admin marks run as paid
 *  10. Admin creates adjustment for prior-period correction
 *  11. Finance approves and applies adjustment
 *  12. Final pay computation for a resigned employee
 *  13. 13th month generation with pro-rating
 *  14. Bank file export
 */

import { usePayrollStore } from "@/store/payroll.store";
import {
    computeSSS,
    computePhilHealth,
    computePagIBIG,
    computeWithholdingTax,
    computeAllPHDeductions,
} from "@/lib/ph-deductions";

beforeEach(() => usePayrollStore.getState().resetToSeed());

// ── Test employees (mirrors seed data salaries) ─────────────
const EMPLOYEES = [
    { id: "EMP001", name: "Olivia Harper", salary: 95000 },
    { id: "EMP002", name: "Ethan Brooks", salary: 105000 },
    { id: "EMP003", name: "Sophia Patel", salary: 88000 },
];

// Semi-monthly gross = monthly salary / 2
const semiMonthlyGross = (salary: number) => salary / 2;

describe("Semi-Monthly Payroll — Full End-to-End Flow", () => {
    // ── Step 1: Pay Schedule Configuration ──────────────────
    describe("Step 1: HR configures pay schedule", () => {
        it("verifies default is semi-monthly with correct cutoffs", () => {
            const schedule = usePayrollStore.getState().paySchedule;
            expect(schedule.defaultFrequency).toBe("semi_monthly");
            expect(schedule.semiMonthlyFirstCutoff).toBe(15);
            expect(schedule.semiMonthlyFirstPayDay).toBe(20);
            expect(schedule.semiMonthlySecondPayDay).toBe(5);
        });

        it("HR sets gov deductions to 2nd cutoff only", () => {
            usePayrollStore.getState().updatePaySchedule({ deductGovFrom: "second" });
            expect(usePayrollStore.getState().paySchedule.deductGovFrom).toBe("second");
        });

        it("allows changing to deduct from both cutoffs", () => {
            usePayrollStore.getState().updatePaySchedule({ deductGovFrom: "both" });
            expect(usePayrollStore.getState().paySchedule.deductGovFrom).toBe("both");
        });
    });

    // ── Step 2: PH Deduction Computation Accuracy ───────────
    describe("Step 2: PH government deductions are correct", () => {
        it("computes SSS within expected range", () => {
            // EMP001: ₱95,000/month → above MSC cap ₱35,000
            const sss = computeSSS(95000);
            expect(sss).toBe(1575); // Max employee SSS cap (4.5% × ₱35,000)
        });

        it("computes PhilHealth at 2.5% employee share", () => {
            const ph = computePhilHealth(95000);
            expect(ph).toBe(2375); // 95000 * 0.025
        });

        it("computes Pag-IBIG at ₱100 cap", () => {
            const pagibig = computePagIBIG(95000);
            expect(pagibig).toBe(100); // Max ₱100/mo
        });

        it("computes withholding tax per TRAIN Law brackets", () => {
            // Taxable = 95000 - 1575(SSS) - 2375(PhilHealth) - 100(Pag-IBIG) = 90950
            const taxable = 95000 - 1575 - 2375 - 100;
            const tax = computeWithholdingTax(taxable);
            // 90950 falls in 66667-166667 bracket: 8542 + (90950-66667)*0.25 = 8542 + 6071 = 14613
            expect(tax).toBe(8542 + Math.round((taxable - 66667) * 0.25));
        });

        it("computeAllPHDeductions returns correct totals", () => {
            const d = computeAllPHDeductions(95000);
            expect(d.sss).toBe(1575);
            expect(d.philHealth).toBe(2375);
            expect(d.pagIBIG).toBe(100);
            expect(d.totalDeductions).toBe(d.sss + d.philHealth + d.pagIBIG + d.withholdingTax);
        });
    });

    // ── Step 3: Admin Issues 1st Cutoff Payslips (1st–15th) ─
    describe("Step 3: Admin issues 1st cutoff payslips (1st–15th)", () => {
        it("issues payslips for all employees for Mar 1-15", () => {
            const before = usePayrollStore.getState().payslips.length;

            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                // 1st cutoff: no gov deductions (deductGovFrom=second)
                usePayrollStore.getState().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-01",
                    periodEnd: "2026-03-15",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: 0,
                    philhealthDeduction: 0,
                    pagibigDeduction: 0,
                    taxDeduction: 0,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: gross, // No deductions on 1st cutoff
                });
            }

            const after = usePayrollStore.getState().payslips.length;
            expect(after).toBe(before + 3);

            // Verify each payslip
            for (const emp of EMPLOYEES) {
                const ps = usePayrollStore.getState().payslips.find(
                    (p) => p.employeeId === emp.id && p.periodStart === "2026-03-01" && p.periodEnd === "2026-03-15"
                );
                expect(ps).toBeTruthy();
                expect(ps?.status).toBe("issued");
                expect(ps?.grossPay).toBe(emp.salary / 2);
                expect(ps?.netPay).toBe(emp.salary / 2); // No deductions
                expect(ps?.payFrequency).toBe("semi_monthly");
            }
        });
    });

    // ── Step 4: Admin Issues 2nd Cutoff Payslips (16th–31st) ─
    describe("Step 4: Admin issues 2nd cutoff payslips (16th–31st) with gov deductions", () => {
        it("issues payslips with full PH gov deductions for Mar 16-31", () => {
            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                // 2nd cutoff: apply FULL month gov deductions
                const ded = computeAllPHDeductions(emp.salary);
                const netPay = gross - ded.totalDeductions;

                usePayrollStore.getState().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-16",
                    periodEnd: "2026-03-31",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: ded.sss,
                    philhealthDeduction: ded.philHealth,
                    pagibigDeduction: ded.pagIBIG,
                    taxDeduction: ded.withholdingTax,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay,
                });
            }

            // Verify 2nd cutoff payslips have deductions
            for (const emp of EMPLOYEES) {
                const ps = usePayrollStore.getState().payslips.find(
                    (p) => p.employeeId === emp.id && p.periodStart === "2026-03-16"
                );
                expect(ps).toBeTruthy();
                expect(ps!.sssDeduction).toBeGreaterThan(0);
                expect(ps!.philhealthDeduction).toBeGreaterThan(0);
                expect(ps!.pagibigDeduction).toBe(100);
                expect(ps!.taxDeduction).toBeGreaterThan(0);
                expect(ps!.netPay).toBeLessThan(ps!.grossPay);
            }
        });
    });

    // ── Step 5–9: Complete Payroll Run & Payment Cycle ──────
    describe("Steps 5–9: Full payroll run lifecycle", () => {
        let firstCutoffIds: string[];
        let secondCutoffIds: string[];

        beforeEach(() => {
            firstCutoffIds = [];
            secondCutoffIds = [];

            // Issue 1st cutoff (no deductions)
            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                usePayrollStore.getState().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-01",
                    periodEnd: "2026-03-15",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: 0,
                    philhealthDeduction: 0,
                    pagibigDeduction: 0,
                    taxDeduction: 0,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: gross,
                    issuedAt: "2026-03-20",
                });
            }
            firstCutoffIds = usePayrollStore.getState().payslips
                .filter((p) => p.periodStart === "2026-03-01" && p.periodEnd === "2026-03-15")
                .map((p) => p.id);

            // Issue 2nd cutoff (with deductions)
            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                const ded = computeAllPHDeductions(emp.salary);
                usePayrollStore.getState().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-16",
                    periodEnd: "2026-03-31",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: ded.sss,
                    philhealthDeduction: ded.philHealth,
                    pagibigDeduction: ded.pagIBIG,
                    taxDeduction: ded.withholdingTax,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: gross - ded.totalDeductions,
                    issuedAt: "2026-04-05",
                });
            }
            secondCutoffIds = usePayrollStore.getState().payslips
                .filter((p) => p.periodStart === "2026-03-16" && p.periodEnd === "2026-03-31")
                .map((p) => p.id);
        });

        it("Step 5: creates payroll run and links both cutoff payslips", () => {
            const allIds = [...firstCutoffIds, ...secondCutoffIds];
            usePayrollStore.getState().createDraftRun("2026-03-31", allIds);

            const run = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run).toBeTruthy();
            expect(run!.status).toBe("draft");
            expect(run!.payslipIds).toEqual(allIds);

            // Payslips should be back-linked
            for (const id of allIds) {
                const ps = usePayrollStore.getState().payslips.find((p) => p.id === id);
                expect(ps?.payrollBatchId).toBe("RUN-2026-03-31");
            }
        });

        it("Step 5: validates the payroll run", () => {
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");

            const run = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run!.status).toBe("validated");
        });

        it("Step 5: locks the run with PH policy snapshot", () => {
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31", "HR-Admin-001");

            const run = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run!.status).toBe("locked");
            expect(run!.locked).toBe(true);
            expect(run!.policySnapshot).toBeTruthy();
            expect(run!.policySnapshot!.taxTableVersion).toBe("2026-TRAIN-v1");
            expect(run!.policySnapshot!.sssVersion).toBe("2026-SSS-v1");
            expect(run!.policySnapshot!.philhealthVersion).toBe("2026-PhilHealth-v1");
            expect(run!.policySnapshot!.pagibigVersion).toBe("2026-PagIBIG-v1");
            expect(run!.policySnapshot!.lockedBy).toBe("HR-Admin-001");
        });

        it("Step 5: prevents re-locking an already locked run (immutable)", () => {
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31", "HR-Admin-001");
            const snapshot1 = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31")!.policySnapshot;

            // Re-lock attempt should NOT change the snapshot
            usePayrollStore.getState().lockRun("2026-03-31", "Different-Admin");
            const snapshot2 = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31")!.policySnapshot;
            expect(snapshot2!.lockedBy).toBe("HR-Admin-001"); // unchanged
        });

        it("Step 5: publishes the locked run and auto-publishes confirmed payslips", () => {
            // Confirm all payslips first
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }

            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");

            // All payslips should be confirmed before publish
            const confirmedCount = usePayrollStore.getState().payslips
                .filter((p) => [...firstCutoffIds, ...secondCutoffIds].includes(p.id) && p.status === "confirmed")
                .length;
            expect(confirmedCount).toBe(6);

            usePayrollStore.getState().publishRun("2026-03-31");

            const run = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run!.status).toBe("published");
            expect(run!.publishedAt).toBeTruthy();
        });

        it("Step 6: employees sign their published payslips", () => {
            // Setup: confirm + publish
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");
            usePayrollStore.getState().publishRun("2026-03-31");

            // Each employee signs their payslips
            for (const emp of EMPLOYEES) {
                const empPayslips = usePayrollStore.getState().payslips.filter(
                    (p) => p.employeeId === emp.id &&
                        (firstCutoffIds.includes(p.id) || secondCutoffIds.includes(p.id)) &&
                        p.status === "published"
                );
                for (const ps of empPayslips) {
                    usePayrollStore.getState().signPayslip(ps.id, `data:image/png;base64,SIG_${emp.id}_${ps.id}`);
                }
            }

            // Verify all are signed
            const signedCount = usePayrollStore.getState().payslips.filter(
                (p) => [...firstCutoffIds, ...secondCutoffIds].includes(p.id) && p.signedAt
            ).length;
            expect(signedCount).toBe(6);
        });

        it("Step 7: finance records payment via bank transfer", () => {
            // Setup: confirm → publish
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");
            usePayrollStore.getState().publishRun("2026-03-31");

            // Finance records payment for each payslip
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().recordPayment(id, "bank_transfer", `REF-MAR-${id}`);
            }

            // All should be "paid"
            const paidPayslips = usePayrollStore.getState().payslips.filter(
                (p) => [...firstCutoffIds, ...secondCutoffIds].includes(p.id) && p.status === "paid"
            );
            expect(paidPayslips.length).toBe(6);
            paidPayslips.forEach((ps) => {
                expect(ps.paymentMethod).toBe("bank_transfer");
                expect(ps.bankReferenceId).toBeTruthy();
                expect(ps.paidAt).toBeTruthy();
            });
        });

        it("Step 7: finance can also use confirmPaidByFinance for audit trail", () => {
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");
            usePayrollStore.getState().publishRun("2026-03-31");

            const firstId = firstCutoffIds[0];
            usePayrollStore.getState().confirmPaidByFinance(firstId, "FINANCE-001", "bank_transfer", "REF-FIN-001");

            const ps = usePayrollStore.getState().payslips.find((p) => p.id === firstId);
            expect(ps?.status).toBe("paid");
            expect(ps?.paidConfirmedBy).toBe("FINANCE-001");
            expect(ps?.paidConfirmedAt).toBeTruthy();
        });

        it("Step 8: employees acknowledge receipt after payment + signing", () => {
            // Full cycle: issue → confirm → publish → sign → pay → acknowledge
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");
            usePayrollStore.getState().publishRun("2026-03-31");

            // Sign → pay → acknowledge
            for (const emp of EMPLOYEES) {
                const empPayslips = usePayrollStore.getState().payslips.filter(
                    (p) => p.employeeId === emp.id &&
                        (firstCutoffIds.includes(p.id) || secondCutoffIds.includes(p.id)) &&
                        p.status === "published"
                );
                for (const ps of empPayslips) {
                    usePayrollStore.getState().signPayslip(ps.id, `data:image/png;base64,SIG_${emp.id}`);
                    usePayrollStore.getState().recordPayment(ps.id, "bank_transfer", `REF-${ps.id}`);
                    usePayrollStore.getState().acknowledgePayslip(ps.id, emp.id);
                }
            }

            const acknowledged = usePayrollStore.getState().payslips.filter(
                (p) => [...firstCutoffIds, ...secondCutoffIds].includes(p.id) && p.status === "acknowledged"
            );
            expect(acknowledged.length).toBe(6);
            acknowledged.forEach((ps) => {
                expect(ps.acknowledgedAt).toBeTruthy();
                expect(ps.acknowledgedBy).toBeTruthy();
                expect(ps.signedAt).toBeTruthy();
                expect(ps.signatureDataUrl).toBeTruthy();
                expect(ps.paidAt).toBeTruthy();
            });
        });

        it("Step 9: admin marks the entire run as paid", () => {
            for (const id of [...firstCutoffIds, ...secondCutoffIds]) {
                usePayrollStore.getState().confirmPayslip(id);
            }
            usePayrollStore.getState().createDraftRun("2026-03-31", [...firstCutoffIds, ...secondCutoffIds]);
            usePayrollStore.getState().validateRun("2026-03-31");
            usePayrollStore.getState().lockRun("2026-03-31");
            usePayrollStore.getState().publishRun("2026-03-31");
            usePayrollStore.getState().markRunPaid("2026-03-31");

            const run = usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run!.status).toBe("paid");
            expect(run!.paidAt).toBeTruthy();
        });
    });

    // ── Step 10–11: Prior-Period Adjustments ────────────────
    describe("Steps 10–11: Prior-period adjustment workflow", () => {
        let firstCutoffId: string;

        beforeEach(() => {
            // Issue a payslip to adjust against
            usePayrollStore.getState().issuePayslip({
                employeeId: "EMP001",
                periodStart: "2026-02-01",
                periodEnd: "2026-02-15",
                grossPay: 47500,
                allowances: 0,
                sssDeduction: 0,
                philhealthDeduction: 0,
                pagibigDeduction: 0,
                taxDeduction: 0,
                otherDeductions: 0,
                loanDeduction: 0,
                netPay: 47500,
            });
            firstCutoffId = usePayrollStore.getState().payslips
                .find((p) => p.employeeId === "EMP001" && p.periodStart === "2026-02-01")!.id;
        });

        it("Step 10: HR creates an earnings adjustment for OT correction", () => {
            usePayrollStore.getState().createAdjustment({
                payrollRunId: "RUN-2026-03-31",
                employeeId: "EMP001",
                adjustmentType: "earnings",
                amount: 3500,
                reason: "Missed 5 hours OT from Feb 1st cutoff",
                referencePayslipId: firstCutoffId,
                createdBy: "HR-Admin-001",
            });

            const adj = usePayrollStore.getState().adjustments;
            expect(adj.length).toBeGreaterThan(0);
            const latest = adj[adj.length - 1];
            expect(latest.status).toBe("pending");
            expect(latest.adjustmentType).toBe("earnings");
            expect(latest.amount).toBe(3500);
            expect(latest.createdBy).toBe("HR-Admin-001");
        });

        it("Step 11: Finance approves the adjustment", () => {
            usePayrollStore.getState().createAdjustment({
                payrollRunId: "RUN-2026-03-31",
                employeeId: "EMP001",
                adjustmentType: "earnings",
                amount: 3500,
                reason: "Missed OT correction",
                referencePayslipId: firstCutoffId,
                createdBy: "HR-Admin-001",
            });
            const adjId = usePayrollStore.getState().adjustments[usePayrollStore.getState().adjustments.length - 1].id;

            usePayrollStore.getState().approveAdjustment(adjId, "FINANCE-MGR-001");

            const approved = usePayrollStore.getState().adjustments.find((a) => a.id === adjId);
            expect(approved!.status).toBe("approved");
            expect(approved!.approvedBy).toBe("FINANCE-MGR-001");
            expect(approved!.approvedAt).toBeTruthy();
        });

        it("Step 11: applying adjustment creates a new adjustment payslip", () => {
            usePayrollStore.getState().createAdjustment({
                payrollRunId: "RUN-2026-03-31",
                employeeId: "EMP001",
                adjustmentType: "earnings",
                amount: 3500,
                reason: "Missed OT correction",
                referencePayslipId: firstCutoffId,
                createdBy: "HR-Admin-001",
            });
            const adjId = usePayrollStore.getState().adjustments[usePayrollStore.getState().adjustments.length - 1].id;
            usePayrollStore.getState().approveAdjustment(adjId, "FINANCE-MGR-001");

            const payslipsBefore = usePayrollStore.getState().payslips.length;
            usePayrollStore.getState().applyAdjustment(adjId, "RUN-2026-03-31");
            const payslipsAfter = usePayrollStore.getState().payslips.length;

            expect(payslipsAfter).toBe(payslipsBefore + 1);

            // New payslip should be an adjustment payslip
            const adjPayslip = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            expect(adjPayslip.adjustmentRef).toBe(adjId);
            expect(adjPayslip.netPay).toBe(3500);
            expect(adjPayslip.notes).toContain("Prior Period");

            // Adjustment status should be "applied"
            const applied = usePayrollStore.getState().adjustments.find((a) => a.id === adjId);
            expect(applied!.status).toBe("applied");
            expect(applied!.appliedRunId).toBe("RUN-2026-03-31");
        });

        it("Finance can reject an adjustment", () => {
            usePayrollStore.getState().createAdjustment({
                payrollRunId: "RUN-2026-03-31",
                employeeId: "EMP001",
                adjustmentType: "deduction",
                amount: 1000,
                reason: "Duplicate reimbursement",
                referencePayslipId: firstCutoffId,
                createdBy: "HR-Admin-001",
            });
            const adjId = usePayrollStore.getState().adjustments[usePayrollStore.getState().adjustments.length - 1].id;

            usePayrollStore.getState().rejectAdjustment(adjId, "FINANCE-MGR-001");
            expect(usePayrollStore.getState().adjustments.find((a) => a.id === adjId)!.status).toBe("rejected");
        });
    });

    // ── Step 12: Final Pay for Resigned Employee ────────────
    describe("Step 12: Final pay computation", () => {
        it("computes final pay with pro-rated salary, OT, leave payout, and loan deduction", () => {
            // EMP003 (Sophia) resigns March 15 — ₱88,000/month
            usePayrollStore.getState().computeFinalPay({
                employeeId: "EMP003",
                resignedAt: "2026-03-15",
                salary: 88000,
                unpaidOTHours: 8,
                leaveDays: 3,
                loanBalance: 5000,
            });

            const fp = usePayrollStore.getState().getFinalPay("EMP003");
            expect(fp).toBeTruthy();

            // Pro-rated salary: 88000/31 * 15 ≈ 42580
            const daysInMarch = 31;
            const dailyRate = Math.round(88000 / daysInMarch);
            const expectedProRated = Math.round(dailyRate * 15);
            expect(fp!.proRatedSalary).toBe(expectedProRated);

            // OT: hourlyRate = (88000*12)/2080, then * 1.25 * 8 hours
            const hourlyRate = (88000 * 12) / 2080;
            const expectedOT = Math.round(8 * hourlyRate * 1.25);
            expect(fp!.unpaidOT).toBe(expectedOT);

            // Leave payout: 3 days * daily rate
            expect(fp!.leavePayout).toBe(Math.round(3 * dailyRate));

            // Deductions = loan balance
            expect(fp!.deductions).toBe(5000);
            expect(fp!.remainingLoanBalance).toBe(5000);

            // Net = gross - deductions, net > 0
            expect(fp!.grossFinalPay).toBe(expectedProRated + expectedOT + Math.round(3 * dailyRate));
            expect(fp!.netFinalPay).toBe(Math.max(0, fp!.grossFinalPay - 5000));
            expect(fp!.netFinalPay).toBeGreaterThan(0);

            expect(fp!.status).toBe("draft");
        });

        it("prevents duplicate final pay computation", () => {
            usePayrollStore.getState().computeFinalPay({
                employeeId: "EMP003",
                resignedAt: "2026-03-15",
                salary: 88000,
                unpaidOTHours: 8,
                leaveDays: 3,
                loanBalance: 5000,
            });
            const before = usePayrollStore.getState().finalPayComputations.length;

            // Second attempt should not add another
            usePayrollStore.getState().computeFinalPay({
                employeeId: "EMP003",
                resignedAt: "2026-03-15",
                salary: 88000,
                unpaidOTHours: 10,
                leaveDays: 5,
                loanBalance: 3000,
            });
            expect(usePayrollStore.getState().finalPayComputations.length).toBe(before);
        });
    });

    // ── Step 13: 13th Month Pay Generation ──────────────────
    describe("Step 13: 13th month pay generation", () => {
        it("generates 13th month payslips for all employees (full year)", () => {
            const before = usePayrollStore.getState().payslips.length;
            usePayrollStore.getState().generate13thMonth(
                EMPLOYEES.map((e) => ({ id: e.id, salary: e.salary }))
            );
            expect(usePayrollStore.getState().payslips.length).toBe(before + 3);

            // Each 13th month = salary (full year = salary * 12 / 12 = salary)
            for (const emp of EMPLOYEES) {
                const thirteenth = usePayrollStore.getState().payslips.find(
                    (p) => p.employeeId === emp.id && p.notes?.includes("13th Month")
                );
                expect(thirteenth).toBeTruthy();
                expect(thirteenth!.netPay).toBe(emp.salary); // Full year = 12/12
                expect(thirteenth!.taxDeduction).toBe(0); // Tax-exempt up to ₱90K
            }
        });

        it("pro-rates 13th month for mid-year joiners", () => {
            const before = usePayrollStore.getState().payslips.length;
            // Employee joined July 1st = 6 months
            usePayrollStore.getState().generate13thMonth([
                { id: "EMP-NEW", salary: 80000, joinDate: `${new Date().getFullYear()}-07-01` },
            ]);

            const thirteenth = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            expect(thirteenth.netPay).toBe(Math.round((80000 * 6) / 12)); // 6 months pro-rated
            expect(thirteenth.notes).toContain("6/12 months");
        });
    });

    // ── Step 14: Bank File Export ────────────────────────────
    describe("Step 14: Bank file export", () => {
        it("exports bank file CSV for the payroll run without error", () => {
            // Issue payslips with matching issuedAt
            for (const emp of EMPLOYEES) {
                usePayrollStore.getState().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-16",
                    periodEnd: "2026-03-31",
                    grossPay: emp.salary / 2,
                    allowances: 0,
                    sssDeduction: 0,
                    philhealthDeduction: 0,
                    pagibigDeduction: 0,
                    taxDeduction: 0,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: emp.salary / 2,
                    issuedAt: "2026-04-05",
                });
            }

            expect(() => {
                usePayrollStore.getState().exportBankFile(
                    "2026-04-05",
                    EMPLOYEES.map((e) => ({ id: e.id, name: e.name, salary: e.salary }))
                );
            }).not.toThrow();
        });
    });

    // ── Full Integration: Complete March Semi-Monthly Cycle ──
    describe("Full integration: complete March semi-monthly payroll cycle", () => {
        it("runs the entire cycle from issue to acknowledged", () => {
            const store = usePayrollStore.getState;

            // ─── 1ST CUTOFF (Mar 1–15, paid on 20th) ───────
            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                store().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-01",
                    periodEnd: "2026-03-15",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: 0,
                    philhealthDeduction: 0,
                    pagibigDeduction: 0,
                    taxDeduction: 0,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: gross,
                    issuedAt: "2026-03-20",
                });
            }

            // ─── 2ND CUTOFF (Mar 16–31, paid on Apr 5th) ───
            for (const emp of EMPLOYEES) {
                const gross = semiMonthlyGross(emp.salary);
                const ded = computeAllPHDeductions(emp.salary);
                store().issuePayslip({
                    employeeId: emp.id,
                    periodStart: "2026-03-16",
                    periodEnd: "2026-03-31",
                    payFrequency: "semi_monthly",
                    grossPay: gross,
                    allowances: 0,
                    sssDeduction: ded.sss,
                    philhealthDeduction: ded.philHealth,
                    pagibigDeduction: ded.pagIBIG,
                    taxDeduction: ded.withholdingTax,
                    otherDeductions: 0,
                    loanDeduction: 0,
                    netPay: gross - ded.totalDeductions,
                    issuedAt: "2026-04-05",
                });
            }

            // Collect all new payslip IDs
            const allNewIds = store().payslips
                .filter((p) => p.periodStart === "2026-03-01" || p.periodStart === "2026-03-16")
                .filter((p) => EMPLOYEES.some((e) => e.id === p.employeeId))
                .map((p) => p.id);
            expect(allNewIds.length).toBe(6);

            // ─── ADMIN: Confirm all ─────────────────────────
            allNewIds.forEach((id) => store().confirmPayslip(id));
            const allConfirmed = store().payslips.filter(
                (p) => allNewIds.includes(p.id) && p.status === "confirmed"
            );
            expect(allConfirmed.length).toBe(6);

            // ─── ADMIN: Create run ──────────────────────────
            store().createDraftRun("2026-03-31", allNewIds);
            store().validateRun("2026-03-31");
            store().lockRun("2026-03-31", "HR-Manager-001");
            store().publishRun("2026-03-31");

            const run = store().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(run!.status).toBe("published");

            // ─── EMPLOYEE: Sign payslips ────────────────────
            for (const emp of EMPLOYEES) {
                store().payslips
                    .filter((p) => p.employeeId === emp.id && allNewIds.includes(p.id) && p.status === "published")
                    .forEach((ps) => {
                        store().signPayslip(ps.id, `data:image/png;base64,SIGNATURE_${emp.id}`);
                    });
            }

            // ─── FINANCE: Record payment ────────────────────
            allNewIds.forEach((id) => store().recordPayment(id, "bank_transfer", `BPI-REF-${id}`));

            // ─── EMPLOYEE: Acknowledge ──────────────────────
            for (const emp of EMPLOYEES) {
                store().payslips
                    .filter((p) => p.employeeId === emp.id && allNewIds.includes(p.id) && p.status === "paid")
                    .forEach((ps) => {
                        store().acknowledgePayslip(ps.id, emp.id);
                    });
            }

            // ─── ADMIN: Mark run paid ───────────────────────
            store().markRunPaid("2026-03-31");

            // ─── ASSERTIONS ─────────────────────────────────
            const finalRun = store().runs.find((r) => r.periodLabel === "2026-03-31");
            expect(finalRun!.status).toBe("paid");

            const acknowledgedPayslips = store().payslips.filter(
                (p) => allNewIds.includes(p.id) && p.status === "acknowledged"
            );
            expect(acknowledgedPayslips.length).toBe(6);

            // Every acknowledged payslip has all required fields
            acknowledgedPayslips.forEach((ps) => {
                expect(ps.signedAt).toBeTruthy();
                expect(ps.signatureDataUrl).toBeTruthy();
                expect(ps.paidAt).toBeTruthy();
                expect(ps.paymentMethod).toBe("bank_transfer");
                expect(ps.bankReferenceId).toBeTruthy();
                expect(ps.acknowledgedAt).toBeTruthy();
                expect(ps.acknowledgedBy).toBeTruthy();
                expect(ps.payrollBatchId).toBe("RUN-2026-03-31");
            });

            // 2nd cutoff payslips have gov deductions
            const secondCutoffAcknowledged = acknowledgedPayslips.filter((p) => p.periodStart === "2026-03-16");
            expect(secondCutoffAcknowledged.length).toBe(3);
            secondCutoffAcknowledged.forEach((ps) => {
                expect(ps.sssDeduction).toBeGreaterThan(0);
                expect(ps.philhealthDeduction).toBeGreaterThan(0);
                expect(ps.pagibigDeduction).toBe(100);
                expect(ps.taxDeduction).toBeGreaterThan(0);
            });

            // 1st cutoff payslips have no gov deductions
            const firstCutoffAcknowledged = acknowledgedPayslips.filter((p) => p.periodStart === "2026-03-01");
            expect(firstCutoffAcknowledged.length).toBe(3);
            firstCutoffAcknowledged.forEach((ps) => {
                expect(ps.sssDeduction).toBe(0);
                expect(ps.philhealthDeduction).toBe(0);
                expect(ps.pagibigDeduction).toBe(0);
                expect(ps.taxDeduction).toBe(0);
            });
        });
    });

    // ── Edge Cases & Guardrails ─────────────────────────────
    describe("Edge cases and guardrails", () => {
        it("cannot acknowledge without signing first", () => {
            usePayrollStore.getState().issuePayslip({
                employeeId: "EMP001",
                periodStart: "2026-03-01",
                periodEnd: "2026-03-15",
                grossPay: 47500,
                allowances: 0,
                sssDeduction: 0,
                philhealthDeduction: 0,
                pagibigDeduction: 0,
                taxDeduction: 0,
                otherDeductions: 0,
                loanDeduction: 0,
                netPay: 47500,
            });
            const ps = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(ps.id);
            usePayrollStore.getState().publishPayslip(ps.id);
            usePayrollStore.getState().recordPayment(ps.id, "bank_transfer", "REF-001");

            // Try acknowledge without signing
            usePayrollStore.getState().acknowledgePayslip(ps.id, "EMP001");
            // Should still be "paid" because signedAt is not set
            expect(usePayrollStore.getState().payslips.find((p) => p.id === ps.id)!.status).toBe("paid");
        });

        it("cannot publish an unconfirmed payslip", () => {
            usePayrollStore.getState().issuePayslip({
                employeeId: "EMP001",
                periodStart: "2026-03-01",
                periodEnd: "2026-03-15",
                grossPay: 47500,
                allowances: 0,
                sssDeduction: 0,
                philhealthDeduction: 0,
                pagibigDeduction: 0,
                taxDeduction: 0,
                otherDeductions: 0,
                loanDeduction: 0,
                netPay: 47500,
            });
            const ps = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];

            // Try to publish without confirming
            usePayrollStore.getState().publishPayslip(ps.id);
            expect(usePayrollStore.getState().payslips.find((p) => p.id === ps.id)!.status).toBe("issued");
        });

        it("cannot pay a non-published payslip", () => {
            usePayrollStore.getState().issuePayslip({
                employeeId: "EMP001",
                periodStart: "2026-03-01",
                periodEnd: "2026-03-15",
                grossPay: 47500,
                allowances: 0,
                sssDeduction: 0,
                philhealthDeduction: 0,
                pagibigDeduction: 0,
                taxDeduction: 0,
                otherDeductions: 0,
                loanDeduction: 0,
                netPay: 47500,
            });
            const ps = usePayrollStore.getState().payslips[usePayrollStore.getState().payslips.length - 1];
            usePayrollStore.getState().confirmPayslip(ps.id);

            // Try to pay a "confirmed" payslip
            usePayrollStore.getState().recordPayment(ps.id, "bank_transfer", "REF-001");
            expect(usePayrollStore.getState().payslips.find((p) => p.id === ps.id)!.status).toBe("confirmed");
        });

        it("cannot mark run paid if not published", () => {
            usePayrollStore.getState().createDraftRun("2026-04-30", []);
            usePayrollStore.getState().validateRun("2026-04-30");
            usePayrollStore.getState().lockRun("2026-04-30");

            // Try to mark paid without publishing
            usePayrollStore.getState().markRunPaid("2026-04-30");
            expect(usePayrollStore.getState().runs.find((r) => r.periodLabel === "2026-04-30")!.status).toBe("locked");
        });

        it("getPayslipsByStatus and query helpers work correctly", () => {
            const published = usePayrollStore.getState().getPayslipsByStatus("published");
            expect(published.every((p) => p.status === "published")).toBe(true);

            const emp001Payslips = usePayrollStore.getState().getByEmployee("EMP001");
            expect(emp001Payslips.every((p) => p.employeeId === "EMP001")).toBe(true);

            const pending = usePayrollStore.getState().getPending();
            expect(pending.every((p) => p.status === "issued")).toBe(true);
        });
    });
});

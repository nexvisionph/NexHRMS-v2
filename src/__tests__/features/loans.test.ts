/**
 * Feature Test: Loans
 *
 * Covers: loans.store.ts
 * - Loan creation & defaults (30% cap)
 * - Deductions (simple + recorded with history)
 * - Settlement, freeze, unfreeze, cancel lifecycle
 * - Repayment schedule generation
 * - Balance history tracking
 * - Cap-aware deductions (deductionCapPercent enforcement)
 * - Query helpers (getByEmployee, getActiveByEmployee)
 */

import { useLoansStore } from "@/store/loans.store";

beforeEach(() => useLoansStore.getState().resetToSeed());

const LOAN_INPUT = {
    employeeId: "EMP001",
    type: "salary" as const,
    amount: 50000,
    monthlyDeduction: 5000,
    status: "active" as const,
    approvedBy: "ADMIN001",
    remarks: "Emergency loan",
};

describe("Loans", () => {
    // ── Creation ────────────────────────────────────────────
    describe("Loan creation", () => {
        it("creates a loan with default cap", () => {
            const before = useLoansStore.getState().loans.length;
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loans = useLoansStore.getState().loans;
            expect(loans.length).toBe(before + 1);
            const newLoan = loans[loans.length - 1];
            expect(newLoan.remainingBalance).toBe(50000);
            expect(newLoan.deductionCapPercent).toBe(30);
        });

        it("creates a loan with custom cap", () => {
            useLoansStore.getState().createLoan({ ...LOAN_INPUT, deductionCapPercent: 50 });
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            expect(loan.deductionCapPercent).toBe(50);
        });
    });

    // ── Simple deduction ────────────────────────────────────
    describe("Simple deductions", () => {
        it("deducts from loan balance", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().deductFromLoan(loan.id, 5000);
            const updated = useLoansStore.getState().loans.find((l) => l.id === loan.id)!;
            expect(updated.remainingBalance).toBe(45000);
        });

        it("auto-settles when balance reaches 0", () => {
            useLoansStore.getState().createLoan({ ...LOAN_INPUT, amount: 5000 });
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().deductFromLoan(loan.id, 5000);
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.status).toBe("settled");
        });

        it("does not go below zero", () => {
            useLoansStore.getState().createLoan({ ...LOAN_INPUT, amount: 3000 });
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().deductFromLoan(loan.id, 5000);
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.remainingBalance).toBe(0);
        });
    });

    // ── Lifecycle ───────────────────────────────────────────
    describe("Loan lifecycle", () => {
        it("settles a loan", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().settleLoan(loan.id);
            const settled = useLoansStore.getState().loans.find((l) => l.id === loan.id)!;
            expect(settled.status).toBe("settled");
            expect(settled.remainingBalance).toBe(0);
        });

        it("freezes a loan", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().freezeLoan(loan.id);
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.status).toBe("frozen");
        });

        it("unfreezes a frozen loan", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().freezeLoan(loan.id);
            useLoansStore.getState().unfreezeLoan(loan.id);
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.status).toBe("active");
        });

        it("cancels a loan (soft cancel)", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().cancelLoan(loan.id);
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.status).toBe("cancelled");
        });

        it("updates loan fields", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().updateLoan(loan.id, { monthlyDeduction: 7500 });
            expect(useLoansStore.getState().loans.find((l) => l.id === loan.id)?.monthlyDeduction).toBe(7500);
        });
    });

    // ── Recorded deductions with history ────────────────────
    describe("Recorded deductions", () => {
        it("records deduction with balance history", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().recordDeduction(loan.id, "PAY-001", 5000);
            const updated = useLoansStore.getState().loans.find((l) => l.id === loan.id)!;
            expect(updated.deductions?.length).toBe(1);
            expect(updated.balanceHistory?.length).toBe(1);
            expect(updated.remainingBalance).toBe(45000);
        });

        it("getAllDeductions returns sorted deductions", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().recordDeduction(loan.id, "PAY-001", 5000);
            const all = useLoansStore.getState().getAllDeductions();
            expect(all.length).toBeGreaterThanOrEqual(1);
            expect(all[0].employeeId).toBe("EMP001");
        });
    });

    // ── Repayment schedule ──────────────────────────────────
    describe("Repayment schedule", () => {
        it("generates a repayment schedule", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().generateSchedule(loan.id);
            const schedule = useLoansStore.getState().getSchedule(loan.id);
            expect(schedule.length).toBe(Math.ceil(50000 / 5000));
            expect(schedule.every((s) => !s.paid)).toBe(true);
        });

        it("returns empty schedule for unknown loan", () => {
            expect(useLoansStore.getState().getSchedule("UNKNOWN")).toEqual([]);
        });
    });

    // ── Cap-aware deductions ────────────────────────────────
    describe("Cap-aware deductions", () => {
        it("computes capped deduction within cap", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT); // 30% cap, 5000/mo
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            // Net pay 50000 → 30% = 15000 → min(5000, 50000, 15000) = 5000
            const capped = useLoansStore.getState().computeCappedDeduction(loan.id, 50000);
            expect(capped).toBe(5000);
        });

        it("caps deduction when net pay is low", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT); // 30% cap, 5000/mo
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            // Net pay 10000 → 30% = 3000 → min(5000, 50000, 3000) = 3000
            const capped = useLoansStore.getState().computeCappedDeduction(loan.id, 10000);
            expect(capped).toBe(3000);
        });

        it("records capped deduction successfully", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            const result = useLoansStore.getState().recordCappedDeduction(loan.id, "PAY-005", 50000);
            expect(result.deducted).toBe(5000);
            expect(result.skipped).toBe(false);
        });

        it("skips capped deduction on frozen loan", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().freezeLoan(loan.id);
            const result = useLoansStore.getState().recordCappedDeduction(loan.id, "PAY-006", 50000);
            expect(result.skipped).toBe(true);
            expect(result.reason).toBe("frozen");
        });

        it("returns zero for non-active loan compute", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().cancelLoan(loan.id);
            expect(useLoansStore.getState().computeCappedDeduction(loan.id, 50000)).toBe(0);
        });
    });

    // ── Queries ─────────────────────────────────────────────
    describe("Queries", () => {
        it("gets loans by employee", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loans = useLoansStore.getState().getByEmployee("EMP001");
            expect(loans.every((l) => l.employeeId === "EMP001")).toBe(true);
        });

        it("gets active loans by employee", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const active = useLoansStore.getState().getActiveByEmployee("EMP001");
            expect(active.every((l) => l.status === "active")).toBe(true);
        });

        it("getBalanceHistory returns history for a loan", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            const loan = useLoansStore.getState().loans[useLoansStore.getState().loans.length - 1];
            useLoansStore.getState().recordDeduction(loan.id, "PAY-010", 5000);
            const history = useLoansStore.getState().getBalanceHistory(loan.id);
            expect(history.length).toBe(1);
            expect(history[0].previousBalance).toBe(50000);
            expect(history[0].newBalance).toBe(45000);
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset", () => {
        it("resets to seed data", () => {
            useLoansStore.getState().createLoan(LOAN_INPUT);
            useLoansStore.getState().resetToSeed();
            // New loan should be gone
            const hasNew = useLoansStore.getState().loans.some((l) => l.remarks === "Emergency loan");
            expect(hasNew).toBe(false);
        });
    });
});

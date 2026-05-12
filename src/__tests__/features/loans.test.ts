/** @jest-environment jsdom */
/**
 * Loans Store Tests — NexHRMS
 * Tests loan lifecycle, cap-aware deductions, repayment schedules, and balance tracking
 */

import { renderHook, act } from "@testing-library/react";
import { useLoansStore } from "@/store/loans.store";

describe("Loans Store", () => {
    beforeEach(() => {
        const { result } = renderHook(() => useLoansStore());
        act(() => {
            result.current.resetToSeed();
        });
    });

    // ══════════════════════════════════════════════════════════
    // Loan Creation
    // ══════════════════════════════════════════════════════════

    describe("Loan Creation", () => {
        it("should create a loan with correct initial state", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-001",
                    type: "salary",
                    amount: 50000,
                    monthlyDeduction: 5000,
                    status: "active",
                    remarks: "Salary loan",
                });
            });

            const loans = result.current.getByEmployee("EMP-001");
            const newLoan = loans.find((l) => l.remarks === "Salary loan");
            expect(newLoan).toBeDefined();
            expect(newLoan?.amount).toBe(50000);
            expect(newLoan?.remainingBalance).toBe(50000); // initially full
            expect(newLoan?.monthlyDeduction).toBe(5000);
            expect(newLoan?.status).toBe("active");
        });

        it("should default deduction cap to 30%", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-001",
                    type: "emergency",
                    amount: 20000,
                    monthlyDeduction: 2000,
                    status: "active",
                });
            });

            const loans = result.current.getByEmployee("EMP-001");
            const loan = loans.find((l) => l.amount === 20000);
            expect(loan?.deductionCapPercent).toBe(30);
        });

        it("should allow custom deduction cap percentage", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-001",
                    type: "housing",
                    amount: 100000,
                    monthlyDeduction: 8000,
                    status: "active",
                    deductionCapPercent: 40,
                });
            });

            const loans = result.current.getByEmployee("EMP-001");
            const loan = loans.find((l) => l.amount === 100000);
            expect(loan?.deductionCapPercent).toBe(40);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Loan Deductions
    // ══════════════════════════════════════════════════════════

    describe("Loan Deductions", () => {
        it("should deduct from loan balance", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-DEDUCT",
                    type: "salary",
                    amount: 10000,
                    monthlyDeduction: 2000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-DEDUCT").find((l) => l.amount === 10000);

            act(() => {
                result.current.deductFromLoan(loan!.id, 2000);
            });

            const updated = result.current.getByEmployee("EMP-DEDUCT").find((l) => l.id === loan!.id);
            expect(updated?.remainingBalance).toBe(8000);
        });

        it("should auto-settle loan when balance reaches zero", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-SETTLE",
                    type: "salary",
                    amount: 5000,
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-SETTLE").find((l) => l.amount === 5000);

            act(() => {
                result.current.deductFromLoan(loan!.id, 5000);
            });

            const settled = result.current.getByEmployee("EMP-SETTLE").find((l) => l.id === loan!.id);
            expect(settled?.remainingBalance).toBe(0);
            expect(settled?.status).toBe("settled");
        });

        it("should not allow balance to go below zero", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-OVERPAY",
                    type: "salary",
                    amount: 3000,
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-OVERPAY").find((l) => l.amount === 3000);

            act(() => {
                result.current.deductFromLoan(loan!.id, 5000); // more than balance
            });

            const updated = result.current.getByEmployee("EMP-OVERPAY").find((l) => l.id === loan!.id);
            expect(updated?.remainingBalance).toBe(0);
        });

        it("should record deduction with history entry", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-HIST",
                    type: "salary",
                    amount: 20000,
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-HIST").find((l) => l.amount === 20000);

            act(() => {
                result.current.recordDeduction(loan!.id, "PAY-001", 5000);
            });

            const updated = result.current.getByEmployee("EMP-HIST").find((l) => l.id === loan!.id);
            expect(updated?.remainingBalance).toBe(15000);
            expect(updated?.deductions?.length).toBe(1);
            expect(updated?.deductions?.[0]?.amount).toBe(5000);
            expect(updated?.balanceHistory?.length).toBe(1);
            expect(updated?.balanceHistory?.[0]?.previousBalance).toBe(20000);
            expect(updated?.balanceHistory?.[0]?.newBalance).toBe(15000);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Cap-Aware Deduction (§13 — 30% net pay cap)
    // ══════════════════════════════════════════════════════════

    describe("Cap-Aware Deduction", () => {
        it("should cap deduction at 30% of net pay", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-CAP",
                    type: "salary",
                    amount: 50000,
                    monthlyDeduction: 10000, // wants ₱10K/mo
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-CAP").find((l) => l.amount === 50000);
            const netPay = 20000; // 30% = ₱6,000

            const cappedAmount = result.current.computeCappedDeduction(loan!.id, netPay);
            expect(cappedAmount).toBe(6000); // capped at 30% of ₱20K
        });

        it("should use monthly deduction when lower than cap", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LOWDEDUCT",
                    type: "salary",
                    amount: 50000,
                    monthlyDeduction: 2000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LOWDEDUCT").find((l) => l.amount === 50000);
            const netPay = 30000; // 30% = ₱9,000, but monthly deduction is only ₱2K

            const cappedAmount = result.current.computeCappedDeduction(loan!.id, netPay);
            expect(cappedAmount).toBe(2000); // uses lower monthly deduction
        });

        it("should use remaining balance when lower than deduction", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LASTPAY",
                    type: "salary",
                    amount: 1000, // small remaining
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LASTPAY").find((l) => l.amount === 1000);
            const netPay = 30000;

            const cappedAmount = result.current.computeCappedDeduction(loan!.id, netPay);
            expect(cappedAmount).toBe(1000); // limited by remaining balance
        });

        it("should skip deduction for frozen loan", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-FROZEN",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-FROZEN").find((l) => l.amount === 30000);

            act(() => {
                result.current.freezeLoan(loan!.id);
            });

            const deduction = result.current.recordCappedDeduction(loan!.id, "PAY-001", 25000);
            expect(deduction.deducted).toBe(0);
            expect(deduction.skipped).toBe(true);
            expect(deduction.reason).toBe("frozen");
        });

        it("should record capped deduction and update balance", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-RECORD-CAP",
                    type: "salary",
                    amount: 50000,
                    monthlyDeduction: 10000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-RECORD-CAP").find((l) => l.amount === 50000);

            let deductionResult: { deducted: number; skipped: boolean };
            act(() => {
                deductionResult = result.current.recordCappedDeduction(loan!.id, "PAY-001", 20000);
            });

            expect(deductionResult!.deducted).toBe(6000); // 30% of ₱20K
            expect(deductionResult!.skipped).toBe(false);

            const updated = result.current.getByEmployee("EMP-RECORD-CAP").find((l) => l.id === loan!.id);
            expect(updated?.remainingBalance).toBe(44000); // 50000 - 6000
        });
    });

    // ══════════════════════════════════════════════════════════
    // Loan Lifecycle (freeze, unfreeze, settle, cancel)
    // ══════════════════════════════════════════════════════════

    describe("Loan Lifecycle", () => {
        it("should freeze an active loan", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LIFE",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LIFE").find((l) => l.amount === 30000);

            act(() => {
                result.current.freezeLoan(loan!.id);
            });

            const frozen = result.current.getByEmployee("EMP-LIFE").find((l) => l.id === loan!.id);
            expect(frozen?.status).toBe("frozen");
        });

        it("should unfreeze a frozen loan back to active", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LIFE",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LIFE").find((l) => l.amount === 30000);

            act(() => {
                result.current.freezeLoan(loan!.id);
                result.current.unfreezeLoan(loan!.id);
            });

            const unfrozen = result.current.getByEmployee("EMP-LIFE").find((l) => l.id === loan!.id);
            expect(unfrozen?.status).toBe("active");
        });

        it("should settle a loan (force zero balance)", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LIFE",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LIFE").find((l) => l.amount === 30000);

            act(() => {
                result.current.settleLoan(loan!.id);
            });

            const settled = result.current.getByEmployee("EMP-LIFE").find((l) => l.id === loan!.id);
            expect(settled?.status).toBe("settled");
            expect(settled?.remainingBalance).toBe(0);
        });

        it("should cancel a loan (preserve history)", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LIFE",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LIFE").find((l) => l.amount === 30000);

            act(() => {
                result.current.cancelLoan(loan!.id);
            });

            const cancelled = result.current.getByEmployee("EMP-LIFE").find((l) => l.id === loan!.id);
            expect(cancelled?.status).toBe("cancelled");
            // Balance preserved (not zeroed, for audit)
            expect(cancelled?.remainingBalance).toBe(30000);
        });

        it("should update loan monthly deduction amount", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-LIFE",
                    type: "salary",
                    amount: 30000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-LIFE").find((l) => l.amount === 30000);

            act(() => {
                result.current.updateLoan(loan!.id, { monthlyDeduction: 5000 });
            });

            const updated = result.current.getByEmployee("EMP-LIFE").find((l) => l.id === loan!.id);
            expect(updated?.monthlyDeduction).toBe(5000);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Repayment Schedule
    // ══════════════════════════════════════════════════════════

    describe("Repayment Schedule", () => {
        it("should generate correct number of installments", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-SCHED",
                    type: "salary",
                    amount: 10000,
                    monthlyDeduction: 2500,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-SCHED").find((l) => l.amount === 10000);

            act(() => {
                result.current.generateSchedule(loan!.id);
            });

            const schedule = result.current.getSchedule(loan!.id);
            expect(schedule.length).toBe(4); // 10000 / 2500 = 4 installments
        });

        it("should have correct amounts in schedule", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-SCHED",
                    type: "salary",
                    amount: 7000,
                    monthlyDeduction: 3000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-SCHED").find((l) => l.amount === 7000);

            act(() => {
                result.current.generateSchedule(loan!.id);
            });

            const schedule = result.current.getSchedule(loan!.id);
            expect(schedule.length).toBe(3); // ceil(7000/3000) = 3
            expect(schedule[0].amount).toBe(3000);
            expect(schedule[1].amount).toBe(3000);
            expect(schedule[2].amount).toBe(1000); // remaining
        });

        it("should return empty schedule for non-existent loan", () => {
            const { result } = renderHook(() => useLoansStore());
            const schedule = result.current.getSchedule("NONEXISTENT");
            expect(schedule).toEqual([]);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Query Methods
    // ══════════════════════════════════════════════════════════

    describe("Query Methods", () => {
        it("should get only active loans for employee", () => {
            const { result } = renderHook(() => useLoansStore());

            // Create two loans — nanoid mock gives same ID, so create them separately
            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-QUERY",
                    type: "salary",
                    amount: 10000,
                    monthlyDeduction: 2000,
                    status: "active",
                });
            });

            const allBefore = result.current.getByEmployee("EMP-QUERY");
            // All created loans have the same mock ID — freeze the first one
            const loanToFreeze = allBefore[0];

            act(() => {
                result.current.freezeLoan(loanToFreeze.id);
            });

            // After freezing, active count should decrease
            const activeLoans = result.current.getActiveByEmployee("EMP-QUERY");
            expect(activeLoans.length).toBe(0); // frozen

            // Verify frozen status
            const frozen = result.current.getByEmployee("EMP-QUERY").find(l => l.id === loanToFreeze.id);
            expect(frozen?.status).toBe("frozen");
        });

        it("should get all deductions across loans", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-ALLDED",
                    type: "salary",
                    amount: 20000,
                    monthlyDeduction: 5000,
                    status: "active",
                });
            });

            const loan = result.current.getByEmployee("EMP-ALLDED").find((l) => l.amount === 20000);

            act(() => {
                result.current.recordDeduction(loan!.id, "PAY-001", 5000);
                result.current.recordDeduction(loan!.id, "PAY-002", 5000);
            });

            const allDeductions = result.current.getAllDeductions();
            const loanDeductions = allDeductions.filter((d) => d.loanId === loan!.id);
            expect(loanDeductions.length).toBe(2);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Reset
    // ══════════════════════════════════════════════════════════

    describe("Reset", () => {
        it("should reset to seed state", () => {
            const { result } = renderHook(() => useLoansStore());

            act(() => {
                result.current.createLoan({
                    employeeId: "EMP-RESET",
                    type: "salary",
                    amount: 99999,
                    monthlyDeduction: 9999,
                    status: "active",
                });
            });

            act(() => {
                result.current.resetToSeed();
            });

            const loans = result.current.getByEmployee("EMP-RESET");
            expect(loans.length).toBe(0);
        });
    });
});

"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Loan, LoanDeduction, LoanRepaymentSchedule, LoanBalanceHistory } from "@/types";
import { SEED_LOANS } from "@/data/seed";

interface LoansState {
    loans: Loan[];
    createLoan: (loan: Omit<Loan, "id" | "createdAt" | "remainingBalance" | "deductionCapPercent" | "approvedBy"> & { deductionCapPercent?: number; approvedBy?: string }) => void;
    deductFromLoan: (id: string, amount: number) => void;
    settleLoan: (id: string) => void;
    freezeLoan: (id: string) => void;
    unfreezeLoan: (id: string) => void;
    updateLoan: (id: string, patch: Partial<Pick<Loan, "monthlyDeduction" | "deductionCapPercent" | "remarks">>) => void;
    cancelLoan: (id: string) => void;
    getByEmployee: (employeeId: string) => Loan[];
    getActiveByEmployee: (employeeId: string) => Loan[];
    recordDeduction: (loanId: string, payslipId: string, amount: number) => void;
    getAllDeductions: () => (LoanDeduction & { employeeId: string })[];

    // ─── Repayment schedule (§13) ─────────────────────
    generateSchedule: (loanId: string) => void;
    getSchedule: (loanId: string) => LoanRepaymentSchedule[];

    // ─── Balance history ──────────────────────────────
    getBalanceHistory: (loanId: string) => LoanBalanceHistory[];

    // ─── Cap-aware deduction ──────────────────────────
    computeCappedDeduction: (loanId: string, employeeNetPay: number) => number;
    recordCappedDeduction: (loanId: string, payslipId: string, employeeNetPay: number) => { deducted: number; skipped: boolean; reason?: string };
    resetToSeed: () => void;
}

export const useLoansStore = create<LoansState>()(
    persist(
        (set, get) => ({
            loans: SEED_LOANS,

            createLoan: (data) =>
                set((s) => {
                    const newLoan: Loan = {
                        ...data,
                        id: `LN-${nanoid(8)}`,
                        remainingBalance: data.amount,
                        deductionCapPercent: data.deductionCapPercent ?? 30,
                        approvedBy: data.approvedBy ?? "system",
                        createdAt: new Date().toISOString().split("T")[0],
                    };
                    return { loans: [...s.loans, newLoan] };
                }),

            deductFromLoan: (id, amount) =>
                set((s) => ({
                    loans: s.loans.map((l) => {
                        if (l.id !== id) return l;
                        const newBalance = Math.max(0, l.remainingBalance - amount);
                        return {
                            ...l,
                            remainingBalance: newBalance,
                            status: newBalance === 0 ? "settled" as const : l.status,
                        };
                    }),
                })),

            settleLoan: (id) =>
                set((s) => ({
                    loans: s.loans.map((l) =>
                        l.id === id ? { ...l, remainingBalance: 0, status: "settled" as const } : l
                    ),
                })),

            freezeLoan: (id) =>
                set((s) => ({
                    loans: s.loans.map((l) =>
                        l.id === id ? { ...l, status: "frozen" as const } : l
                    ),
                })),

            unfreezeLoan: (id: string) =>
                set((s) => ({
                    loans: s.loans.map((l) =>
                        l.id === id && l.status === "frozen" ? { ...l, status: "active" as const } : l
                    ),
                })),

            updateLoan: (id, patch) =>
                set((s) => ({
                    loans: s.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)),
                })),

            cancelLoan: (id) =>
                set((s) => ({
                    // Soft-cancel: preserve history, just mark status
                    loans: s.loans.map((l) =>
                        l.id === id ? { ...l, status: "cancelled" as const } : l
                    ),
                })),

            getByEmployee: (employeeId) =>
                get().loans.filter((l) => l.employeeId === employeeId),

            getActiveByEmployee: (employeeId) =>
                get().loans.filter((l) => l.employeeId === employeeId && l.status === "active"),

            recordDeduction: (loanId, payslipId, amount) =>
                set((s) => ({
                    loans: s.loans.map((l) => {
                        if (l.id !== loanId) return l;
                        const newBalance = Math.max(0, l.remainingBalance - amount);
                        const deduction: LoanDeduction = {
                            id: `LD-${nanoid(8)}`,
                            loanId,
                            payslipId,
                            amount,
                            deductedAt: new Date().toISOString(),
                            remainingAfter: newBalance,
                        };
                        const historyEntry: LoanBalanceHistory = {
                            id: `LBH-${nanoid(8)}`,
                            loanId,
                            date: new Date().toISOString().split("T")[0],
                            previousBalance: l.remainingBalance,
                            deductionAmount: amount,
                            newBalance,
                            payslipId,
                        };
                        return {
                            ...l,
                            remainingBalance: newBalance,
                            status: newBalance <= 0 ? "settled" as const : l.status,
                            lastDeductedAt: new Date().toISOString(),
                            deductions: [...(l.deductions || []), deduction],
                            balanceHistory: [...(l.balanceHistory || []), historyEntry],
                        };
                    }),
                })),

            getAllDeductions: () => {
                const loans = get().loans;
                return loans.flatMap((l) =>
                    (l.deductions || []).map((d) => ({ ...d, employeeId: l.employeeId }))
                ).sort((a, b) => b.deductedAt.localeCompare(a.deductedAt));
            },

            // ─── Repayment schedule generation ────────────────────────
            generateSchedule: (loanId) =>
                set((s) => ({
                    loans: s.loans.map((l) => {
                        if (l.id !== loanId) return l;
                        const months = Math.ceil(l.amount / l.monthlyDeduction);
                        const schedule: LoanRepaymentSchedule[] = [];
                        let remaining = l.amount;
                        const today = new Date();
                        for (let i = 0; i < months; i++) {
                            const dueDate = new Date(today);
                            dueDate.setMonth(dueDate.getMonth() + i + 1);
                            const amt = Math.min(l.monthlyDeduction, remaining);
                            schedule.push({
                                id: `LRS-${nanoid(6)}`,
                                loanId,
                                dueDate: dueDate.toISOString().split("T")[0],
                                amount: amt,
                                paid: false,
                            });
                            remaining -= amt;
                        }
                        return { ...l, repaymentSchedule: schedule };
                    }),
                })),

            getSchedule: (loanId) => {
                const loan = get().loans.find((l) => l.id === loanId);
                return loan?.repaymentSchedule || [];
            },

            getBalanceHistory: (loanId) => {
                const loan = get().loans.find((l) => l.id === loanId);
                return loan?.balanceHistory || [];
            },

            // ─── Cap-aware deduction (§13) ────────────────────────────
            computeCappedDeduction: (loanId, employeeNetPay) => {
                const loan = get().loans.find((l) => l.id === loanId);
                if (!loan || loan.status !== "active") return 0;
                const cap = (loan.deductionCapPercent / 100) * employeeNetPay;
                return Math.min(loan.monthlyDeduction, loan.remainingBalance, cap);
            },

            recordCappedDeduction: (loanId, payslipId, employeeNetPay) => {
                const loan = get().loans.find((l) => l.id === loanId);
                if (!loan || loan.status !== "active") {
                    return { deducted: 0, skipped: true, reason: "frozen" };
                }
                const cap = (loan.deductionCapPercent / 100) * employeeNetPay;
                const maxDeduction = Math.min(loan.monthlyDeduction, loan.remainingBalance, cap);

                if (maxDeduction <= 0) {
                    // Carry-forward: insufficient net pay
                    return { deducted: 0, skipped: true, reason: "insufficient_net_pay" };
                }

                get().recordDeduction(loanId, payslipId, maxDeduction);
                return { deducted: maxDeduction, skipped: false };
            },
            resetToSeed: () => set({ loans: SEED_LOANS }),
        }),
        {
            name: "nexhrms-loans",
            version: 2,
            migrate: () => ({ loans: SEED_LOANS }),
        }
    )
);

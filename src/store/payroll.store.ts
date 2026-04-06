"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Payslip, PayrollRun, PayrollAdjustment, PayScheduleConfig, FinalPayComputation, PayrollSignatureConfig, DeductionOverride, DeductionGlobalDefault, DeductionType } from "@/types";
import { POLICY_VERSIONS } from "@/lib/constants";

export const DEFAULT_PAY_SCHEDULE: PayScheduleConfig = {
    defaultFrequency: "semi_monthly",
    semiMonthlyFirstCutoff: 15,
    semiMonthlyFirstPayDay: 20,
    semiMonthlySecondPayDay: 5,
    monthlyPayDay: 30,
    biWeeklyStartDate: "2026-01-05",
    weeklyPayDay: 5, // Friday
    deductGovFrom: "second",
};

export const DEFAULT_SIGNATURE_CONFIG: PayrollSignatureConfig = {
    mode: "manual",
    signatoryName: "",
    signatoryTitle: "",
    signatureDataUrl: undefined,
};

interface PayrollState {
    payslips: Payslip[];
    runs: PayrollRun[];
    adjustments: PayrollAdjustment[];
    finalPayComputations: FinalPayComputation[];
    paySchedule: PayScheduleConfig;
    signatureConfig: PayrollSignatureConfig;
    deductionOverrides: DeductionOverride[];
    globalDefaults: DeductionGlobalDefault[];
    updatePaySchedule: (patch: Partial<PayScheduleConfig>) => void;
    updateSignatureConfig: (patch: Partial<PayrollSignatureConfig>) => void;
    // ─── Government Deduction Overrides (PH Standard) ─────────
    setDeductionOverride: (override: DeductionOverride) => void;
    removeDeductionOverride: (employeeId: string, deductionType: DeductionType) => void;
    clearEmployeeOverrides: (employeeId: string) => void;
    getDeductionOverride: (employeeId: string, deductionType: DeductionType) => DeductionOverride | undefined;
    getEmployeeOverrides: (employeeId: string) => DeductionOverride[];
    // ─── Global Defaults ──────────────────────────────
    updateGlobalDefault: (config: DeductionGlobalDefault) => void;
    getGlobalDefault: (deductionType: DeductionType) => DeductionGlobalDefault | undefined;
    // ─── Payslip lifecycle ────────────────────────────
    issuePayslip: (payslip: Omit<Payslip, "id" | "status" | "issuedAt"> & { issuedAt?: string }) => void;
    confirmPayslip: (id: string) => void;
    publishPayslip: (id: string) => void;
    recordPayment: (id: string, paymentMethod: string, bankReferenceId: string) => void;
    signPayslip: (id: string, signatureDataUrl: string) => void;
    acknowledgePayslip: (id: string, employeeId: string) => void;
    confirmPaidByFinance: (id: string, confirmedBy: string, method: string, reference: string) => void;
    /** Update a payslip with data from server (avoids timestamp mismatch with write-through) */
    updatePayslipFromServer: (payslip: Partial<Payslip> & { id: string }) => void;
    getPayslipsByStatus: (status: Payslip["status"]) => Payslip[];
    getSignedPayslips: () => Payslip[];
    getUnsignedPublished: () => Payslip[];
    // ─── Payroll runs ─────────────────────────────────
    createDraftRun: (runDate: string, payslipIds: string[], runType?: PayrollRun["runType"]) => void;
    validateRun: (runDate: string) => void;
    lockRun: (runDate: string, lockedBy?: string) => void;
    publishRun: (runDate: string) => void;
    markRunPaid: (runDate: string) => void;
    // ─── Adjustments ──────────────────────────────────
    createAdjustment: (data: Omit<PayrollAdjustment, "id" | "status" | "createdAt">) => void;
    approveAdjustment: (adjustmentId: string, approverId: string) => void;
    rejectAdjustment: (adjustmentId: string, approverId: string) => void;
    applyAdjustment: (adjustmentId: string, runId: string) => void;
    // ─── Final Pay (§14) ──────────────────────────────
    computeFinalPay: (data: { employeeId: string; resignedAt: string; salary: number; unpaidOTHours: number; leaveDays: number; loanBalance: number }) => void;
    getFinalPay: (employeeId: string) => FinalPayComputation | undefined;
    // ─── Helpers ──────────────────────────────────────
    generate13thMonth: (employees: { id: string; salary: number; joinDate?: string }[]) => void;
    getByEmployee: (employeeId: string) => Payslip[];
    getPending: () => Payslip[];
    exportBankFile: (runDate: string, employees: { id: string; name: string; salary: number }[]) => void;
    resetToSeed: () => void;
    clearAllPayroll: () => void;
}

export const usePayrollStore = create<PayrollState>()(
    persist(
        (set, get) => ({
            payslips: [],
            runs: [],
            adjustments: [],
            finalPayComputations: [],
            paySchedule: DEFAULT_PAY_SCHEDULE,
            signatureConfig: DEFAULT_SIGNATURE_CONFIG,
            deductionOverrides: [],
            globalDefaults: [
                { deductionType: "sss", enabled: true, mode: "auto" },
                { deductionType: "philhealth", enabled: true, mode: "auto" },
                { deductionType: "pagibig", enabled: true, mode: "auto" },
                { deductionType: "bir", enabled: true, mode: "auto" },
            ],

            updatePaySchedule: (patch) =>
                set((s) => ({ paySchedule: { ...s.paySchedule, ...patch } })),

            updateSignatureConfig: (patch) =>
                set((s) => ({ signatureConfig: { ...s.signatureConfig, ...patch } })),

            // ─── Government Deduction Overrides (PH Standard) ─────────
            setDeductionOverride: (override) =>
                set((s) => ({
                    deductionOverrides: [
                        ...s.deductionOverrides.filter(
                            (d) => !(d.employeeId === override.employeeId && d.deductionType === override.deductionType)
                        ),
                        override,
                    ],
                })),

            removeDeductionOverride: (employeeId, deductionType) =>
                set((s) => ({
                    deductionOverrides: s.deductionOverrides.filter(
                        (d) => !(d.employeeId === employeeId && d.deductionType === deductionType)
                    ),
                })),

            clearEmployeeOverrides: (employeeId) =>
                set((s) => ({
                    deductionOverrides: s.deductionOverrides.filter((d) => d.employeeId !== employeeId),
                })),

            getDeductionOverride: (employeeId, deductionType) =>
                get().deductionOverrides.find(
                    (d) => d.employeeId === employeeId && d.deductionType === deductionType
                ),

            getEmployeeOverrides: (employeeId) =>
                get().deductionOverrides.filter((d) => d.employeeId === employeeId),

            // ─── Global Defaults ──────────────────────────────────────
            updateGlobalDefault: (config) =>
                set((s) => ({
                    globalDefaults: s.globalDefaults.map((g) =>
                        g.deductionType === config.deductionType ? { ...g, ...config } : g
                    ),
                })),

            getGlobalDefault: (deductionType) =>
                get().globalDefaults.find((g) => g.deductionType === deductionType),

            // ─── Payslip lifecycle ─────────────────────────────────────
            issuePayslip: (data) =>
                set((s) => ({
                    payslips: [
                        ...s.payslips,
                        {
                            ...data,
                            id: `PS-${nanoid(8)}`,
                            status: "issued",
                            issuedAt: data.issuedAt ?? new Date().toISOString().split("T")[0],
                        },
                    ],
                })),

            confirmPayslip: (id) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && p.status === "issued"
                            ? { ...p, status: "confirmed" as const, confirmedAt: new Date().toISOString() }
                            : p
                    ),
                })),

            publishPayslip: (id) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && p.status === "confirmed"
                            ? { ...p, status: "published" as const, publishedAt: new Date().toISOString() }
                            : p
                    ),
                })),

            recordPayment: (id, paymentMethod, bankReferenceId) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && p.status === "published"
                            ? { ...p, status: "paid" as const, paidAt: new Date().toISOString(), paymentMethod, bankReferenceId }
                            : p
                    ),
                })),

            signPayslip: (id, signatureDataUrl) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && ["issued", "published", "paid"].includes(p.status)
                            ? { ...p, signedAt: new Date().toISOString(), signatureDataUrl }
                            : p
                    ),
                })),

            acknowledgePayslip: (id, employeeId) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && p.status === "paid" && p.signedAt
                            ? { ...p, status: "acknowledged" as const, acknowledgedAt: new Date().toISOString(), acknowledgedBy: employeeId }
                            : p
                    ),
                })),

            confirmPaidByFinance: (id, confirmedBy, method, reference) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === id && p.status === "published"
                            ? { ...p, status: "paid" as const, paidAt: new Date().toISOString(), paidConfirmedBy: confirmedBy, paidConfirmedAt: new Date().toISOString(), paymentMethod: method, bankReferenceId: reference }
                            : p
                    ),
                })),

            /** Update payslip with server data (timestamps match DB, avoids write-through conflicts) */
            updatePayslipFromServer: (serverPayslip) =>
                set((s) => ({
                    payslips: s.payslips.map((p) =>
                        p.id === serverPayslip.id ? { ...p, ...serverPayslip } : p
                    ),
                })),

            getPayslipsByStatus: (status) => get().payslips.filter((p) => p.status === status),
            getSignedPayslips: () => get().payslips.filter((p) => !!p.signedAt),
            getUnsignedPublished: () => get().payslips.filter((p) => p.status === "published" && !p.signedAt),

            // ─── Payroll runs — draft → validated → locked → published → paid ─
            createDraftRun: (runDate, payslipIds, runType = "regular") =>
                set((s) => {
                    const existing = s.runs.find((r) => r.periodLabel === runDate);
                    if (existing) return {}; // already exists
                    const runId = `RUN-${runDate}`;
                    return {
                        runs: [
                            ...s.runs,
                            {
                                id: runId,
                                periodLabel: runDate,
                                createdAt: new Date().toISOString(),
                                status: "draft" as const,
                                locked: false,
                                payslipIds,
                                runType,
                            },
                        ],
                        payslips: s.payslips.map((p) =>
                            payslipIds.includes(p.id)
                                ? { ...p, payrollBatchId: runId }
                                : p
                        ),
                    };
                }),

            validateRun: (runDate) =>
                set((s) => {
                    const run = s.runs.find((r) => r.periodLabel === runDate);
                    if (!run || run.status !== "draft") return {};
                    return {
                        runs: s.runs.map((r) =>
                            r.periodLabel === runDate
                                ? { ...r, status: "validated" as const }
                                : r
                        ),
                    };
                }),

            lockRun: (runDate, lockedBy = "system") =>
                set((s) => {
                    const existingRun = s.runs.find((r) => r.periodLabel === runDate);
                    // If already locked, do nothing (immutable)
                    if (existingRun?.locked) return {};
                    // Collect payslipIds from existing run or from payslips matching the date
                    const runPayslipIds = existingRun?.payslipIds?.length
                        ? existingRun.payslipIds
                        : s.payslips.filter((p) => p.issuedAt === runDate).map((p) => p.id);
                    const snapshot = {
                        taxTableVersion: POLICY_VERSIONS.taxTable,
                        sssVersion: POLICY_VERSIONS.sss,
                        philhealthVersion: POLICY_VERSIONS.philhealth,
                        pagibigVersion: POLICY_VERSIONS.pagibig,
                        holidayListVersion: POLICY_VERSIONS.holidayList,
                        formulaVersion: "2026-PH-PAYROLL-v1",
                        ruleSetVersion: "RS-DEFAULT-v1",
                        lockedBy,
                    };
                    if (existingRun) {
                        // Only lock from validated (or draft for backward compat)
                        if (existingRun.status !== "validated" && existingRun.status !== "draft") return {};
                        return {
                            runs: s.runs.map((r) =>
                                r.id === existingRun.id
                                    ? { ...r, locked: true, status: "locked" as const, lockedAt: new Date().toISOString(), policySnapshot: snapshot }
                                    : r
                            ),
                        };
                    }
                    return {
                        runs: [
                            ...s.runs,
                            {
                                id: `RUN-${runDate}`,
                                periodLabel: runDate,
                                createdAt: new Date().toISOString(),
                                status: "locked" as const,
                                locked: true,
                                lockedAt: new Date().toISOString(),
                                payslipIds: runPayslipIds,
                                policySnapshot: snapshot,
                                runType: "regular",
                            },
                        ],
                    };
                }),

            publishRun: (runDate) =>
                set((s) => {
                    const run = s.runs.find((r) => r.periodLabel === runDate);
                    if (!run || !run.locked || run.status === "published" || run.status === "paid") return {};
                    const runPayslipIds = run.payslipIds ?? [];
                    return {
                        runs: s.runs.map((r) =>
                            r.periodLabel === runDate
                                ? { ...r, status: "published" as const, publishedAt: new Date().toISOString() }
                                : r
                        ),
                        // Auto-publish all confirmed payslips in this run
                        payslips: s.payslips.map((p) =>
                            runPayslipIds.includes(p.id) && p.status === "confirmed"
                                ? { ...p, status: "published" as const, publishedAt: new Date().toISOString() }
                                : p
                        ),
                    };
                }),

            markRunPaid: (runDate) =>
                set((s) => {
                    const run = s.runs.find((r) => r.periodLabel === runDate);
                    if (!run || run.status !== "published") return {};
                    return {
                        runs: s.runs.map((r) =>
                            r.periodLabel === runDate
                                ? { ...r, status: "paid" as const, paidAt: new Date().toISOString() }
                                : r
                        ),
                    };
                }),

            // ─── Adjustments ──────────────────────────────────────────
            createAdjustment: (data) =>
                set((s) => ({
                    adjustments: [
                        ...s.adjustments,
                        {
                            ...data,
                            id: `ADJ-${nanoid(8)}`,
                            status: "pending" as const,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                })),

            approveAdjustment: (adjustmentId, approverId) =>
                set((s) => ({
                    adjustments: s.adjustments.map((a) =>
                        a.id === adjustmentId && a.status === "pending"
                            ? { ...a, status: "approved" as const, approvedBy: approverId, approvedAt: new Date().toISOString() }
                            : a
                    ),
                })),

            rejectAdjustment: (adjustmentId, approverId) =>
                set((s) => ({
                    adjustments: s.adjustments.map((a) =>
                        a.id === adjustmentId && a.status === "pending"
                            ? { ...a, status: "rejected" as const, approvedBy: approverId, approvedAt: new Date().toISOString() }
                            : a
                    ),
                })),

            applyAdjustment: (adjustmentId, runId) =>
                set((s) => {
                    const adj = s.adjustments.find((a) => a.id === adjustmentId);
                    if (!adj || adj.status !== "approved") return {};
                    // Create an adjustment payslip
                    const origPayslip = s.payslips.find((p) => p.id === adj.referencePayslipId);
                    const adjPayslip: Payslip = {
                        id: `PS-ADJ-${nanoid(8)}`,
                        employeeId: adj.employeeId,
                        periodStart: origPayslip?.periodStart ?? new Date().toISOString().split("T")[0],
                        periodEnd: origPayslip?.periodEnd ?? new Date().toISOString().split("T")[0],
                        grossPay: adj.adjustmentType === "earnings" ? adj.amount : 0,
                        allowances: 0,
                        sssDeduction: adj.adjustmentType === "statutory_correction" && adj.amount < 0 ? Math.abs(adj.amount) : 0,
                        philhealthDeduction: 0,
                        pagibigDeduction: 0,
                        taxDeduction: 0,
                        otherDeductions: adj.adjustmentType === "deduction" ? Math.abs(adj.amount) : 0,
                        loanDeduction: 0,
                        netPay: adj.amount,
                        issuedAt: new Date().toISOString().split("T")[0],
                        status: "issued",
                        notes: `Payroll Adjustment — Prior Period (${adj.reason})`,
                        adjustmentRef: adj.id,
                    };
                    return {
                        adjustments: s.adjustments.map((a) =>
                            a.id === adjustmentId ? { ...a, status: "applied" as const, appliedRunId: runId } : a
                        ),
                        payslips: [...s.payslips, adjPayslip],
                    };
                }),

            // ─── Final Pay (§14) ───────────────────────────────────────
            computeFinalPay: (data) =>
                set((s) => {
                    const existing = s.finalPayComputations.find((f) => f.employeeId === data.employeeId);
                    if (existing) return {}; // already computed
                    const resignDate = new Date(data.resignedAt);
                    // Pro-rate salary for the CURRENT PARTIAL MONTH only (last payroll to resignation)
                    const daysInMonth = new Date(resignDate.getFullYear(), resignDate.getMonth() + 1, 0).getDate();
                    const daysWorkedInMonth = resignDate.getDate(); // day of month on resignation
                    const dailyRate = Math.round(data.salary / daysInMonth);
                    const proRatedSalary = Math.round(dailyRate * daysWorkedInMonth);
                    // Unpaid OT at 1.25x hourly rate
                    const hourlyRate = (data.salary * 12) / 2080;
                    const unpaidOT = Math.round(data.unpaidOTHours * hourlyRate * 1.25);
                    // Leave cash-out at daily rate
                    const leavePayout = Math.round(data.leaveDays * dailyRate);
                    const grossFinalPay = proRatedSalary + unpaidOT + leavePayout;
                    const deductions = data.loanBalance;
                    const netFinalPay = Math.max(0, grossFinalPay - deductions);

                    const comp: FinalPayComputation = {
                        id: `FP-${nanoid(8)}`,
                        employeeId: data.employeeId,
                        resignedAt: data.resignedAt,
                        proRatedSalary,
                        unpaidOT,
                        leavePayout,
                        remainingLoanBalance: data.loanBalance,
                        grossFinalPay,
                        deductions,
                        netFinalPay,
                        status: "draft",
                        createdAt: new Date().toISOString(),
                    };
                    return { finalPayComputations: [...s.finalPayComputations, comp] };
                }),

            getFinalPay: (employeeId) =>
                get().finalPayComputations.find((f) => f.employeeId === employeeId),

            // ─── Helpers ──────────────────────────────────────────────
            // 13th month = (total basic salary earned in the year) / 12
            // Pro-rated for mid-year joiners: only months worked count
            generate13thMonth: (employees) =>
                set((s) => {
                    const today = new Date().toISOString().split("T")[0];
                    const currentYear = new Date().getFullYear();
                    const newSlips: Payslip[] = employees.map((emp) => {
                        // Determine how many full months the employee worked this year
                        let monthsWorked = 12;
                        if (emp.joinDate) {
                            const join = new Date(emp.joinDate);
                            if (join.getFullYear() === currentYear) {
                                // Joined this year: count from join month to December (inclusive)
                                monthsWorked = 12 - join.getMonth(); // getMonth() is 0-based
                            } else if (join.getFullYear() > currentYear) {
                                monthsWorked = 0; // hasn't started yet
                            }
                        }
                        // 13th month pay = (monthly salary × months worked) / 12
                        const thirteenthPay = Math.round((emp.salary * monthsWorked) / 12);
                        return {
                            id: `PS-${nanoid(8)}`,
                            employeeId: emp.id,
                            periodStart: `${currentYear}-01-01`,
                            periodEnd: `${currentYear}-12-31`,
                            grossPay: thirteenthPay,
                            allowances: 0,
                            sssDeduction: 0,
                            philhealthDeduction: 0,
                            pagibigDeduction: 0,
                            taxDeduction: 0,   // 13th month is tax-exempt up to ₱90,000 (TRAIN Law)
                            otherDeductions: 0,
                            loanDeduction: 0,
                            netPay: thirteenthPay,
                            issuedAt: today,
                            status: "issued" as const,
                            notes: `13th Month Pay (${monthsWorked}/12 months)`,
                        };
                    }).filter((s) => s.netPay > 0);
                    return { payslips: [...s.payslips, ...newSlips] };
                }),

            getByEmployee: (employeeId) =>
                get().payslips.filter((p) => p.employeeId === employeeId),

            getPending: () => get().payslips.filter((p) => p.status === "issued"),

            exportBankFile: (runDate, employees) => {
                const state = get();
                const run = state.runs.find((r) => r.periodLabel === runDate);
                const runPayslipIds = run?.payslipIds ?? [];
                const runPayslips = state.payslips.filter((p) => runPayslipIds.includes(p.id));
                if (runPayslips.length === 0) return;
                const header = "Account Number,Employee Name,Net Pay,Payment Date,Reference ID";
                const rows = runPayslips.map((ps) => {
                    const emp = employees.find((e) => e.id === ps.employeeId);
                    return [
                        `EMP-BANK-${ps.employeeId}`,
                        emp?.name || ps.employeeId,
                        ps.netPay.toFixed(2),
                        ps.issuedAt,
                        ps.id,
                    ].join(",");
                });
                const csv = [header, ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `payroll-bank-${runDate}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            },

            resetToSeed: () =>
                set(() => ({
                    payslips: [],
                    runs: [],
                    adjustments: [],
                    finalPayComputations: [],
                    paySchedule: DEFAULT_PAY_SCHEDULE,
                })),

            clearAllPayroll: () =>
                set(() => ({
                    payslips: [],
                    runs: [],
                    adjustments: [],
                    finalPayComputations: [],
                })),
        }),
        {
            name: "soren-payroll",
            version: 7,
            migrate: () => ({
                payslips: [],
                runs: [],
                adjustments: [],
                finalPayComputations: [],
                paySchedule: DEFAULT_PAY_SCHEDULE,
            }),
        }
    )
);

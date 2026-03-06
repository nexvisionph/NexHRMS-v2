"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { LeaveRequest, LeaveStatus, LeavePolicy, LeaveBalance, LeaveType } from "@/types";
import { SEED_LEAVES } from "@/data/seed";

// ─── Default PH Leave Policies ───────────────────────────────
const DEFAULT_LEAVE_POLICIES: LeavePolicy[] = [
    {
        id: "LP-SL", leaveType: "SL", name: "Sick Leave",
        accrualFrequency: "annual", annualEntitlement: 5,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 5,
        expiryMonths: 12, negativeLeaveAllowed: false, attachmentRequired: false,
    },
    {
        id: "LP-VL", leaveType: "VL", name: "Vacation Leave",
        accrualFrequency: "annual", annualEntitlement: 5,
        carryForwardAllowed: true, maxCarryForward: 5, maxBalance: 10,
        expiryMonths: 24, negativeLeaveAllowed: false, attachmentRequired: false,
    },
    {
        id: "LP-EL", leaveType: "EL", name: "Emergency Leave",
        accrualFrequency: "annual", annualEntitlement: 3,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 3,
        expiryMonths: 12, negativeLeaveAllowed: true, attachmentRequired: true,
    },
    {
        id: "LP-OTH", leaveType: "OTHER", name: "Other Leave",
        accrualFrequency: "annual", annualEntitlement: 2,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 2,
        expiryMonths: 12, negativeLeaveAllowed: false, attachmentRequired: false,
    },
    {
        id: "LP-ML", leaveType: "ML", name: "Maternity Leave (RA 11210)",
        accrualFrequency: "annual", annualEntitlement: 105,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 105,
        expiryMonths: 12, negativeLeaveAllowed: false, attachmentRequired: true,
    },
    {
        id: "LP-PL", leaveType: "PL", name: "Paternity Leave (RA 8187)",
        accrualFrequency: "annual", annualEntitlement: 7,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 7,
        expiryMonths: 12, negativeLeaveAllowed: false, attachmentRequired: false,
    },
    {
        id: "LP-SPL", leaveType: "SPL", name: "Solo Parent Leave (RA 8972)",
        accrualFrequency: "annual", annualEntitlement: 7,
        carryForwardAllowed: false, maxCarryForward: 0, maxBalance: 7,
        expiryMonths: 12, negativeLeaveAllowed: false, attachmentRequired: true,
    },
];

interface LeaveState {
    requests: LeaveRequest[];
    policies: LeavePolicy[];
    balances: LeaveBalance[];

    // ─── Requests ─────────────────────────────────────
    addRequest: (req: Omit<LeaveRequest, "id" | "status">) => void;
    updateStatus: (id: string, status: LeaveStatus, reviewedBy: string) => void;
    getByEmployee: (employeeId: string) => LeaveRequest[];
    getPending: () => LeaveRequest[];

    // ─── Policies ─────────────────────────────────────
    addPolicy: (policy: Omit<LeavePolicy, "id">) => void;
    updatePolicy: (id: string, data: Partial<LeavePolicy>) => void;
    deletePolicy: (id: string) => void;
    getPolicy: (leaveType: LeaveType) => LeavePolicy | undefined;

    // ─── Balances ─────────────────────────────────────
    initBalances: (employeeId: string, year: number) => void;
    getBalance: (employeeId: string, leaveType: LeaveType, year: number) => LeaveBalance | undefined;
    getEmployeeBalances: (employeeId: string, year: number) => LeaveBalance[];
    accrueLeave: (employeeId: string, leaveType: LeaveType, year: number, days: number) => void;

    // ─── Conflict detection ───────────────────────────
    hasLeaveConflict: (employeeId: string, date: string) => boolean;
    resetToSeed: () => void;
}

export const useLeaveStore = create<LeaveState>()(
    persist(
        (set, get) => ({
            requests: SEED_LEAVES,
            policies: DEFAULT_LEAVE_POLICIES,
            balances: [],

            // ─── Requests ─────────────────────────────────────────────
            addRequest: (req) => {
                const policy = get().policies.find((p) => p.leaveType === req.type);
                // Check balance
                const year = new Date(req.startDate).getFullYear();
                const bal = get().balances.find(
                    (b) => b.employeeId === req.employeeId && b.leaveType === req.type && b.year === year
                );
                const startD = new Date(req.startDate);
                const endD = new Date(req.endDate);
                const days = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                if (bal && bal.remaining < days && !(policy?.negativeLeaveAllowed)) {
                    // Insufficient balance — still create but it will be noted
                }

                set((s) => ({
                    requests: [
                        ...s.requests,
                        {
                            ...req,
                            id: `LV-${nanoid(8)}`,
                            status: "pending",
                        },
                    ],
                }));
            },

            updateStatus: (id, status, reviewedBy) =>
                set((s) => {
                    const req = s.requests.find((r) => r.id === id);
                    if (!req) return {};
                    const updatedRequests = s.requests.map((r) =>
                        r.id === id
                            ? { ...r, status, reviewedBy, reviewedAt: new Date().toISOString().split("T")[0] }
                            : r
                    );

                    const year = new Date(req.startDate).getFullYear();
                    const days = Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

                    // If approving, deduct from balance
                    if (status === "approved" && req.status !== "approved") {
                        return {
                            requests: updatedRequests,
                            balances: s.balances.map((b) =>
                                b.employeeId === req.employeeId && b.leaveType === req.type && b.year === year
                                    ? { ...b, used: b.used + days, remaining: b.remaining - days }
                                    : b
                            ),
                        };
                    }

                    // If rejecting a previously approved leave, credit the balance back
                    if (status === "rejected" && req.status === "approved") {
                        return {
                            requests: updatedRequests,
                            balances: s.balances.map((b) =>
                                b.employeeId === req.employeeId && b.leaveType === req.type && b.year === year
                                    ? { ...b, used: Math.max(0, b.used - days), remaining: b.remaining + days }
                                    : b
                            ),
                        };
                    }

                    return { requests: updatedRequests };
                }),

            getByEmployee: (employeeId) =>
                get().requests.filter((r) => r.employeeId === employeeId),
            getPending: () => get().requests.filter((r) => r.status === "pending"),

            // ─── Policies ─────────────────────────────────────────────
            addPolicy: (policy) =>
                set((s) => ({
                    policies: [...s.policies, { ...policy, id: `LP-${nanoid(6)}` }],
                })),

            updatePolicy: (id, data) =>
                set((s) => ({
                    policies: s.policies.map((p) => (p.id === id ? { ...p, ...data } : p)),
                })),

            deletePolicy: (id) =>
                set((s) => ({ policies: s.policies.filter((p) => p.id !== id) })),

            getPolicy: (leaveType) =>
                get().policies.find((p) => p.leaveType === leaveType),

            // ─── Balances ─────────────────────────────────────────────
            initBalances: (employeeId, year) =>
                set((s) => {
                    const existing = s.balances.filter(
                        (b) => b.employeeId === employeeId && b.year === year
                    );
                    if (existing.length > 0) return {}; // already initialized
                    const newBalances: LeaveBalance[] = s.policies.map((p) => {
                        // Carry forward from previous year
                        const prevBal = s.balances.find(
                            (b) => b.employeeId === employeeId && b.leaveType === p.leaveType && b.year === year - 1
                        );
                        const carried = p.carryForwardAllowed && prevBal
                            ? Math.min(prevBal.remaining, p.maxCarryForward)
                            : 0;
                        return {
                            id: `BAL-${nanoid(8)}`,
                            employeeId,
                            leaveType: p.leaveType,
                            year,
                            entitled: p.annualEntitlement,
                            used: 0,
                            carriedForward: carried,
                            remaining: p.annualEntitlement + carried,
                        };
                    });
                    return { balances: [...s.balances, ...newBalances] };
                }),

            getBalance: (employeeId, leaveType, year) =>
                get().balances.find(
                    (b) => b.employeeId === employeeId && b.leaveType === leaveType && b.year === year
                ),

            getEmployeeBalances: (employeeId, year) =>
                get().balances.filter((b) => b.employeeId === employeeId && b.year === year),

            accrueLeave: (employeeId, leaveType, year, days) =>
                set((s) => ({
                    balances: s.balances.map((b) =>
                        b.employeeId === employeeId && b.leaveType === leaveType && b.year === year
                            ? {
                                ...b,
                                entitled: b.entitled + days,
                                remaining: b.remaining + days,
                                lastAccruedAt: new Date().toISOString(),
                            }
                            : b
                    ),
                })),

            // ─── Conflict detection (§9 — clock-in on approved leave day) ─
            hasLeaveConflict: (employeeId, date) => {
                return get().requests.some((r) => {
                    if (r.employeeId !== employeeId || r.status !== "approved") return false;
                    return date >= r.startDate && date <= r.endDate;
                });
            },
            resetToSeed: () => set({ requests: SEED_LEAVES, balances: [] }),
        }),
        {
            name: "nexhrms-leave",
            version: 3,
            migrate: () => ({ requests: SEED_LEAVES, balances: [] }),
        }
    )
);

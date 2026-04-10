"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Timesheet, TimesheetSegment, AttendanceRuleSet, TimesheetStatus } from "@/types";

interface TimesheetState {
    timesheets: Timesheet[];
    ruleSets: AttendanceRuleSet[];

    // ─── Rule Sets ────────────────────────────────────
    addRuleSet: (data: Omit<AttendanceRuleSet, "id">) => void;
    updateRuleSet: (id: string, data: Partial<AttendanceRuleSet>) => void;
    deleteRuleSet: (id: string) => void;
    getRuleSet: (id: string) => AttendanceRuleSet | undefined;

    // ─── Timesheet computation ────────────────────────
    computeTimesheet: (data: {
        employeeId: string;
        date: string;
        ruleSetId: string;
        shiftId?: string;
        checkIn: string; // "HH:mm"
        checkOut: string;
        shiftStart: string;
        shiftEnd: string;
        breakDuration: number;
    }) => void;

    // ─── Approval (supervisor must approve before payroll) ─
    submitTimesheet: (id: string) => void;
    approveTimesheet: (id: string, approverId: string) => void;
    rejectTimesheet: (id: string, approverId: string) => void;

    // ─── Queries ──────────────────────────────────────
    getByEmployee: (employeeId: string) => Timesheet[];
    getByDate: (date: string) => Timesheet[];
    getApproved: (employeeId: string, periodStart: string, periodEnd: string) => Timesheet[];
    getPendingApproval: () => Timesheet[];
    resetToSeed: () => void;
}

const DEFAULT_RULE_SET: AttendanceRuleSet = {
    id: "RS-DEFAULT",
    name: "Standard PH Rule Set",
    standardHoursPerDay: 8,
    graceMinutes: 10,
    roundingPolicy: "nearest_15",
    overtimeRequiresApproval: true,
    nightDiffStart: "22:00",
    nightDiffEnd: "06:00",
    holidayMultiplier: 2.0,
};

function parseTime(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function roundMinutes(mins: number, policy: string): number {
    if (policy === "nearest_15") return Math.round(mins / 15) * 15;
    if (policy === "nearest_30") return Math.round(mins / 30) * 30;
    return Math.round(mins);
}

/**
 * Calculate minutes worked inside the night differential window (22:00–06:00).
 * Both inMin and outMin must already be normalized so outMin >= inMin
 * (overnight shifts will have outMin > 1440).
 */
function calcNightDiffMinutes(
    inMin: number,
    outMin: number,
    ndStartMin: number,  // e.g. 1320 (22:00)
    ndEndMin: number,    // e.g.  360 (06:00 next day)
): number {
    // Segment A: ndStart → midnight  (e.g. 22:00–00:00)
    const aOverlap = Math.max(0, Math.min(outMin, 1440) - Math.max(inMin, ndStartMin));
    // Segment B: midnight → ndEnd next day (e.g. 00:00–06:00)
    const bOverlap = Math.max(0, Math.min(outMin, 1440 + ndEndMin) - Math.max(inMin, 1440));
    return aOverlap + bOverlap;
}

export const useTimesheetStore = create<TimesheetState>()(
    persist(
        (set, get) => ({
            timesheets: [],
            ruleSets: [DEFAULT_RULE_SET],

            addRuleSet: (data) =>
                set((s) => ({
                    ruleSets: [...s.ruleSets, { ...data, id: `RS-${nanoid(8)}` }],
                })),

            updateRuleSet: (id, data) =>
                set((s) => ({
                    ruleSets: s.ruleSets.map((r) => (r.id === id ? { ...r, ...data } : r)),
                })),

            deleteRuleSet: (id) =>
                set((s) => ({
                    ruleSets: s.ruleSets.filter((r) => r.id !== id),
                })),

            getRuleSet: (id) => get().ruleSets.find((r) => r.id === id),

            computeTimesheet: (data) =>
                set((s) => {
                    const ruleSet = s.ruleSets.find((r) => r.id === data.ruleSetId) || DEFAULT_RULE_SET;
                    const inMin = parseTime(data.checkIn);
                    let outMin = parseTime(data.checkOut);
                    const shiftStartMin = parseTime(data.shiftStart);
                    let shiftEndMin = parseTime(data.shiftEnd);

                    // ── Overnight normalization ─────────────────────────────
                    // If the shift end is before or equal to shift start it crosses midnight
                    if (shiftEndMin <= shiftStartMin) shiftEndMin += 1440;
                    // If checkout is at or before checkin it crossed midnight
                    if (outMin <= inMin) outMin += 1440;

                    const stdHoursMin = ruleSet.standardHoursPerDay * 60;

                    // ── Worked minutes (net of break, rounded) ──────────────
                    const rawWorkedMin = Math.max(0, outMin - inMin - data.breakDuration);
                    const workedMin = roundMinutes(rawWorkedMin, ruleSet.roundingPolicy);

                    // ── Late minutes ────────────────────────────────────────
                    const rawLate = inMin - shiftStartMin;
                    const lateMinutes = rawLate > ruleSet.graceMinutes ? Math.round(rawLate) : 0;

                    // ── Undertime: how many minutes before shift end did they leave ──
                    const undertimeMinutes = outMin < shiftEndMin
                        ? Math.round(shiftEndMin - outMin)
                        : 0;

                    // ── Regular vs overtime ─────────────────────────────────
                    const regularMin = Math.min(workedMin, stdHoursMin);
                    const overtimeMin = Math.max(0, workedMin - stdHoursMin);

                    // ── Night differential (correct overnight window) ────────
                    let nightDiffMin = 0;
                    if (ruleSet.nightDiffStart && ruleSet.nightDiffEnd) {
                        nightDiffMin = calcNightDiffMinutes(
                            inMin, outMin,
                            parseTime(ruleSet.nightDiffStart),
                            parseTime(ruleSet.nightDiffEnd),
                        );
                    }

                    // ── Build segments ──────────────────────────────────────
                    const segments: TimesheetSegment[] = [];
                    if (regularMin > 0) {
                        segments.push({
                            id: `SEG-${nanoid(6)}`, timesheetId: "", segmentType: "regular",
                            startTime: data.checkIn, endTime: data.shiftEnd,
                            hours: Math.round((regularMin / 60) * 100) / 100, multiplier: 1.0,
                        });
                    }
                    if (overtimeMin > 0) {
                        segments.push({
                            id: `SEG-${nanoid(6)}`, timesheetId: "", segmentType: "overtime",
                            startTime: data.shiftEnd, endTime: data.checkOut,
                            hours: Math.round((overtimeMin / 60) * 100) / 100, multiplier: 1.25,
                        });
                    }
                    if (nightDiffMin > 0) {
                        segments.push({
                            id: `SEG-${nanoid(6)}`, timesheetId: "", segmentType: "night_diff",
                            startTime: ruleSet.nightDiffStart!, endTime: ruleSet.nightDiffEnd!,
                            hours: Math.round((nightDiffMin / 60) * 100) / 100, multiplier: 1.1,
                        });
                    }

                    const tsId = `TS-${nanoid(8)}`;
                    const ts: Timesheet = {
                        id: tsId,
                        employeeId: data.employeeId,
                        date: data.date,
                        ruleSetId: data.ruleSetId,
                        shiftId: data.shiftId,
                        regularHours: Math.round((regularMin / 60) * 100) / 100,
                        overtimeHours: Math.round((overtimeMin / 60) * 100) / 100,
                        nightDiffHours: Math.round((nightDiffMin / 60) * 100) / 100,
                        totalHours: Math.round((workedMin / 60) * 100) / 100,
                        lateMinutes,
                        undertimeMinutes,
                        segments: segments.map((seg) => ({ ...seg, timesheetId: tsId })),
                        status: "computed",
                        computedAt: new Date().toISOString(),
                    };

                    // Replace existing for same employee+date if still in computed status
                    const existing = s.timesheets.find(
                        (t) => t.employeeId === data.employeeId && t.date === data.date
                    );
                    if (existing && existing.status === "computed") {
                        return { timesheets: s.timesheets.map((t) => (t.id === existing.id ? ts : t)) };
                    }
                    return { timesheets: [...s.timesheets, ts] };
                }),

            submitTimesheet: (id) =>
                set((s) => ({
                    timesheets: s.timesheets.map((t) =>
                        t.id === id && t.status === "computed"
                            ? { ...t, status: "submitted" as TimesheetStatus }
                            : t
                    ),
                })),

            approveTimesheet: (id, approverId) =>
                set((s) => ({
                    timesheets: s.timesheets.map((t) =>
                        t.id === id && t.status === "submitted"
                            ? { ...t, status: "approved" as TimesheetStatus, approvedBy: approverId, approvedAt: new Date().toISOString() }
                            : t
                    ),
                })),

            rejectTimesheet: (id, approverId) =>
                set((s) => ({
                    timesheets: s.timesheets.map((t) =>
                        t.id === id && t.status === "submitted"
                            ? { ...t, status: "rejected" as TimesheetStatus, approvedBy: approverId, approvedAt: new Date().toISOString() }
                            : t
                    ),
                })),

            getByEmployee: (employeeId) =>
                get().timesheets.filter((t) => t.employeeId === employeeId),

            getByDate: (date) =>
                get().timesheets.filter((t) => t.date === date),

            getApproved: (employeeId, periodStart, periodEnd) =>
                get().timesheets.filter(
                    (t) => t.employeeId === employeeId && t.status === "approved" && t.date >= periodStart && t.date <= periodEnd
                ),

            getPendingApproval: () =>
                get().timesheets.filter((t) => t.status === "submitted"),
            resetToSeed: () => set({ timesheets: [] }),
        }),
        { name: "nexhrms-timesheet", version: 1 }
    )
);

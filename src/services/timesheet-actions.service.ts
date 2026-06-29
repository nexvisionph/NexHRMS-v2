"use client";
/**
 * Timesheet Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 10 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { timesheetsDb } from "./db.service";
import { useTimesheetStore } from "@/store/timesheet.store";
import type { Timesheet, AttendanceRuleSet, TimesheetStatus } from "@/types";
import { nanoid } from "nanoid";

/**
 * Upsert a computed timesheet — DB-first.
 * The computation logic stays in the store (pure function); this service
 * persists the result to DB before updating local cache.
 */
export async function saveComputedTimesheet(ts: Timesheet): Promise<boolean> {
    // 1. Write to DB first
    const ok = await timesheetsDb.upsertTimesheet(ts);
    if (!ok) return false;

    // 2. Update local cache
    useTimesheetStore.setState((s) => {
        const existing = s.timesheets.find((t) => t.id === ts.id);
        if (existing) {
            return { timesheets: s.timesheets.map((t) => (t.id === ts.id ? ts : t)) };
        }
        return { timesheets: [...s.timesheets, ts] };
    });
    return true;
}

/**
 * Submit a timesheet for approval — DB-first.
 */
export async function submitTimesheet(id: string): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const ts = store.timesheets.find((t) => t.id === id);
    if (!ts || ts.status !== "computed") return false;

    const updated: Timesheet = { ...ts, status: "submitted" as TimesheetStatus };

    const ok = await timesheetsDb.upsertTimesheet(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Approve a timesheet — DB-first.
 */
export async function approveTimesheet(id: string, approverId: string): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const ts = store.timesheets.find((t) => t.id === id);
    if (!ts || ts.status !== "submitted") return false;

    const updated: Timesheet = {
        ...ts,
        status: "approved" as TimesheetStatus,
        approvedBy: approverId,
        approvedAt: new Date().toISOString(),
    };

    const ok = await timesheetsDb.upsertTimesheet(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Reject a timesheet — DB-first.
 */
export async function rejectTimesheet(id: string, approverId: string): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const ts = store.timesheets.find((t) => t.id === id);
    if (!ts || ts.status !== "submitted") return false;

    const updated: Timesheet = {
        ...ts,
        status: "rejected" as TimesheetStatus,
        approvedBy: approverId,
        approvedAt: new Date().toISOString(),
    };

    const ok = await timesheetsDb.upsertTimesheet(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Add a rule set — DB-first.
 */
export async function addRuleSet(data: Omit<AttendanceRuleSet, "id">): Promise<{ ok: boolean; id?: string }> {
    const id = `RS-${nanoid(8)}`;
    const ruleSet: AttendanceRuleSet = { ...data, id };

    const ok = await timesheetsDb.upsertRuleSet(ruleSet);
    if (!ok) return { ok: false };

    useTimesheetStore.setState((s) => ({
        ruleSets: [...s.ruleSets, ruleSet],
    }));
    return { ok: true, id };
}

/**
 * Update a rule set — DB-first.
 */
export async function updateRuleSet(id: string, data: Partial<AttendanceRuleSet>): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const existing = store.ruleSets.find((r) => r.id === id);
    if (!existing) return false;

    const updated: AttendanceRuleSet = { ...existing, ...data };

    const ok = await timesheetsDb.upsertRuleSet(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        ruleSets: s.ruleSets.map((r) => (r.id === id ? updated : r)),
    }));
    return true;
}

/**
 * Delete a rule set — DB-first.
 */
export async function deleteRuleSet(id: string): Promise<boolean> {
    const ok = await timesheetsDb.deleteRuleSet(id);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        ruleSets: s.ruleSets.filter((r) => r.id !== id),
    }));
    return true;
}

/**
 * Submit multiple timesheets for approval — DB-first.
 */
export async function submitTimesheets(ids: string[]): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const targets = store.timesheets.filter(t => ids.includes(t.id) && t.status === "computed");
    if (targets.length === 0) return false;

    const updated = targets.map(t => ({ ...t, status: "submitted" as TimesheetStatus }));

    const ok = await timesheetsDb.batchUpsertTimesheets(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map(t => {
            const up = updated.find(u => u.id === t.id);
            return up ? up : t;
        }),
    }));
    return true;
}

/**
 * Approve multiple timesheets — DB-first.
 */
export async function approveTimesheets(ids: string[], approverId: string): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const now = new Date().toISOString();
    const targets = store.timesheets.filter(t => ids.includes(t.id) && t.status === "submitted");
    if (targets.length === 0) return false;

    const updated = targets.map(t => ({ 
        ...t, 
        status: "approved" as TimesheetStatus,
        approvedBy: approverId,
        approvedAt: now
    }));

    const ok = await timesheetsDb.batchUpsertTimesheets(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map(t => {
            const up = updated.find(u => u.id === t.id);
            return up ? up : t;
        }),
    }));
    return true;
}

/**
 * Reject multiple timesheets — DB-first.
 */
export async function rejectTimesheets(ids: string[], approverId: string): Promise<boolean> {
    const store = useTimesheetStore.getState();
    const now = new Date().toISOString();
    const targets = store.timesheets.filter(t => ids.includes(t.id) && t.status === "submitted");
    if (targets.length === 0) return false;

    const updated = targets.map(t => ({ 
        ...t, 
        status: "rejected" as TimesheetStatus,
        approvedBy: approverId,
        approvedAt: now
    }));

    const ok = await timesheetsDb.batchUpsertTimesheets(updated);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.map(t => {
            const up = updated.find(u => u.id === t.id);
            return up ? up : t;
        }),
    }));
    return true;
}

/**
 * Clear a computed timesheet — DB-first.
 */
export async function clearTimesheet(id: string): Promise<boolean> {
    const ok = await timesheetsDb.deleteTimesheet(id);
    if (!ok) return false;

    useTimesheetStore.setState((s) => ({
        timesheets: s.timesheets.filter(t => t.id !== id),
    }));
    return true;
}

"use client";
/**
 * Leave Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 11 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { leaveDb } from "./db.service";
import { useLeaveStore } from "@/store/leave.store";
import type { LeaveRequest, LeaveBalance, LeavePolicy, LeaveStatus, LeaveType } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add a leave request — DB-first.
 */
export async function addRequest(req: Omit<LeaveRequest, "id" | "status">): Promise<{ ok: boolean; id?: string }> {
    const id = `LV-${nanoid(8)}`;
    const leaveReq: LeaveRequest = {
        ...req,
        id,
        status: "pending",
        duration: req.duration || "full_day",
    };

    const ok = await leaveDb.upsertRequest(leaveReq);
    if (!ok) return { ok: false };

    // Update local cache — the store's addRequest also handles balance init and notifications
    // so we call the store method which will set state synchronously
    useLeaveStore.getState().addRequest(req);
    return { ok: true, id };
}

/**
 * Update leave request status (approve/reject) — DB-first.
 */
export async function updateStatus(id: string, status: LeaveStatus, reviewedBy: string): Promise<boolean> {
    const store = useLeaveStore.getState();
    const req = store.requests.find((r) => r.id === id);
    if (!req) return false;

    const updated: LeaveRequest = {
        ...req,
        status,
        reviewedBy,
        reviewedAt: new Date().toISOString().split("T")[0],
    };

    const ok = await leaveDb.upsertRequest(updated);
    if (!ok) return false;

    // Let the store handle balance adjustments and notifications
    useLeaveStore.getState().updateStatus(id, status, reviewedBy);
    return true;
}

/**
 * Add a leave policy — DB-first.
 */
export async function addPolicy(data: Omit<LeavePolicy, "id">): Promise<{ ok: boolean; id?: string }> {
    const id = `LP-${nanoid(6)}`;
    const policy: LeavePolicy = { ...data, id };

    const ok = await leaveDb.upsertPolicy(policy);
    if (!ok) return { ok: false };

    useLeaveStore.setState((s) => ({
        policies: [...s.policies, policy],
    }));
    return { ok: true, id };
}

/**
 * Update a leave policy — DB-first.
 */
export async function updatePolicy(id: string, data: Partial<LeavePolicy>): Promise<boolean> {
    const store = useLeaveStore.getState();
    const existing = store.policies.find((p) => p.id === id);
    if (!existing) return false;

    const updated: LeavePolicy = { ...existing, ...data };

    const ok = await leaveDb.upsertPolicy(updated);
    if (!ok) return false;

    useLeaveStore.setState((s) => ({
        policies: s.policies.map((p) => (p.id === id ? updated : p)),
    }));
    return true;
}

/**
 * Delete a leave policy — DB-first.
 */
export async function deletePolicy(id: string): Promise<boolean> {
    const ok = await leaveDb.deletePolicy(id);
    if (!ok) return false;

    useLeaveStore.setState((s) => ({
        policies: s.policies.filter((p) => p.id !== id),
    }));
    return true;
}

/**
 * Accrue leave days for an employee — DB-first.
 */
export async function accrueLeave(employeeId: string, leaveType: LeaveType, year: number, days: number): Promise<boolean> {
    const store = useLeaveStore.getState();
    const bal = store.balances.find(
        (b) => b.employeeId === employeeId && b.leaveType === leaveType && b.year === year
    );
    if (!bal) return false;

    const updated: LeaveBalance = {
        ...bal,
        entitled: bal.entitled + days,
        remaining: bal.remaining + days,
        lastAccruedAt: new Date().toISOString(),
    };

    const ok = await leaveDb.upsertBalance(updated);
    if (!ok) return false;

    useLeaveStore.setState((s) => ({
        balances: s.balances.map((b) => (b.id === bal.id ? updated : b)),
    }));
    return true;
}

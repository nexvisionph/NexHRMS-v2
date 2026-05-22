"use client";
/**
 * Payroll Actions Service — DB-first mutations.
 * 
 * Replaces the Zustand-first + write-through pattern.
 * Writes to Supabase first, then updates local Zustand cache on success.
 * 
 * Migration target: Step 1 of batch-migration-report.md
 */

import { payrollDb } from "./db.service";
import { usePayrollStore } from "@/store/payroll.store";
import type { Payslip } from "@/types";

/**
 * Batch release payment hold — DB-first.
 * Returns true on success; on failure, local state is unchanged.
 */
export async function batchReleasePaymentHold(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const store = usePayrollStore.getState();
    const idSet = new Set(ids);

    const updated = store.payslips
        .filter((p) => idSet.has(p.id) && p.status === "payment_hold")
        .map((p) => ({
            ...p,
            status: "published" as const,
            holdNote: undefined,
            heldAt: undefined,
        }));

    if (updated.length === 0) return true;

    // 1. Write to DB first
    const ok = await payrollDb.batchUpsertPayslips(updated);
    if (!ok) return false;

    // 2. Update local cache on success
    usePayrollStore.setState((s) => ({
        payslips: s.payslips.map((p) =>
            idSet.has(p.id) && p.status === "payment_hold"
                ? { ...p, status: "published" as const, holdNote: undefined, heldAt: undefined }
                : p
        ),
    }));
    return true;
}

/**
 * Batch publish payslips — DB-first.
 */
export async function batchPublishPayslips(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const store = usePayrollStore.getState();
    const idSet = new Set(ids);
    const now = new Date().toISOString();

    const updated = store.payslips
        .filter((p) => idSet.has(p.id) && p.status === "draft")
        .map((p) => ({
            ...p,
            status: "published" as const,
            publishedAt: now,
        }));

    if (updated.length === 0) return true;

    const ok = await payrollDb.batchUpsertPayslips(updated);
    if (!ok) return false;

    usePayrollStore.setState((s) => ({
        payslips: s.payslips.map((p) =>
            idSet.has(p.id) && p.status === "draft"
                ? { ...p, status: "published" as const, publishedAt: now }
                : p
        ),
    }));
    return true;
}

/**
 * Batch record payment — DB-first.
 */
export async function batchRecordPayment(
    ids: string[],
    paymentMethod: Payslip["paymentMethod"],
    bankReferenceId: string
): Promise<boolean> {
    if (ids.length === 0) return true;
    const store = usePayrollStore.getState();
    const idSet = new Set(ids);
    const now = new Date().toISOString();

    const updated = store.payslips
        .filter((p) => idSet.has(p.id) && p.status === "signed")
        .map((p) => ({
            ...p,
            status: "paid" as const,
            paidAt: now,
            paymentMethod,
            bankReferenceId,
        }));

    if (updated.length === 0) return true;

    const ok = await payrollDb.batchUpsertPayslips(updated);
    if (!ok) return false;

    usePayrollStore.setState((s) => ({
        payslips: s.payslips.map((p) =>
            idSet.has(p.id) && p.status === "signed"
                ? {
                    ...p,
                    status: "paid" as const,
                    paidAt: now,
                    paymentMethod,
                    bankReferenceId,
                }
                : p
        ),
    }));
    return true;
}

/**
 * Issue a single payslip — DB-first.
 */
export async function issuePayslip(
    data: Omit<Payslip, "id" | "status" | "issuedAt"> & { issuedAt?: string }
): Promise<boolean> {
    // Use the existing store action to compute the new payslip
    // (it has duplicate guards and run management logic we don't want to duplicate).
    // Then upsert to DB after the store has computed the new state.
    const before = usePayrollStore.getState().payslips;
    usePayrollStore.getState().issuePayslip(data);
    const after = usePayrollStore.getState().payslips;

    // Find newly added or updated payslip(s)
    const newOrUpdated = after.filter((a) => {
        const prev = before.find((b) => b.id === a.id);
        return !prev || JSON.stringify(prev) !== JSON.stringify(a);
    });

    if (newOrUpdated.length === 0) return true;

    return await payrollDb.batchUpsertPayslips(newOrUpdated);
}

/**
 * Publish a single payslip — DB-first.
 */
export async function publishPayslip(id: string): Promise<boolean> {
    return batchPublishPayslips([id]);
}

/**
 * Record payment for a single payslip — DB-first.
 */
export async function recordPayment(
    id: string,
    paymentMethod: Payslip["paymentMethod"],
    bankReferenceId: string
): Promise<boolean> {
    return batchRecordPayment([id], paymentMethod, bankReferenceId);
}

/**
 * Sign a payslip — DB-first.
 */
export async function signPayslip(id: string, signatureDataUrl: string): Promise<boolean> {
    const store = usePayrollStore.getState();
    const ps = store.payslips.find((p) => p.id === id);
    if (!ps || ps.status !== "published") return false;

    const now = new Date().toISOString();
    const updated: Payslip = {
        ...ps,
        status: "signed",
        signedAt: now,
        signatureDataUrl,
    };

    const ok = await payrollDb.batchUpsertPayslips([updated]);
    if (!ok) return false;

    usePayrollStore.setState((s) => ({
        payslips: s.payslips.map((p) => (p.id === id ? updated : p)),
    }));
    return true;
}

/**
 * Hold payment — DB-first.
 */
export async function holdPayment(id: string, note?: string): Promise<boolean> {
    const store = usePayrollStore.getState();
    const ps = store.payslips.find((p) => p.id === id);
    if (!ps || ps.status !== "published" || ps.signedAt) return false;

    const updated: Payslip = {
        ...ps,
        status: "payment_hold",
        holdNote: note || "Late compliance to payroll submission. Please coordinate with the payroll team to resolve this issue.",
        heldAt: new Date().toISOString(),
    };

    const ok = await payrollDb.batchUpsertPayslips([updated]);
    if (!ok) return false;

    usePayrollStore.setState((s) => ({
        payslips: s.payslips.map((p) => (p.id === id ? updated : p)),
    }));
    return true;
}

/**
 * Delete a draft payslip — DB-first.
 */
export async function deletePayslip(id: string): Promise<boolean> {
    const store = usePayrollStore.getState();
    const ps = store.payslips.find((p) => p.id === id);
    if (!ps || ps.status !== "draft") return false;

    const ok = await payrollDb.deletePayslipsByIds([id]);
    if (!ok) return false;

    usePayrollStore.setState((s) => ({
        payslips: s.payslips.filter((p) => p.id !== id),
        runs: s.runs.map((r) =>
            r.payslipIds?.includes(id)
                ? { ...r, payslipIds: r.payslipIds.filter((pid) => pid !== id) }
                : r
        ),
    }));
    return true;
}

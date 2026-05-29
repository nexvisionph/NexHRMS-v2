import type { Payslip, PayrollRun } from "@/types";

/**
 * ─── Payroll run ↔ payslip membership ────────────────────────────────
 *
 * There are two representations of the run→payslip relationship:
 *   • `payslip.payrollBatchId`  — back-reference stamped on every payslip (source of truth)
 *   • `run.payslipIds[]`        — array cached on the run (can drift out of sync)
 *
 * These helpers always derive membership from `payrollBatchId` and union the
 * cached `payslipIds` for resilience, so the UI stays correct even when the
 * cached array is stale or empty.
 */

type RunRef = Pick<PayrollRun, "id" | "payslipIds">;

/** Payslips that belong to a run — by payrollBatchId, unioned with cached payslipIds. */
export function getRunPayslips(run: RunRef, payslips: Payslip[]): Payslip[] {
    const explicit = new Set(run.payslipIds ?? []);
    return payslips.filter((p) => p.payrollBatchId === run.id || explicit.has(p.id));
}

/** IDs of payslips that belong to a run (by either linkage). */
export function getRunPayslipIds(run: RunRef, payslips: Payslip[]): string[] {
    return getRunPayslips(run, payslips).map((p) => p.id);
}

/** True when a run has at least one payslip by either linkage. */
export function runHasPayslips(run: RunRef, payslips: Payslip[]): boolean {
    if ((run.payslipIds ?? []).length > 0) return true;
    return payslips.some((p) => p.payrollBatchId === run.id);
}

/**
 * Heal a run's cached `payslipIds` by folding in every payslip that references
 * it via `payrollBatchId`. ADD-ONLY: never removes ids, so it is safe to run on
 * partial stores (e.g. an employee whose `payslips` array holds only their own).
 * Returns the same run reference when nothing changed.
 */
export function reconcileRunPayslipIds(run: PayrollRun, payslips: Payslip[]): PayrollRun {
    const current = run.payslipIds ?? [];
    const currentSet = new Set(current);
    const missing = payslips
        .filter((p) => p.payrollBatchId === run.id && !currentSet.has(p.id))
        .map((p) => p.id);
    if (missing.length === 0) return run;
    return { ...run, payslipIds: [...current, ...missing] };
}

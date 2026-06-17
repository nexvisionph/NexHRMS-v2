"use client";

/**
 * TanStack Query hook for Payroll data.
 *
 * Covers all payroll entity types:
 *   1. Payslips
 *   2. Payroll runs
 *   3. Payroll adjustments
 *   4. Final pay computations
 *   5. Pay schedule config
 *   6. Deduction overrides (per-employee)
 *   7. Global deduction defaults
 *   8. Signature config
 *
 * Lifecycle mutations:
 *   - issuePayslip, publishPayslip, signPayslip, holdPayment, releaseHold
 *   - createDraftRun, lockRun, unlockRun, endRun, markRunPaid
 *   - createAdjustment, approveAdjustment, applyAdjustment
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type {
    Payslip, PayrollRun, PayrollAdjustment, PayScheduleConfig,
    FinalPayComputation, PayrollSignatureConfig,
    DeductionOverride, DeductionGlobalDefault, DeductionType,
} from "@/types";
import { payrollDb } from "@/services/db.service";

// ─── Query Keys ──────────────────────────────────────────────

export const PAYSLIPS_KEY = ["payslips"] as const;
export const PAYROLL_RUNS_KEY = ["payroll-runs"] as const;
export const PAYROLL_ADJUSTMENTS_KEY = ["payroll-adjustments"] as const;
export const FINAL_PAY_KEY = ["final-pay"] as const;
export const PAY_SCHEDULE_KEY = ["pay-schedule"] as const;
export const DEDUCTION_OVERRIDES_KEY = ["deduction-overrides"] as const;
export const GLOBAL_DEFAULTS_KEY = ["global-defaults"] as const;
export const SIGNATURE_CONFIG_KEY = ["signature-config"] as const;

/** Umbrella key for batch invalidation */
export const PAYROLL_QUERY_KEY = ["payroll"] as const;

// ─── Default pay schedule (same as original store) ───────────

import { DEFAULT_PAY_SCHEDULE, DEFAULT_SIGNATURE_CONFIG } from "@/store/payroll.store";

// ─── Individual Query Hooks ──────────────────────────────────

export function usePayslipsQuery() {
    return useQuery({
        queryKey: PAYSLIPS_KEY,
        queryFn: () => payrollDb.fetchPayslips(),
        staleTime: 60 * 1000,
    });
}

export function usePayrollRunsQuery() {
    return useQuery({
        queryKey: PAYROLL_RUNS_KEY,
        queryFn: () => payrollDb.fetchRuns(),
        staleTime: 60 * 1000,
    });
}

export function usePayrollAdjustmentsQuery() {
    return useQuery({
        queryKey: PAYROLL_ADJUSTMENTS_KEY,
        queryFn: () => payrollDb.fetchAdjustments(),
        staleTime: 2 * 60 * 1000,
    });
}

export function useFinalPayQuery() {
    return useQuery({
        queryKey: FINAL_PAY_KEY,
        queryFn: () => payrollDb.fetchFinalPay(),
        staleTime: 5 * 60 * 1000,
    });
}

export function usePayScheduleQuery() {
    return useQuery({
        queryKey: PAY_SCHEDULE_KEY,
        queryFn: async (): Promise<PayScheduleConfig> => {
            const rows = await payrollDb.fetchPaySchedule();
            return rows.length > 0 ? rows[0] : DEFAULT_PAY_SCHEDULE;
        },
        staleTime: 5 * 60 * 1000,
        initialData: DEFAULT_PAY_SCHEDULE,
    });
}

export function useDeductionOverridesQuery() {
    return useQuery({
        queryKey: DEDUCTION_OVERRIDES_KEY,
        queryFn: () => payrollDb.fetchDeductionOverrides(),
        staleTime: 2 * 60 * 1000,
    });
}

export function useGlobalDefaultsQuery() {
    return useQuery({
        queryKey: GLOBAL_DEFAULTS_KEY,
        queryFn: async (): Promise<DeductionGlobalDefault[]> => {
            const rows = await payrollDb.fetchGlobalDefaults();
            if (rows.length > 0) return rows;
            return [
                { deductionType: "sss" as DeductionType, enabled: true, mode: "auto" as const },
                { deductionType: "philhealth" as DeductionType, enabled: true, mode: "auto" as const },
                { deductionType: "pagibig" as DeductionType, enabled: true, mode: "auto" as const },
                { deductionType: "bir" as DeductionType, enabled: true, mode: "auto" as const },
            ];
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useSignatureConfigQuery() {
    return useQuery({
        queryKey: SIGNATURE_CONFIG_KEY,
        queryFn: async (): Promise<PayrollSignatureConfig> => {
            const config = await payrollDb.fetchSignatureConfig();
            return config ?? DEFAULT_SIGNATURE_CONFIG;
        },
        staleTime: 5 * 60 * 1000,
        initialData: DEFAULT_SIGNATURE_CONFIG,
    });
}

// ─── Payslip Mutations ───────────────────────────────────────

export function useUpsertPayslipMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payslip: Payslip) => {
            const ok = await payrollDb.upsertPayslip(payslip);
            if (!ok) throw new Error("Failed to upsert payslip");
            return payslip;
        },
        onSuccess: (payslip) => {
            queryClient.setQueryData<Payslip[]>(PAYSLIPS_KEY, (prev) => {
                const existing = (prev ?? []).find((p) => p.id === payslip.id);
                if (existing) return (prev ?? []).map((p) => p.id === payslip.id ? payslip : p);
                return [...(prev ?? []), payslip];
            });
        },
    });
}

export function useBatchUpsertPayslipsMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payslips: Payslip[]) => {
            const ok = await payrollDb.batchUpsertPayslips(payslips);
            if (!ok) throw new Error("Failed to batch upsert payslips");
            return payslips;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PAYSLIPS_KEY });
        },
    });
}

export function useUpdatePayslipMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, patch }: { id: string; patch: Partial<Payslip> }) => {
            const ok = await payrollDb.updatePayslip(id, patch);
            if (!ok) throw new Error("Failed to update payslip");
            return { id, patch };
        },
        onSuccess: ({ id, patch }) => {
            queryClient.setQueryData<Payslip[]>(PAYSLIPS_KEY, (prev) =>
                (prev ?? []).map((p) => p.id === id ? { ...p, ...patch } : p)
            );
        },
    });
}

export function useDeletePayslipsMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids: string[]) => {
            const ok = await payrollDb.deletePayslipsByIds(ids);
            if (!ok) throw new Error("Failed to delete payslips");
            return ids;
        },
        onSuccess: (ids) => {
            const idSet = new Set(ids);
            queryClient.setQueryData<Payslip[]>(PAYSLIPS_KEY, (prev) =>
                (prev ?? []).filter((p) => !idSet.has(p.id))
            );
        },
    });
}

// ─── Payroll Run Mutations ───────────────────────────────────

export function useUpsertRunMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (run: PayrollRun) => {
            const ok = await payrollDb.upsertRun(run);
            if (!ok) throw new Error("Failed to upsert payroll run");
            return run;
        },
        onSuccess: (run) => {
            queryClient.setQueryData<PayrollRun[]>(PAYROLL_RUNS_KEY, (prev) => {
                const existing = (prev ?? []).find((r) => r.id === run.id);
                if (existing) return (prev ?? []).map((r) => r.id === run.id ? run : r);
                return [...(prev ?? []), run];
            });
        },
    });
}

export function useDeleteRunsMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids: string[]) => {
            const ok = await payrollDb.deleteRunsByIds(ids);
            if (!ok) throw new Error("Failed to delete runs");
            return ids;
        },
        onSuccess: (ids) => {
            const idSet = new Set(ids);
            queryClient.setQueryData<PayrollRun[]>(PAYROLL_RUNS_KEY, (prev) =>
                (prev ?? []).filter((r) => !idSet.has(r.id))
            );
        },
    });
}

// ─── Adjustment Mutations ────────────────────────────────────

export function useUpsertAdjustmentMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (adj: PayrollAdjustment) => {
            const ok = await payrollDb.upsertAdjustment(adj);
            if (!ok) throw new Error("Failed to upsert adjustment");
            return adj;
        },
        onSuccess: (adj) => {
            queryClient.setQueryData<PayrollAdjustment[]>(PAYROLL_ADJUSTMENTS_KEY, (prev) => {
                const existing = (prev ?? []).find((a) => a.id === adj.id);
                if (existing) return (prev ?? []).map((a) => a.id === adj.id ? adj : a);
                return [...(prev ?? []), adj];
            });
        },
    });
}

// ─── Final Pay Mutations ─────────────────────────────────────

export function useUpsertFinalPayMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (fp: FinalPayComputation) => {
            const ok = await payrollDb.upsertFinalPay(fp);
            if (!ok) throw new Error("Failed to upsert final pay");
            return fp;
        },
        onSuccess: (fp) => {
            queryClient.setQueryData<FinalPayComputation[]>(FINAL_PAY_KEY, (prev) => {
                const existing = (prev ?? []).find((f) => f.id === fp.id);
                if (existing) return (prev ?? []).map((f) => f.id === fp.id ? fp : f);
                return [...(prev ?? []), fp];
            });
        },
    });
}

// ─── Pay Schedule Mutation ───────────────────────────────────

export function useUpdatePayScheduleMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (config: PayScheduleConfig) => {
            const ok = await payrollDb.upsertPaySchedule({ id: "default", ...config });
            if (!ok) throw new Error("Failed to update pay schedule");
            return config;
        },
        onSuccess: (config) => {
            queryClient.setQueryData<PayScheduleConfig>(PAY_SCHEDULE_KEY, config);
        },
    });
}

// ─── Deduction Override Mutations ────────────────────────────

export function useUpsertDeductionOverrideMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (override: DeductionOverride) => {
            const ok = await payrollDb.upsertDeductionOverride(override);
            if (!ok) throw new Error("Failed to upsert deduction override");
            return override;
        },
        onSuccess: (override) => {
            queryClient.setQueryData<DeductionOverride[]>(DEDUCTION_OVERRIDES_KEY, (prev) => {
                const existing = (prev ?? []).find(
                    (d) => d.employeeId === override.employeeId && d.deductionType === override.deductionType
                );
                if (existing) return (prev ?? []).map((d) =>
                    d.employeeId === override.employeeId && d.deductionType === override.deductionType ? override : d
                );
                return [...(prev ?? []), override];
            });
        },
    });
}

export function useDeleteDeductionOverrideMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ employeeId, deductionType }: { employeeId: string; deductionType: string }) => {
            const ok = await payrollDb.deleteDeductionOverride(employeeId, deductionType);
            if (!ok) throw new Error("Failed to delete deduction override");
            return { employeeId, deductionType };
        },
        onSuccess: ({ employeeId, deductionType }) => {
            queryClient.setQueryData<DeductionOverride[]>(DEDUCTION_OVERRIDES_KEY, (prev) =>
                (prev ?? []).filter((d) => !(d.employeeId === employeeId && d.deductionType === deductionType))
            );
        },
    });
}

// ─── Global Defaults Mutation ────────────────────────────────

export function useUpdateGlobalDefaultMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (config: DeductionGlobalDefault) => {
            const ok = await payrollDb.upsertGlobalDefault(config as unknown as Record<string, unknown>);
            if (!ok) throw new Error("Failed to update global default");
            return config;
        },
        onSuccess: (config) => {
            queryClient.setQueryData<DeductionGlobalDefault[]>(GLOBAL_DEFAULTS_KEY, (prev) => {
                const existing = (prev ?? []).find((d) => d.deductionType === config.deductionType);
                if (existing) return (prev ?? []).map((d) => d.deductionType === config.deductionType ? config : d);
                return [...(prev ?? []), config];
            });
        },
    });
}

// ─── Signature Config Mutation ───────────────────────────────

export function useUpdateSignatureConfigMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (config: PayrollSignatureConfig) => {
            const ok = await payrollDb.upsertSignatureConfig(config);
            if (!ok) throw new Error("Failed to update signature config");
            return config;
        },
        onSuccess: (config) => {
            queryClient.setQueryData<PayrollSignatureConfig>(SIGNATURE_CONFIG_KEY, config);
        },
    });
}

// ─── Reset All Mutation ──────────────────────────────────────

export function useResetPayrollMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            await payrollDb.resetAllPayrollData();
        },
        onSuccess: () => {
            queryClient.setQueryData(PAYSLIPS_KEY, []);
            queryClient.setQueryData(PAYROLL_RUNS_KEY, []);
            queryClient.setQueryData(PAYROLL_ADJUSTMENTS_KEY, []);
            queryClient.setQueryData(FINAL_PAY_KEY, []);
            queryClient.setQueryData(PAY_SCHEDULE_KEY, DEFAULT_PAY_SCHEDULE);
            queryClient.setQueryData(DEDUCTION_OVERRIDES_KEY, []);
            queryClient.setQueryData(SIGNATURE_CONFIG_KEY, DEFAULT_SIGNATURE_CONFIG);
        },
    });
}

// ─── Composite Hook (matches original store data shape) ──────

export interface PayrollHookState {
    payslips: Payslip[];
    runs: PayrollRun[];
    adjustments: PayrollAdjustment[];
    finalPayComputations: FinalPayComputation[];
    paySchedule: PayScheduleConfig;
    signatureConfig: PayrollSignatureConfig;
    deductionOverrides: DeductionOverride[];
    globalDefaults: DeductionGlobalDefault[];
    isLoading: boolean;
}

/**
 * Unified hook that merges all payroll queries into a single state object.
 * Matches the data shape of the original usePayrollStore for compatibility.
 */
export function usePayrollData(): PayrollHookState {
    const { data: payslips = [], isLoading: psLoading } = usePayslipsQuery();
    const { data: runs = [], isLoading: runsLoading } = usePayrollRunsQuery();
    const { data: adjustments = [] } = usePayrollAdjustmentsQuery();
    const { data: finalPayComputations = [] } = useFinalPayQuery();
    const { data: paySchedule = DEFAULT_PAY_SCHEDULE } = usePayScheduleQuery();
    const { data: signatureConfig = DEFAULT_SIGNATURE_CONFIG } = useSignatureConfigQuery();
    const { data: deductionOverrides = [] } = useDeductionOverridesQuery();
    const { data: globalDefaults = [] } = useGlobalDefaultsQuery();

    const isLoading = psLoading || runsLoading;

    return useMemo(() => ({
        payslips,
        runs,
        adjustments,
        finalPayComputations,
        paySchedule,
        signatureConfig,
        deductionOverrides,
        globalDefaults,
        isLoading,
    }), [payslips, runs, adjustments, finalPayComputations, paySchedule, signatureConfig, deductionOverrides, globalDefaults, isLoading]);
}

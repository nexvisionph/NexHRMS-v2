"use client";

/**
 * Store ↔ Query Cache Bridge
 *
 * Syncs data from Zustand stores → TanStack Query cache so that:
 * 1. sync.service.ts hydration still populates Zustand stores (unchanged)
 * 2. New TanStack Query hooks can read from the query cache
 * 3. Realtime updates via sync.service still reach components using either pattern
 *
 * This bridge is a TEMPORARY measure during migration. It will be removed
 * once sync.service is fully disconnected (Steps 6-10).
 *
 * Usage: Call <StoreQueryBridge /> once inside the QueryProvider tree.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { usePayrollStore } from "@/store/payroll.store";

// Import query keys
import { EMPLOYEES_QUERY_KEY, SALARY_REQUESTS_QUERY_KEY, SALARY_HISTORY_QUERY_KEY } from "@/hooks/use-employees";
import {
    ATTENDANCE_LOGS_KEY, ATTENDANCE_EVENTS_KEY, HOLIDAYS_KEY, SHIFTS_KEY,
    OVERTIME_REQUESTS_KEY, ATTENDANCE_EXCEPTIONS_KEY, PENALTIES_KEY,
    ATTENDANCE_EVIDENCE_KEY, EMPLOYEE_SHIFTS_KEY,
} from "@/hooks/use-attendance";
import {
    PAYSLIPS_KEY, PAYROLL_RUNS_KEY, PAYROLL_ADJUSTMENTS_KEY,
    FINAL_PAY_KEY, PAY_SCHEDULE_KEY, DEDUCTION_OVERRIDES_KEY,
    GLOBAL_DEFAULTS_KEY, SIGNATURE_CONFIG_KEY,
} from "@/hooks/use-payroll";

/**
 * Component that bridges Zustand store state into the TanStack Query cache.
 * Mount this once inside the QueryProvider + authenticated layout.
 */
export function StoreQueryBridge() {
    const queryClient = useQueryClient();

    // ─── Employees bridge ────────────────────────────────────
    useEffect(() => {
        // Initial sync
        const empState = useEmployeesStore.getState();
        queryClient.setQueryData(EMPLOYEES_QUERY_KEY, empState.employees);
        queryClient.setQueryData(SALARY_REQUESTS_QUERY_KEY, empState.salaryRequests);
        queryClient.setQueryData(SALARY_HISTORY_QUERY_KEY, empState.salaryHistory);

        // Subscribe to changes
        const unsub = useEmployeesStore.subscribe((state, prevState) => {
            if (state.employees !== prevState.employees) {
                queryClient.setQueryData(EMPLOYEES_QUERY_KEY, state.employees);
            }
            if (state.salaryRequests !== prevState.salaryRequests) {
                queryClient.setQueryData(SALARY_REQUESTS_QUERY_KEY, state.salaryRequests);
            }
            if (state.salaryHistory !== prevState.salaryHistory) {
                queryClient.setQueryData(SALARY_HISTORY_QUERY_KEY, state.salaryHistory);
            }
        });
        return unsub;
    }, [queryClient]);

    // ─── Attendance bridge ───────────────────────────────────
    useEffect(() => {
        const attState = useAttendanceStore.getState();
        queryClient.setQueryData(ATTENDANCE_LOGS_KEY, attState.logs);
        queryClient.setQueryData(ATTENDANCE_EVENTS_KEY, attState.events);
        queryClient.setQueryData(HOLIDAYS_KEY, attState.holidays);
        queryClient.setQueryData(SHIFTS_KEY, attState.shiftTemplates);
        queryClient.setQueryData(OVERTIME_REQUESTS_KEY, attState.overtimeRequests);
        queryClient.setQueryData(ATTENDANCE_EXCEPTIONS_KEY, attState.exceptions);
        queryClient.setQueryData(PENALTIES_KEY, attState.penalties);
        queryClient.setQueryData(ATTENDANCE_EVIDENCE_KEY, attState.evidence);
        queryClient.setQueryData(EMPLOYEE_SHIFTS_KEY, attState.employeeShifts);

        const unsub = useAttendanceStore.subscribe((state, prevState) => {
            if (state.logs !== prevState.logs) queryClient.setQueryData(ATTENDANCE_LOGS_KEY, state.logs);
            if (state.events !== prevState.events) queryClient.setQueryData(ATTENDANCE_EVENTS_KEY, state.events);
            if (state.holidays !== prevState.holidays) queryClient.setQueryData(HOLIDAYS_KEY, state.holidays);
            if (state.shiftTemplates !== prevState.shiftTemplates) queryClient.setQueryData(SHIFTS_KEY, state.shiftTemplates);
            if (state.overtimeRequests !== prevState.overtimeRequests) queryClient.setQueryData(OVERTIME_REQUESTS_KEY, state.overtimeRequests);
            if (state.exceptions !== prevState.exceptions) queryClient.setQueryData(ATTENDANCE_EXCEPTIONS_KEY, state.exceptions);
            if (state.penalties !== prevState.penalties) queryClient.setQueryData(PENALTIES_KEY, state.penalties);
            if (state.evidence !== prevState.evidence) queryClient.setQueryData(ATTENDANCE_EVIDENCE_KEY, state.evidence);
            if (state.employeeShifts !== prevState.employeeShifts) queryClient.setQueryData(EMPLOYEE_SHIFTS_KEY, state.employeeShifts);
        });
        return unsub;
    }, [queryClient]);

    // ─── Payroll bridge ──────────────────────────────────────
    useEffect(() => {
        const payState = usePayrollStore.getState();
        queryClient.setQueryData(PAYSLIPS_KEY, payState.payslips);
        queryClient.setQueryData(PAYROLL_RUNS_KEY, payState.runs);
        queryClient.setQueryData(PAYROLL_ADJUSTMENTS_KEY, payState.adjustments);
        queryClient.setQueryData(FINAL_PAY_KEY, payState.finalPayComputations);
        queryClient.setQueryData(PAY_SCHEDULE_KEY, payState.paySchedule);
        queryClient.setQueryData(DEDUCTION_OVERRIDES_KEY, payState.deductionOverrides);
        queryClient.setQueryData(GLOBAL_DEFAULTS_KEY, payState.globalDefaults);
        queryClient.setQueryData(SIGNATURE_CONFIG_KEY, payState.signatureConfig);

        const unsub = usePayrollStore.subscribe((state, prevState) => {
            if (state.payslips !== prevState.payslips) queryClient.setQueryData(PAYSLIPS_KEY, state.payslips);
            if (state.runs !== prevState.runs) queryClient.setQueryData(PAYROLL_RUNS_KEY, state.runs);
            if (state.adjustments !== prevState.adjustments) queryClient.setQueryData(PAYROLL_ADJUSTMENTS_KEY, state.adjustments);
            if (state.finalPayComputations !== prevState.finalPayComputations) queryClient.setQueryData(FINAL_PAY_KEY, state.finalPayComputations);
            if (state.paySchedule !== prevState.paySchedule) queryClient.setQueryData(PAY_SCHEDULE_KEY, state.paySchedule);
            if (state.deductionOverrides !== prevState.deductionOverrides) queryClient.setQueryData(DEDUCTION_OVERRIDES_KEY, state.deductionOverrides);
            if (state.globalDefaults !== prevState.globalDefaults) queryClient.setQueryData(GLOBAL_DEFAULTS_KEY, state.globalDefaults);
            if (state.signatureConfig !== prevState.signatureConfig) queryClient.setQueryData(SIGNATURE_CONFIG_KEY, state.signatureConfig);
        });
        return unsub;
    }, [queryClient]);

    return null;
}

"use client";

/**
 * Payroll Backfill Service
 *
 * Orchestrates the backfill workflow:
 * 1. Fetches attendance logs for a date range from the store/DB
 * 2. Fetches holidays
 * 3. Calls the computation engine for each detected cycle
 * 4. Creates payslip + payroll run entries using existing infrastructure
 * 5. Persists via payrollDb
 *
 * This is a parallel path to the existing `handleIssue` in admin-view.
 * It does NOT modify existing attendance records or overwrite existing payroll runs.
 */

import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { payrollDb } from "./db.service";
import { computePayroll, detectCycles, type ComputePayrollParams, type PayrollCycle } from "@/lib/payroll-computation-engine";
import { computeAllPHDeductions } from "@/lib/ph-deductions";
import { DEFAULT_HOLIDAYS } from "@/lib/constants";
import type { Employee, ComputedPayroll, Holiday, AttendanceLog, Payslip, PayrollRun } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackfillRequest {
  employeeIds: string[];
  startDate: string;
  endDate: string;
  computeWorkDays?: number; // defaults to 21.5
}

export interface BackfillCycleResult {
  cycle: PayrollCycle;
  computed: ComputedPayroll;
  status: "success" | "skipped_duplicate" | "error";
  error?: string;
}

export interface BackfillResult {
  employeeId: string;
  employeeName: string;
  cycles: BackfillCycleResult[];
  totalIssued: number;
  totalSkipped: number;
  totalErrors: number;
}

// ─── Preview (dry-run without persisting) ────────────────────────────────────

export function previewBackfill(request: BackfillRequest): BackfillResult[] {
  const { employeeIds, startDate, endDate, computeWorkDays = 21.5 } = request;
  const employees = useEmployeesStore.getState().employees;
  const logs = useAttendanceStore.getState().logs;
  const storeHolidays = useAttendanceStore.getState().holidays;
  // Merge store holidays with DEFAULT_HOLIDAYS (constants) — ensure PH holidays are always available
  const holidayDates = new Set(storeHolidays.map(h => h.date));
  const fallbackHolidays = DEFAULT_HOLIDAYS
    .filter(h => !holidayDates.has(h.date))
    .map((h, i) => ({ id: `DEFAULT-${i}`, ...h }));
  const holidays = [...storeHolidays, ...fallbackHolidays] as Holiday[];
  const payslips = usePayrollStore.getState().payslips;

  const cycles = detectCycles(startDate, endDate);
  const results: BackfillResult[] = [];

  for (const empId of employeeIds) {
    const employee = employees.find((e) => e.id === empId);
    if (!employee) continue;

    const cycleResults: BackfillCycleResult[] = [];
    let totalIssued = 0;
    let totalSkipped = 0;

    for (const cycle of cycles) {
      // Check for existing payslip (duplicate guard)
      const existing = payslips.find(
        (p) => p.employeeId === empId && p.periodStart === cycle.periodStart && p.periodEnd === cycle.periodEnd
      );
      if (existing) {
        cycleResults.push({ cycle, computed: {} as ComputedPayroll, status: "skipped_duplicate" });
        totalSkipped++;
        continue;
      }

      // Compute deductions
      const deductions = computeDeductionsForEmployee(employee);

      // Filter logs for this employee in this cycle
      const periodLogs = logs.filter(
        (l) => l.employeeId === empId && l.date >= cycle.periodStart && l.date <= cycle.periodEnd
      );

      // Run computation engine
      const computed = computePayroll({
        employee,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        attendanceLogs: periodLogs,
        holidays,
        deductions,
        computeWorkDays,
      });

      cycleResults.push({ cycle, computed, status: "success" });
      totalIssued++;
    }

    results.push({
      employeeId: empId,
      employeeName: employee.name,
      cycles: cycleResults,
      totalIssued,
      totalSkipped,
      totalErrors: 0,
    });
  }

  return results;
}

// ─── Execute Backfill (persist to store + DB) ────────────────────────────────

export async function executeBackfill(request: BackfillRequest): Promise<BackfillResult[]> {
  const { employeeIds, startDate, endDate, computeWorkDays = 21.5 } = request;
  const employees = useEmployeesStore.getState().employees;
  const logs = useAttendanceStore.getState().logs;
  const storeHolidays = useAttendanceStore.getState().holidays;
  // Merge store holidays with DEFAULT_HOLIDAYS — ensure PH holidays are always recognized
  const holidayDates = new Set(storeHolidays.map(h => h.date));
  const fallbackHolidays = DEFAULT_HOLIDAYS
    .filter(h => !holidayDates.has(h.date))
    .map((h, i) => ({ id: `DEFAULT-${i}`, ...h }));
  const holidays = [...storeHolidays, ...fallbackHolidays] as Holiday[];
  const payslips = usePayrollStore.getState().payslips;
  const { issuePayslip } = usePayrollStore.getState();

  const cycles = detectCycles(startDate, endDate);
  const results: BackfillResult[] = [];

  for (const empId of employeeIds) {
    const employee = employees.find((e) => e.id === empId);
    if (!employee) continue;

    const cycleResults: BackfillCycleResult[] = [];
    let totalIssued = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const cycle of cycles) {
      // Check for existing payslip (duplicate guard)
      const existing = usePayrollStore.getState().payslips.find(
        (p) => p.employeeId === empId && p.periodStart === cycle.periodStart && p.periodEnd === cycle.periodEnd
      );
      if (existing) {
        cycleResults.push({ cycle, computed: {} as ComputedPayroll, status: "skipped_duplicate" });
        totalSkipped++;
        continue;
      }

      try {
        // Compute deductions
        const deductions = computeDeductionsForEmployee(employee);

        // Filter logs for this employee in this cycle
        const periodLogs = logs.filter(
          (l) => l.employeeId === empId && l.date >= cycle.periodStart && l.date <= cycle.periodEnd
        );

        // Run computation engine
        const computed = computePayroll({
          employee,
          periodStart: cycle.periodStart,
          periodEnd: cycle.periodEnd,
          attendanceLogs: periodLogs,
          holidays,
          deductions,
          computeWorkDays,
        });

        // Issue payslip using existing infrastructure
        issuePayslip({
          employeeId: computed.employeeId,
          periodStart: computed.periodStart,
          periodEnd: computed.periodEnd,
          payFrequency: "semi_monthly",
          grossPay: computed.totalBasic,
          allowances: 0,
          sssDeduction: computed.sss,
          philhealthDeduction: computed.philhealth,
          pagibigDeduction: computed.pagibig,
          taxDeduction: computed.withholdingTax,
          otherDeductions: computed.otherDeductions,
          loanDeduction: 0,
          netPay: computed.netPay,
          overtimePay: computed.totalOtPay,
          dailyRate: computed.ratePerDay,
          hourlyRate: computed.ratePerHour,
          absentDeduction: computed.absentDeduction,
          undertimeDeduction: computed.undertimeDeduction,
          attendanceDaysAbsent: computed.absentDays,
          attendanceDaysPresent: computed.daysPresent,
          attendanceUndertimeHours: computed.undertimeHours,
          dtrPerDayJson: computed.dailyBreakdown,
          dtrDaysPresent: computed.daysPresent,
          dtrDaysAbsent: computed.absentDays,
          dtrOtHours: computed.regOtHours + computed.satOtHours + (computed.regOtMinutes + computed.satOtMinutes) / 60,
          source: "system",
          computedExternally: false,
          regOtHours: computed.regOtHours,
          regOtMinutes: computed.regOtMinutes,
          satOtHours: computed.satOtHours,
          satOtMinutes: computed.satOtMinutes,
          computeSource: "attendance_engine",
          computeWorkDays: computeWorkDays,
          notes: `Computed by engine (work_days=${computeWorkDays}, basic=${computed.totalBasic}, OT=${computed.totalOtPay})`,
        });

        cycleResults.push({ cycle, computed, status: "success" });
        totalIssued++;
      } catch (err) {
        cycleResults.push({
          cycle,
          computed: {} as ComputedPayroll,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        totalErrors++;
      }
    }

    results.push({
      employeeId: empId,
      employeeName: employee.name,
      cycles: cycleResults,
      totalIssued,
      totalSkipped,
      totalErrors,
    });
  }

  // Persist all new payslips and runs to DB
  try {
    const currentState = usePayrollStore.getState();
    const allNewPayslips = currentState.payslips.filter(
      (p) => p.computeSource === "attendance_engine"
    );
    if (allNewPayslips.length > 0) {
      await payrollDb.batchUpsertPayslips(allNewPayslips);
    }
    // Persist runs
    const allRuns = currentState.runs;
    for (const run of allRuns) {
      await payrollDb.upsertRun(run);
    }
  } catch (err) {
    console.error("[payroll-backfill] DB persist failed:", err);
  }

  return results;
}

// ─── Helper: Compute Deductions for Employee ─────────────────────────────────

function computeDeductionsForEmployee(employee: Employee) {
  if (employee.deductionExempt) {
    return { tax: 0, sss: 0, philhealth: 0, pagibig: 0, loans: 0, other: 0 };
  }

  const store = usePayrollStore.getState();

  // Only use per-employee overrides. If no override is configured for this
  // specific employee, default to 0. Do NOT apply global/system defaults —
  // deductions must come from the employee's own configured values only.
  const computeDeduction = (type: "sss" | "philhealth" | "pagibig" | "bir"): number => {
    const override = store.getDeductionOverride(employee.id, type);

    // No per-employee override → zero
    if (!override) return 0;

    if (override.mode === "exempt") return 0;
    if (override.mode === "auto") {
      // Employee has explicitly set "auto" — use standard PH calc
      const phDeductions = computeAllPHDeductions(employee.salary);
      const autoValues: Record<string, number> = {
        sss: phDeductions.sss,
        philhealth: phDeductions.philHealth,
        pagibig: phDeductions.pagIBIG,
        bir: phDeductions.withholdingTax,
      };
      return Math.round(autoValues[type] || 0);
    }
    if (override.mode === "percentage" && override.percentage !== undefined) {
      return Math.round(employee.salary * (override.percentage / 100));
    }
    if (override.mode === "fixed" && override.fixedAmount !== undefined) {
      return Math.round(override.fixedAmount);
    }
    return 0;
  };

  return {
    tax: computeDeduction("bir"),
    sss: computeDeduction("sss"),
    philhealth: computeDeduction("philhealth"),
    pagibig: computeDeduction("pagibig"),
    loans: 0,
    other: 0,
  };
}

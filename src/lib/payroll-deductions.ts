/**
 * Pure payroll deduction & overtime computations.
 *
 * Single source of truth used by BOTH the client store (payroll.store.ts) and
 * the server-side payslip API. Keeping this module pure (no I/O, no React, no
 * Zustand) lets us unit-test every formula in isolation and reuse it everywhere.
 *
 * All money values are returned rounded to 2 decimal places (centavos).
 * All inputs are expected to be non-negative; defensive guards return 0 for
 * invalid inputs rather than throwing — payroll must never crash on bad data.
 */

// ─── Rounding ──────────────────────────────────────────────────────────────

/** Round to 2 decimal places (banker-safe via toFixed). */
export function round2(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

// ─── Rate computations ────────────────────────────────────────────────────

/**
 * Compute daily rate from monthly salary.
 *  daily_rate = monthly_salary / work_days_per_month
 */
export function computeDailyRate(monthlySalary: number, workDaysPerMonth: number): number {
  if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) return 0;
  if (!Number.isFinite(workDaysPerMonth) || workDaysPerMonth <= 0) return 0;
  return round2(monthlySalary / workDaysPerMonth);
}

/**
 * Compute hourly rate from daily rate.
 *  hourly_rate = daily_rate / standard_hours_per_day
 */
export function computeHourlyRate(dailyRate: number, standardHoursPerDay: number): number {
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) return 0;
  if (!Number.isFinite(standardHoursPerDay) || standardHoursPerDay <= 0) return 0;
  return round2(dailyRate / standardHoursPerDay);
}

// ─── Deduction computations ───────────────────────────────────────────────

/**
 * Late-arrival deduction.
 *  deduction = (lateMinutes / 60) * hourly_rate
 *
 * NOTE: Grace-period subtraction is assumed to have already been applied
 * upstream (timesheet engine), so `lateMinutes` here is the effective
 * (post-grace) value.
 */
export function computeLateDeduction(lateMinutes: number, hourlyRate: number): number {
  if (!Number.isFinite(lateMinutes) || lateMinutes <= 0) return 0;
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return 0;
  return round2((lateMinutes / 60) * hourlyRate);
}

/**
 * Absent-day deduction.
 *  deduction = absentDays * daily_rate
 */
export function computeAbsentDeduction(absentDays: number, dailyRate: number): number {
  if (!Number.isFinite(absentDays) || absentDays <= 0) return 0;
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) return 0;
  return round2(absentDays * dailyRate);
}

/**
 * Undertime deduction (early-out / short-shift).
 *  deduction = max(0, shiftHours - actualHours) * hourly_rate
 *
 * Critical guard: if the employee worked the full shift OR overtime,
 * undertime is 0 (NOT negative). Negative undertime would otherwise
 * silently inflate net pay.
 */
export function computeUndertimeDeduction(
  shiftHours: number,
  actualHours: number,
  hourlyRate: number,
): number {
  if (!Number.isFinite(shiftHours) || shiftHours <= 0) return 0;
  if (!Number.isFinite(actualHours) || actualHours < 0) return 0;
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return 0;
  if (actualHours >= shiftHours) return 0; // worked full shift or OT — no undertime
  const shortHours = shiftHours - actualHours;
  return round2(shortHours * hourlyRate);
}

// ─── Overtime computations ────────────────────────────────────────────────

export type OvertimeKind =
  | "regular"
  | "rest_day"
  | "special_holiday"
  | "regular_holiday"
  | "night_diff";

export interface OvertimeMultipliers {
  otMultiplierRegular: number;
  otMultiplierRestDay: number;
  otMultiplierSpecialHoliday: number;
  otMultiplierRegularHoliday: number;
  otMultiplierNightDiff: number;
}

/** Pick the multiplier that matches the OT kind. */
export function pickMultiplier(kind: OvertimeKind, m: OvertimeMultipliers): number {
  switch (kind) {
    case "regular":         return m.otMultiplierRegular;
    case "rest_day":        return m.otMultiplierRestDay;
    case "special_holiday": return m.otMultiplierSpecialHoliday;
    case "regular_holiday": return m.otMultiplierRegularHoliday;
    case "night_diff":      return m.otMultiplierNightDiff;
    default:                return m.otMultiplierRegular;
  }
}

/**
 * OT pay for a single approved OT request.
 *  pay = otHours * hourly_rate * multiplier
 */
export function computeOvertimeEarnings(
  otHours: number,
  hourlyRate: number,
  multiplier: number,
): number {
  if (!Number.isFinite(otHours) || otHours <= 0) return 0;
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return 0;
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 0;
  return round2(otHours * hourlyRate * multiplier);
}

// ─── Aggregator ───────────────────────────────────────────────────────────

export interface DeductionInputs {
  /** Auto-deduction toggles from PayScheduleConfig */
  autoDeductLate: boolean;
  autoDeductAbsent: boolean;
  autoDeductUndertime: boolean;
  autoAddOvertime: boolean;
  /** Snapshot rates */
  dailyRate: number;
  hourlyRate: number;
  /** Attendance aggregates for the period */
  lateMinutes: number;
  absentDays: number;
  shiftHours: number;
  actualHours: number;
  /** Approved OT entries (already filtered by period & status=approved) */
  overtimeEntries: Array<{ hours: number; kind: OvertimeKind }>;
  /** OT multipliers from active rule set */
  multipliers: OvertimeMultipliers;
}

export interface DeductionBreakdown {
  lateDeduction: number;
  absentDeduction: number;
  undertimeDeduction: number;
  overtimePay: number;
  totalDeductions: number; // sum of the three deductions only (NOT net of OT)
}

/**
 * Compute the full per-payslip deduction & OT breakdown in one call.
 * Each line is gated by its respective auto-* toggle; when disabled, the line
 * is set to 0 so manual adjustments can take its place.
 */
export function buildPayslipDeductions(input: DeductionInputs): DeductionBreakdown {
  const lateDeduction = input.autoDeductLate
    ? computeLateDeduction(input.lateMinutes, input.hourlyRate)
    : 0;

  const absentDeduction = input.autoDeductAbsent
    ? computeAbsentDeduction(input.absentDays, input.dailyRate)
    : 0;

  const undertimeDeduction = input.autoDeductUndertime
    ? computeUndertimeDeduction(input.shiftHours, input.actualHours, input.hourlyRate)
    : 0;

  let overtimePay = 0;
  if (input.autoAddOvertime) {
    for (const entry of input.overtimeEntries) {
      const mult = pickMultiplier(entry.kind, input.multipliers);
      overtimePay += computeOvertimeEarnings(entry.hours, input.hourlyRate, mult);
    }
    overtimePay = round2(overtimePay);
  }

  const totalDeductions = round2(lateDeduction + absentDeduction + undertimeDeduction);

  return { lateDeduction, absentDeduction, undertimeDeduction, overtimePay, totalDeductions };
}

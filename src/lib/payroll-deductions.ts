/**
 * Payroll Auto-Deductions from Attendance
 * Computes late, absent, and undertime deductions based on attendance data.
 */

export interface AttendanceDeductionInput {
  /** Monthly salary in PHP */
  monthlySalary: number;
  /** Number of working days in the period (default 22) */
  workingDaysInPeriod?: number;
  /** Standard hours per day (default 8) */
  standardHoursPerDay?: number;
  /** Total late minutes in the period */
  lateMinutes: number;
  /** Total absent days in the period */
  absentDays: number;
  /** Total undertime minutes in the period */
  undertimeMinutes: number;
  /** Approved overtime hours in the period */
  approvedOTHours: number;
  /** OT multiplier (default 1.25) */
  otMultiplier?: number;
}

export interface AttendanceDeductionResult {
  dailyRate: number;
  hourlyRate: number;
  lateDeduction: number;
  absentDeduction: number;
  undertimeDeduction: number;
  overtimeEarning: number;
  totalDeductions: number;
  netAdjustment: number; // negative = deduction, positive = earning
}

/**
 * Compute daily rate from monthly salary
 */
export function computeDailyRate(monthlySalary: number, workingDaysPerMonth = 22): number {
  return monthlySalary / workingDaysPerMonth;
}

/**
 * Compute hourly rate from daily rate
 */
export function computeHourlyRate(dailyRate: number, hoursPerDay = 8): number {
  return dailyRate / hoursPerDay;
}

/**
 * Compute late deduction: (late_minutes / 60) x hourly_rate
 */
export function computeLateDeduction(lateMinutes: number, hourlyRate: number): number {
  if (lateMinutes <= 0) return 0;
  return Math.round(((lateMinutes / 60) * hourlyRate) * 100) / 100;
}

/**
 * Compute absent deduction: daily_rate x absent_days
 */
export function computeAbsentDeduction(absentDays: number, dailyRate: number): number {
  if (absentDays <= 0) return 0;
  return Math.round((absentDays * dailyRate) * 100) / 100;
}

/**
 * Compute undertime deduction: (undertime_minutes / 60) x hourly_rate
 */
export function computeUndertimeDeduction(undertimeMinutes: number, hourlyRate: number): number {
  if (undertimeMinutes <= 0) return 0;
  return Math.round(((undertimeMinutes / 60) * hourlyRate) * 100) / 100;
}

/**
 * Compute overtime earning: approved_hours x hourly_rate x multiplier
 */
export function computeOvertimeEarning(
  approvedHours: number,
  hourlyRate: number,
  multiplier = 1.25
): number {
  if (approvedHours <= 0) return 0;
  return Math.round((approvedHours * hourlyRate * multiplier) * 100) / 100;
}

/**
 * Compute all attendance-based deductions and earnings for a payroll period
 */
export function computeAttendanceDeductions(input: AttendanceDeductionInput): AttendanceDeductionResult {
  const workingDays = input.workingDaysInPeriod ?? 22;
  const hoursPerDay = input.standardHoursPerDay ?? 8;
  const otMultiplier = input.otMultiplier ?? 1.25;

  const dailyRate = computeDailyRate(input.monthlySalary, workingDays);
  const hourlyRate = computeHourlyRate(dailyRate, hoursPerDay);

  const lateDeduction = computeLateDeduction(input.lateMinutes, hourlyRate);
  const absentDeduction = computeAbsentDeduction(input.absentDays, dailyRate);
  const undertimeDeduction = computeUndertimeDeduction(input.undertimeMinutes, hourlyRate);
  const overtimeEarning = computeOvertimeEarning(input.approvedOTHours, hourlyRate, otMultiplier);

  const totalDeductions = lateDeduction + absentDeduction + undertimeDeduction;
  const netAdjustment = overtimeEarning - totalDeductions;

  return {
    dailyRate,
    hourlyRate,
    lateDeduction,
    absentDeduction,
    undertimeDeduction,
    overtimeEarning,
    totalDeductions,
    netAdjustment,
  };
}

// ─── OT Multiplier Presets (DOLE) ────────────────────────────

export const OT_MULTIPLIERS = {
  regular: 1.25,          // Regular OT (125%)
  rest_day: 1.30,         // Rest day OT (130%)
  regular_holiday: 2.60,  // Regular holiday OT (260%)
  special_holiday: 1.69,  // Special holiday OT (169%)
  rest_day_regular_holiday: 3.38, // Rest day + regular holiday OT (338%)
  rest_day_special_holiday: 1.95, // Rest day + special holiday OT (195%)
  night_diff: 0.10,       // Night differential additional (10%)
} as const;

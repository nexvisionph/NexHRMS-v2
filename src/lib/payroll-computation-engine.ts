/**
 * Payroll Computation Engine
 *
 * Pure computation module — no side effects, no DB calls.
 * Reads employee data + attendance logs + holidays and produces
 * fully computed payslip data per cutoff cycle.
 *
 * Formula based on client-submitted payslip figures (DOLE PH compliance).
 */

import type {
  Employee, AttendanceLog, Holiday,
  ComputeDayType, ComputedPayroll, PayslipDtrDay,
} from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COMPUTE_WORK_DAYS = 21.5;
const STANDARD_HOURS_PER_DAY = 8;
const LUNCH_BREAK_HOURS = 1;
const SHIFT_START_HOUR = 8; // 8:00 AM — regular day cap
const NIGHT_DIFF_START = 22; // 10:00 PM

// ─── OT Multiplier Table (from client payslip) ──────────────────────────────

const MULTIPLIERS = {
  REG: { normal: 1.25, nightDiff: 1.375 },
  SAT: { first8: 1.30, excess: 1.69, nightDiff: 1.859 },
  SUN: { first8: 1.30, excess: 1.69, nightDiff: 1.859 },
  SPEC_HOL: { first8: 1.50, excess: 1.95, nightDiff: 2.145 },
  REG_HOL: { first8: 2.00, excess: 2.60, nightDiff: 2.86 },
  REG_HOL_SAT: { first8: 2.60, excess: 3.38, nightDiff: 3.718 },
} as const;

// ─── Day of Week Helpers ─────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}

// ─── Core: Determine Day Type ────────────────────────────────────────────────

export function getDayType(dateStr: string, holidays: Holiday[]): ComputeDayType {
  const holiday = holidays.find((h) => h.date === dateStr);
  if (holiday) {
    if (holiday.type === "regular") return "REG_HOL";
    if (holiday.type === "declared_half_day") return "REG"; // Treat as regular day but OT threshold differs
    // special, special_non_working, special_working all treated as SPEC_HOL
    return "SPEC_HOL";
  }
  const dow = getDayOfWeek(dateStr);
  if (dow === 6) return "SAT";
  if (dow === 0) return "SUN";
  return "REG";
}

/** Check if a date is a declared half-day */
function isDeclaredHalfDay(dateStr: string, holidays: Holiday[]): boolean {
  const holiday = holidays.find((h) => h.date === dateStr);
  return holiday?.type === "declared_half_day";
}

// ─── Core: Parse Time String to Decimal Hours ────────────────────────────────

function parseTimeToDecimal(time: string | undefined | null): number | null {
  if (!time) return null;
  // Support "HH:mm", "HH:mm:ss", or ISO timestamp
  let hours: number, minutes: number;
  if (time.includes("T")) {
    const d = new Date(time);
    hours = d.getHours();
    minutes = d.getMinutes();
  } else {
    const parts = time.split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1] || 0);
  }
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours + minutes / 60;
}

function decimalToTimeStr(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Core: Compute Hours for a Single Day ────────────────────────────────────

interface DayComputation {
  totalHours: number;
  effectiveIn: number;
  otHours: number;
  undertimeHours: number;
  otPay: number;
  nightDiffHours: number;
}

function computeDayHours(
  checkInDecimal: number,
  checkOutDecimal: number,
  dayType: ComputeDayType,
  ratePerHour: number,
  isSaturday: boolean,
  isHalfDay: boolean = false
): DayComputation {
  // Cap rules (matching client payslip behavior):
  // - ALL days: cap check_in at 08:00 (no credit for early arrival)
  // - Lunch break: deducted from TOTAL HOURS display but NOT from OT computation
  //   Client payslip formula: OT = (OUT - 8.00) - 8  (no lunch deducted from OT)
  //   This means OT starts after 16:00 (4PM), not 17:00 (5PM)
  const effectiveIn = Math.max(checkInDecimal, SHIFT_START_HOUR);

  // Total hours for display (with lunch deduction)
  let totalHoursDisplay = checkOutDecimal - effectiveIn - LUNCH_BREAK_HOURS;
  totalHoursDisplay = Math.max(totalHoursDisplay, 0);

  // Total hours for OT computation (NO lunch deduction — matches client formula)
  let totalHoursForOT = checkOutDecimal - effectiveIn;
  totalHoursForOT = Math.max(totalHoursForOT, 0);

  // For Saturday/Sunday: cap at 8.0 hours (client payslip uses flat 8hrs max for rest days)
  if (dayType === "SAT" || dayType === "SUN") {
    totalHoursDisplay = Math.min(totalHoursDisplay, STANDARD_HOURS_PER_DAY);
    totalHoursForOT = Math.min(totalHoursForOT, STANDARD_HOURS_PER_DAY);
  }

  // Determine OT and undertime
  let otHours = 0;
  let undertimeHours = 0;

  if (dayType === "REG") {
    if (isHalfDay) {
      // Declared Half-Day: OT = total WITH lunch deducted - 4 (half-day threshold)
      // Client formula: (OUT - 8 - 1) - 4, then floor the result
      const totalWithLunch = checkOutDecimal - effectiveIn - LUNCH_BREAK_HOURS;
      const halfDayOt = Math.max(0, totalWithLunch - 4);
      otHours = Math.floor(halfDayOt); // Client floors half-day OT to whole hours
    } else {
      // OT = hours beyond 8 from the no-lunch total (effectively: OUT - 16:00)
      otHours = Math.max(0, totalHoursForOT - STANDARD_HOURS_PER_DAY);
    }
    // Undertime based on display hours (with lunch)
    undertimeHours = Math.max(0, (isHalfDay ? 4 : STANDARD_HOURS_PER_DAY) - totalHoursDisplay);
  } else if (dayType === "SAT" || dayType === "SUN") {
    // Saturday/Sunday: all hours are OT (already capped at 8.0 above)
    otHours = totalHoursForOT;
  } else {
    // SPEC_HOL, REG_HOL — all hours count as OT (no cap)
    otHours = totalHoursForOT;
  }

  // Night differential hours (hours worked after 10PM)
  const nightDiffHours = checkOutDecimal > NIGHT_DIFF_START
    ? Math.min(totalHoursForOT, checkOutDecimal - NIGHT_DIFF_START)
    : 0;

  // Compute OT pay (using the complex multiplier table for future use)
  const otPay = computeOTPayForDay(totalHoursForOT, otHours, dayType, ratePerHour, nightDiffHours, isSaturday);

  return { totalHours: totalHoursDisplay, effectiveIn, otHours, undertimeHours, otPay, nightDiffHours };
}

// ─── Core: Compute OT Pay for a Day ─────────────────────────────────────────

function computeOTPayForDay(
  totalHours: number,
  otHours: number,
  dayType: ComputeDayType,
  ratePerHour: number,
  nightDiffHours: number,
  isSaturday: boolean
): number {
  if (otHours <= 0 && dayType === "REG") return 0;
  if (totalHours <= 0) return 0;

  switch (dayType) {
    case "REG": {
      // OT is only hours beyond 8
      const otPreNight = Math.max(0, otHours - nightDiffHours);
      const otNight = Math.min(otHours, nightDiffHours);
      return round2(
        otPreNight * ratePerHour * MULTIPLIERS.REG.normal +
        otNight * ratePerHour * MULTIPLIERS.REG.nightDiff
      );
    }

    case "SAT":
    case "SUN": {
      const first8 = Math.min(totalHours, 8);
      const excess = Math.max(0, totalHours - 8);
      const nightFirst8 = Math.min(first8, nightDiffHours);
      const preNightFirst8 = first8 - nightFirst8;
      const remainingNight = Math.max(0, nightDiffHours - nightFirst8);
      const nightExcess = Math.min(excess, remainingNight);
      const preNightExcess = excess - nightExcess;

      return round2(
        preNightFirst8 * ratePerHour * MULTIPLIERS.SAT.first8 +
        nightFirst8 * ratePerHour * MULTIPLIERS.SAT.nightDiff +
        preNightExcess * ratePerHour * MULTIPLIERS.SAT.excess +
        nightExcess * ratePerHour * MULTIPLIERS.SAT.nightDiff
      );
    }

    case "SPEC_HOL": {
      const first8 = Math.min(totalHours, 8);
      const excess = Math.max(0, totalHours - 8);
      const nightFirst8 = Math.min(first8, nightDiffHours);
      const preNightFirst8 = first8 - nightFirst8;

      return round2(
        preNightFirst8 * ratePerHour * MULTIPLIERS.SPEC_HOL.first8 +
        nightFirst8 * ratePerHour * MULTIPLIERS.SPEC_HOL.nightDiff +
        excess * ratePerHour * MULTIPLIERS.SPEC_HOL.excess
      );
    }

    case "REG_HOL": {
      const first8 = Math.min(totalHours, 8);
      const excess = Math.max(0, totalHours - 8);

      if (isSaturday) {
        const nightFirst8 = Math.min(first8, nightDiffHours);
        const preNightFirst8 = first8 - nightFirst8;
        return round2(
          preNightFirst8 * ratePerHour * MULTIPLIERS.REG_HOL_SAT.first8 +
          nightFirst8 * ratePerHour * MULTIPLIERS.REG_HOL_SAT.nightDiff +
          excess * ratePerHour * MULTIPLIERS.REG_HOL_SAT.excess
        );
      }

      const nightFirst8 = Math.min(first8, nightDiffHours);
      const preNightFirst8 = first8 - nightFirst8;
      return round2(
        preNightFirst8 * ratePerHour * MULTIPLIERS.REG_HOL.first8 +
        nightFirst8 * ratePerHour * MULTIPLIERS.REG_HOL.nightDiff +
        excess * ratePerHour * MULTIPLIERS.REG_HOL.excess
      );
    }
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function splitHoursMinutes(totalHours: number): { hours: number; minutes: number } {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  return { hours, minutes };
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

export interface PayrollCycle {
  periodStart: string;
  periodEnd: string;
  label: string;
}

/**
 * Given a date range, detect all semi-monthly cycles within it.
 * Cycle A: 26th of prev month → 10th of current month
 * Cycle B: 11th → 25th of current month
 */
export function detectCycles(startDate: string, endDate: string): PayrollCycle[] {
  const cycles: PayrollCycle[] = [];
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  // Iterate month by month, starting from the month of startDate
  const current = new Date(start);
  current.setDate(1); // go to first of month

  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth(); // 0-indexed

    // Cycle A: 26th prev month → 10th this month
    const cycleAStart = new Date(year, month - 1, 26);
    const cycleAEnd = new Date(year, month, 10);

    // Cycle B: 11th → 25th this month
    const cycleBStart = new Date(year, month, 11);
    const cycleBEnd = new Date(year, month, 25);

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Only include cycles that overlap with the requested range
    if (cycleAEnd >= start && cycleAStart <= end) {
      const effectiveStart = cycleAStart < start ? start : cycleAStart;
      const effectiveEnd = cycleAEnd > end ? end : cycleAEnd;
      cycles.push({
        periodStart: fmt(effectiveStart),
        periodEnd: fmt(effectiveEnd),
        label: `Cycle A (${fmt(cycleAStart)} → ${fmt(cycleAEnd)})`,
      });
    }

    if (cycleBEnd >= start && cycleBStart <= end) {
      const effectiveStart = cycleBStart < start ? start : cycleBStart;
      const effectiveEnd = cycleBEnd > end ? end : cycleBEnd;
      cycles.push({
        periodStart: fmt(effectiveStart),
        periodEnd: fmt(effectiveEnd),
        label: `Cycle B (${fmt(cycleBStart)} → ${fmt(cycleBEnd)})`,
      });
    }

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  // Remove duplicates and sort by start date
  const seen = new Set<string>();
  return cycles
    .filter((c) => {
      const key = `${c.periodStart}/${c.periodEnd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

// ─── Main Computation Function ───────────────────────────────────────────────

export interface ComputePayrollParams {
  employee: Employee;
  periodStart: string;
  periodEnd: string;
  attendanceLogs: AttendanceLog[];
  holidays: Holiday[];
  deductions: {
    tax: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    loans: number;
    other: number;
  };
  computeWorkDays?: number;
}

export function computePayroll(params: ComputePayrollParams): ComputedPayroll {
  const {
    employee,
    periodStart,
    periodEnd,
    attendanceLogs,
    holidays,
    deductions,
    computeWorkDays = DEFAULT_COMPUTE_WORK_DAYS,
  } = params;

  // Step 1: Derive rates
  const ratePerDay = round2(employee.salary / computeWorkDays);
  const ratePerHour = round2(ratePerDay / STANDARD_HOURS_PER_DAY);

  // Step 7 (partial): Semi-monthly basic
  const semiMonthlyBasic = round2(employee.salary / 2);

  // ─── OT Exempt: Skip all OT computation (consultants/managerial) ───
  if (employee.otExempt) {
    const totalDeductions = round2(
      deductions.tax + deductions.sss + deductions.philhealth +
      deductions.pagibig + deductions.loans + deductions.other
    );
    const netPay = round2(semiMonthlyBasic - totalDeductions);

    console.log(`[PAYROLL-ENGINE] ═══ OT EXEMPT: ${employee.name} (${periodStart} → ${periodEnd}) ═══`);
    console.log(`[PAYROLL-ENGINE]   Basic=₱${semiMonthlyBasic} | Deductions=₱${totalDeductions} | NetPay=₱${netPay}`);

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.jobTitle || "",
      department: employee.department,
      periodStart,
      periodEnd,
      monthlySalary: employee.salary,
      ratePerDay,
      ratePerHour,
      semiMonthlyBasic,
      absentDays: 0,
      absentDeduction: 0,
      undertimeHours: 0,
      undertimeDeduction: 0,
      totalBasic: semiMonthlyBasic,
      regOtHours: 0,
      regOtMinutes: 0,
      satOtHours: 0,
      satOtMinutes: 0,
      totalOtPay: 0,
      withholdingTax: deductions.tax,
      sss: deductions.sss,
      philhealth: deductions.philhealth,
      pagibig: deductions.pagibig,
      otherDeductions: deductions.other + deductions.loans,
      totalDeductions,
      netPay,
      dailyBreakdown: [],
      daysPresent: 0,
    };
  }

  // Iterate each day in the period (inclusive of both start and end dates)
  const dailyBreakdown: PayslipDtrDay[] = [];
  let totalRegOtHours = 0;
  let totalSatOtHours = 0;
  let totalOtPay = 0;
  let totalUndertimeHours = 0;
  let absentDays = 0;
  let daysPresent = 0;

  // Use local date formatting to avoid timezone issues — iterate inclusively
  const allDates: string[] = [];
  const iterDate = new Date(periodStart + "T12:00:00");
  const endDateObj = new Date(periodEnd + "T12:00:00");
  while (iterDate <= endDateObj) {
    const y = iterDate.getFullYear();
    const m = String(iterDate.getMonth() + 1).padStart(2, "0");
    const day = String(iterDate.getDate()).padStart(2, "0");
    allDates.push(`${y}-${m}-${day}`);
    iterDate.setDate(iterDate.getDate() + 1);
  }

  for (const dateStr of allDates) {
    const dow = new Date(dateStr + "T12:00:00").getDay();
    const dayType = getDayType(dateStr, holidays);
    const isSaturday = dow === 6;

    // Find attendance log for this day
    const log = attendanceLogs.find(
      (l) => l.employeeId === employee.id && l.date === dateStr
    );

    // Debug: log what we find for each day
    if (dayType !== "REG" || !log) {
      console.log(
        `[PAYROLL-ENGINE] ${dateStr} (${DAY_NAMES[dow]}) ${dayType} | log=${log ? `found(status=${log.status}, in=${log.checkIn}, out=${log.checkOut})` : "NONE"}`
      );
    }

    const dayRecord: PayslipDtrDay = {
      date: dateStr,
      day: DAY_NAMES[dow],
      timeIn: "",
      timeOut: "",
      totalHrs: 0,
      otHrs: 0,
      tardinessHr: 0,
      tardinessMin: 0,
      absences: 0,
      dayType,
      effectiveIn: undefined,
      undertimeHours: 0,
      otPay: 0,
      otDescription: log?.otDescription || undefined,
      dayStatus: "Rest Day",
    };

    // Status handling per day
    if (log && log.status === "present") {
      daysPresent++;
      dayRecord.dayStatus = "Present";
      dayRecord.timeIn = log.checkIn || "";
      dayRecord.timeOut = log.checkOut || "";

      const checkInDecimal = parseTimeToDecimal(log.checkIn);
      const checkOutDecimal = parseTimeToDecimal(log.checkOut);

      if (checkInDecimal !== null && checkOutDecimal !== null) {
        const halfDay = isDeclaredHalfDay(dateStr, holidays);
        const comp = computeDayHours(checkInDecimal, checkOutDecimal, dayType, ratePerHour, isSaturday, halfDay);

        dayRecord.totalHrs = round2(comp.totalHours);
        dayRecord.otHrs = round2(comp.otHours);
        dayRecord.effectiveIn = decimalToTimeStr(comp.effectiveIn);
        dayRecord.undertimeHours = round2(comp.undertimeHours);

        // Accumulate hours — pay computed at end using client formula
        totalUndertimeHours += comp.undertimeHours;

        if (dayType === "SAT" || dayType === "SUN") {
          // Saturday/Sunday: paid ONCE at 1.30x only. NOT added to regular OT pool.
          totalSatOtHours += comp.otHours;
        } else if (dayType === "REG") {
          // Regular weekday OT — apply minute truncation for accumulation
          // Client truncates minutes < 30 to 0 when summing payable OT
          const rawOt = comp.otHours;
          const floorHrs = Math.floor(rawOt);
          const mins = Math.round((rawOt - floorHrs) * 60);
          const payableMins = mins >= 30 ? mins : 0;
          const payableOt = floorHrs + payableMins / 60;
          totalRegOtHours += payableOt;
        } else {
          // SPEC_HOL, REG_HOL — paid at 1.30x (same bucket as Saturday)
          totalSatOtHours += comp.otHours;
        }

        // Debug: per-day OT breakdown
        console.log(
          `[PAYROLL-ENGINE] ${dateStr} (${DAY_NAMES[dow]}) ${dayType} | IN=${log.checkIn} OUT=${log.checkOut} | effIn=${decimalToTimeStr(comp.effectiveIn)} | totalHrs=${round2(comp.totalHours)} | OT=${round2(comp.otHours)}hrs | runningRegOT=${round2(totalRegOtHours)} | runningSatOT=${round2(totalSatOtHours)}`
        );

        // Late (tardiness) — use existing lateMinutes from log or compute from check-in
        const lateMin = log.lateMinutes || 0;
        dayRecord.tardinessHr = Math.floor(lateMin / 60);
        dayRecord.tardinessMin = lateMin % 60;
      }
    } else if (log && log.status === "absent") {
      dayRecord.dayStatus = "Absent";
      if (dayType === "REG") {
        // Absent on regular day → deduct
        absentDays++;
        dayRecord.absences = 1;
      }
      // Absent on SAT/SUN/HOL → no deduction
    } else if (log && log.status === "on_leave") {
      dayRecord.dayStatus = "Leave";
      // Paid leave — no deduction
    } else {
      // No log at all
      if (dayType === "REG") {
        // No record on regular day → treat as absent
        dayRecord.dayStatus = "Absent";
        absentDays++;
        dayRecord.absences = 1;
      } else if (dayType === "REG_HOL" || dayType === "SPEC_HOL") {
        dayRecord.dayStatus = "Holiday";
        // Holiday, not worked — no deduction (regular holiday is paid)
      } else {
        dayRecord.dayStatus = "Rest Day";
        // Rest day, no deduction
      }
    }

    dailyBreakdown.push(dayRecord);
  }

  // ═══ CLIENT OT PAY FORMULA ═══
  // The client payslip computes payable OT per day using:
  //   1. OT hours calculated WITHOUT lunch deduction (OUT - 8:00 - 8)
  //   2. Minutes < 30 are TRUNCATED to 0 (only minutes ≥ 30 are kept)
  //   3. Two separate pools: Regular at 1.25x, Saturday/Holiday at 1.30x
  //   4. Each day rounded to 2 decimals, then summed
  let sumRegOtPay = 0;
  let sumSatOtPay = 0;

  // Assign per-day otPay and accumulate totals
  for (const day of dailyBreakdown) {
    if (day.otHrs && day.otHrs > 0) {
      if (day.dayType === "SAT" || day.dayType === "SUN" || day.dayType === "SPEC_HOL" || day.dayType === "REG_HOL") {
        // Saturday/Sunday/Holiday: separate pool at 1.30x (no truncation — always 8 flat)
        day.otPay = round2(day.otHrs * ratePerHour * 1.30);
        sumSatOtPay += day.otPay;
      } else {
        // Regular weekday OT: apply minute truncation rule
        // Split OT into hours + minutes, truncate minutes < 30 to 0
        const otFloorHrs = Math.floor(day.otHrs);
        const otMinutes = Math.round((day.otHrs - otFloorHrs) * 60);
        const payableMinutes = otMinutes >= 30 ? otMinutes : 0;
        const payableOtHrs = otFloorHrs + payableMinutes / 60;
        day.otPay = round2(payableOtHrs * ratePerHour * 1.25);
        sumRegOtPay += day.otPay;
      }
    }
  }

  // Round the accumulated sums
  const regularOtPay = round2(sumRegOtPay);
  const saturdayPremium = round2(sumSatOtPay);
  totalOtPay = round2(regularOtPay + saturdayPremium);

  console.log(`[PAYROLL-ENGINE] ═══ OT BREAKDOWN TABLE ═══`);
  dailyBreakdown.filter(d => d.otHrs && d.otHrs > 0).forEach(d => {
    console.log(`[PAYROLL-ENGINE]   ${d.date} ${d.day} ${d.dayType} | OThrs=${d.otHrs} | OTpay=₱${d.otPay}`);
  });
  console.log(`[PAYROLL-ENGINE]   ─────────────────────────────────`);
  console.log(`[PAYROLL-ENGINE]   RegOT pool: ${round2(totalRegOtHours)}hrs → sum of per-day pay = ₱${regularOtPay}`);
  console.log(`[PAYROLL-ENGINE]   Sat/Hol pool: ${round2(totalSatOtHours)}hrs → sum of per-day pay = ₱${saturdayPremium}`);
  console.log(`[PAYROLL-ENGINE]   TOTAL OT PAY: ₱${totalOtPay}`);

  // Step 7: Basic pay is FIXED at semi-monthly (salary / 2)
  // Absent deduction is a separate line item that reduces net pay.
  // Undertime: tracked for display but NOT deducted (client does not deduct undertime).
  const absentDeduction = round2(absentDays * ratePerDay);
  const undertimeDeduction = 0; // Client formula: no undertime deduction
  const totalBasic = semiMonthlyBasic; // FIXED — never prorated

  // Step 8: Apply deductions (gov + loans + other)
  const totalDeductions = round2(
    deductions.tax + deductions.sss + deductions.philhealth +
    deductions.pagibig + deductions.loans + deductions.other
  );

  // Step 9: Net pay = basic + OT - absent deduction - undertime deduction - gov deductions
  const netPay = round2(totalBasic + totalOtPay - absentDeduction - undertimeDeduction - totalDeductions);

  // Debug summary
  console.log(`[PAYROLL-ENGINE] ═══ SUMMARY for ${employee.name} (${periodStart} → ${periodEnd}) ═══`);
  console.log(`[PAYROLL-ENGINE]   Rate/day=₱${ratePerDay} Rate/hr=₱${ratePerHour}`);
  console.log(`[PAYROLL-ENGINE]   Basic=₱${totalBasic} | RegOT=${round2(totalRegOtHours)}hrs | SatOT=${round2(totalSatOtHours)}hrs`);
  console.log(`[PAYROLL-ENGINE]   TotalOTpay=₱${round2(totalOtPay)} | AbsentDed=₱${absentDeduction} | UndertimeDed=₱${undertimeDeduction}`);
  console.log(`[PAYROLL-ENGINE]   Deductions=₱${totalDeductions} | NetPay=₱${netPay}`);
  console.log(`[PAYROLL-ENGINE]   Days in period: ${allDates.length} | Present: ${daysPresent} | Absent: ${absentDays}`);

  // Split OT hours into hours + minutes
  const regOT = splitHoursMinutes(totalRegOtHours);
  const satOT = splitHoursMinutes(totalSatOtHours);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.jobTitle || "",
    department: employee.department,
    periodStart,
    periodEnd,
    monthlySalary: employee.salary,
    ratePerDay,
    ratePerHour,
    semiMonthlyBasic,
    absentDays,
    absentDeduction,
    undertimeHours: round2(totalUndertimeHours),
    undertimeDeduction,
    totalBasic,
    regOtHours: regOT.hours,
    regOtMinutes: regOT.minutes,
    satOtHours: satOT.hours,
    satOtMinutes: satOT.minutes,
    totalOtPay: round2(totalOtPay),
    withholdingTax: deductions.tax,
    sss: deductions.sss,
    philhealth: deductions.philhealth,
    pagibig: deductions.pagibig,
    otherDeductions: deductions.other + deductions.loans,
    totalDeductions,
    netPay,
    dailyBreakdown,
    daysPresent,
  };
}

// ─── Validation Helper ───────────────────────────────────────────────────────

export function validatePayrollResult(
  computedNet: number,
  clientNet: number
): { pass: boolean; matchPct: number } {
  if (clientNet === 0) return { pass: computedNet === 0, matchPct: computedNet === 0 ? 100 : 0 };
  const matchPct = (1 - Math.abs(computedNet - clientNet) / clientNet) * 100;
  return { pass: matchPct >= 90, matchPct: round2(matchPct) };
}

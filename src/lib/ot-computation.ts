/**
 * OT Computation Engine
 * Pure function: given attendance data + shift data + holidays + settings,
 * returns unsaved OTRecord[] (status = "pending") for HR review.
 *
 * DOLE PH overtime multipliers (TOTAL factor applied to hourly rate):
 *   Regular day OT          → 1.25x hourly rate per OT hour
 *   Rest day OT             → 1.30x
 *   Special holiday OT      → 1.30x
 *   Regular holiday OT      → 2.00x
 *   Night differential      → 1.10x
 *   Rest day + holiday OT   → 1.50x
 *
 * When PayrollRules are provided, multipliers are loaded from the DB.
 * This allows companies to configure custom multipliers (e.g., 1.00 = no premium).
 */

import type {
  AttendanceLog,
  ShiftTemplate,
  Holiday,
  OTRecord,
  OTType,
  OTSettings,
  PayrollRules,
} from "@/types";
import { nanoid } from "nanoid";

// ─── DOLE PH Fallback Multipliers ────────────────────────────
// Used when PayrollRules not provided. Total factor × hourly rate.
export const DOLE_OT_MULTIPLIERS: Record<OTType, number> = {
  regular:            1.25,
  rest_day:           1.30,
  special_holiday:    1.30,
  regular_holiday:    2.00,
  night_differential: 1.10,
  rest_day_holiday:   1.50,
};

/**
 * @deprecated Use DOLE_OT_MULTIPLIERS or getOTMultipliers(rules) instead.
 * Kept for backwards compatibility with existing callers.
 */
export const OT_MULTIPLIERS = DOLE_OT_MULTIPLIERS;

/** Build the OT multiplier map from payroll_rules DB row. */
export function getOTMultipliers(rules?: PayrollRules | null): Record<OTType, number> {
  if (!rules) return DOLE_OT_MULTIPLIERS;
  return {
    regular:            rules.regularOtMultiplier,
    rest_day:           rules.restdayOtMultiplier,
    special_holiday:    rules.specialHolidayMultiplier,
    regular_holiday:    rules.regularHolidayMultiplier,
    night_differential: rules.nightDiffMultiplier,
    rest_day_holiday:   rules.restdayHolidayMultiplier,
  };
}

export const OT_TYPE_LABELS: Record<OTType, string> = {
  regular:            "Regular OT",
  rest_day:           "Rest Day OT",
  regular_holiday:    "Regular Holiday OT",
  special_holiday:    "Special Holiday OT",
  night_differential: "Night Differential OT",
  rest_day_holiday:   "Rest Day + Holiday OT",
};

/** Parse "HH:mm" or "HH:mm:ss" → total minutes from midnight */
function timeToMinutes(t: string): number {
  const parts = t.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** Format minutes-from-midnight → "HH:mm" */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Check if a date string (YYYY-MM-DD) is a rest day given shift.workDays (1=Mon…7=Sun) */
function isRestDay(dateStr: string, shift: ShiftTemplate | undefined): boolean {
  if (!shift) return false;
  const d = new Date(dateStr + "T12:00:00");
  const jsDay = d.getDay(); // 0=Sun, 1=Mon…
  const isoDay = jsDay === 0 ? 7 : jsDay; // convert to 1=Mon…7=Sun
  return !shift.workDays.includes(isoDay);
}

/** Check if a time string falls within the night diff window (default 22:00–06:00) */
function isNightDiffTime(
  checkoutTime: string,
  nightDiffStart = "22:00",
  nightDiffEnd = "06:00",
): boolean {
  const co = timeToMinutes(checkoutTime);
  const ns = timeToMinutes(nightDiffStart);
  const ne = timeToMinutes(nightDiffEnd) + 24 * 60; // next day
  // Night diff spans midnight: 22:00 → 1320 min, checkout >= 1320 OR checkout <= 360 (06:00)
  const nEnd = timeToMinutes(nightDiffEnd);
  if (ns > nEnd) {
    // spans midnight
    return co >= ns || co <= nEnd;
  }
  return co >= ns && co <= nEnd;
}

/**
 * Classify OT type for a given date + checkout time
 * Priority: rest_day_holiday > regular_holiday > special_holiday > rest_day > night_differential > regular
 */
function classifyOTType(
  dateStr: string,
  actualTimeOut: string,
  shift: ShiftTemplate | undefined,
  holidays: Holiday[],
  nightDiffStart: string,
  nightDiffEnd: string,
): OTType {
  const holiday = holidays.find((h) => h.date === dateStr);
  const restDay = isRestDay(dateStr, shift);
  const nightDiff = isNightDiffTime(actualTimeOut, nightDiffStart, nightDiffEnd);

  if (restDay && holiday) return "rest_day_holiday";
  if (holiday?.type === "regular") return "regular_holiday";
  if (holiday?.type === "special" || holiday?.type === "special_non_working") return "special_holiday";
  if (restDay) return "rest_day";
  if (nightDiff) return "night_differential";
  return "regular";
}

export interface ComputeOTInput {
  logs: AttendanceLog[];
  shiftTemplates: ShiftTemplate[];
  employeeShifts: Record<string, string>;   // employeeId → shiftId
  holidays: Holiday[];
  settings: OTSettings;
  payrollPeriodId?: string;
  /** hourly rate per employee — provide as a map */
  hourlyRates: Record<string, number>;
  /** Night diff window (from rule set) */
  nightDiffStart?: string;
  nightDiffEnd?: string;
  /**
   * Payroll rules from DB (payroll_rules table).
   * When provided, OT multipliers are read from rules instead of DOLE hardcoded defaults.
   * This enables custom company policy (e.g., no OT premium: multiplier = 1.00).
   */
  payrollRules?: PayrollRules | null;
}

/**
 * Main computation function.
 * Returns OTRecord[] — all status = "pending", id pre-assigned.
 * Does NOT write to DB; caller is responsible for persistence.
 */
export function computeOTRecords(input: ComputeOTInput): OTRecord[] {
  const {
    logs,
    shiftTemplates,
    employeeShifts,
    holidays,
    settings,
    payrollPeriodId,
    hourlyRates,
    payrollRules,
    nightDiffStart = payrollRules?.nightDiffStart ?? "22:00",
    nightDiffEnd   = payrollRules?.nightDiffEnd   ?? "06:00",
  } = input;

  if (!settings.enableOtReview) return [];

  // Load multipliers from payroll_rules if available, else DOLE defaults
  const multiplierMap = getOTMultipliers(payrollRules);

  const minOtMinutes    = payrollRules?.minimumOtMinutes  ?? settings.minimumOtMinutes;
  const gracePeriod     = payrollRules?.gracePeriodMinutes ?? settings.otGracePeriodMinutes;
  const nightDiffActive = payrollRules ? payrollRules.enableNightDiff : true;

  const results: OTRecord[] = [];
  const now = new Date().toISOString();

  for (const log of logs) {
    // Skip if no checkout or not present
    if (!log.checkOut || log.status !== "present") continue;

    const shiftId = employeeShifts[log.employeeId];
    const shift = shiftId ? shiftTemplates.find((s) => s.id === shiftId) : undefined;

    if (!shift) continue; // cannot compute OT without a shift

    const scheduledOutMinutes = timeToMinutes(shift.endTime);
    const actualOutMinutes    = timeToMinutes(log.checkOut);

    // Compute raw delta (handle overnight shifts)
    let deltaMinutes = actualOutMinutes - scheduledOutMinutes;
    if (deltaMinutes < 0) deltaMinutes += 24 * 60;
    // Reasonable cap: more than 8h OT is suspicious, cap at 8h
    if (deltaMinutes > 480) deltaMinutes = 480;

    // Apply grace period
    const effectiveDelta = deltaMinutes - gracePeriod;
    if (effectiveDelta < minOtMinutes) continue;

    const computedOtHours = Math.round((effectiveDelta / 60) * 100) / 100;
    const otType = classifyOTType(
      log.date,
      log.checkOut,
      shift,
      holidays,
      // Night diff classification only when enabled
      nightDiffActive ? nightDiffStart : "00:00",
      nightDiffActive ? nightDiffEnd   : "00:00",
    );

    const hourlyRate = hourlyRates[log.employeeId] ?? 0;
    // multiplierMap holds the TOTAL factor (e.g. 1.25 = base + 25% premium)
    const multiplier = multiplierMap[otType];
    const computedAmount = Math.round(computedOtHours * hourlyRate * multiplier * 100) / 100;

    results.push({
      id: `OT-${nanoid(8)}`,
      employeeId: log.employeeId,
      attendanceId: log.id,
      payrollPeriodId,
      otDate: log.date,
      scheduledTimeOut: minutesToTime(scheduledOutMinutes),
      actualTimeOut: log.checkOut,
      computedOtHours,
      otType,
      computedAmount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  return results;
}

/**
 * Given approvedOtHours and computedOtHours, derive the resulting status.
 */
export function deriveOTStatus(
  computedOtHours: number,
  approvedOtHours: number,
): "approved" | "partially_approved" | "rejected" {
  if (approvedOtHours <= 0) return "rejected";
  if (Math.abs(approvedOtHours - computedOtHours) < 0.01) return "approved";
  return "partially_approved";
}

/**
 * Recalculate approved_amount given approved hours, OT type, and optional payroll rules.
 * When rules not provided, falls back to DOLE PH defaults.
 */
export function recalcApprovedAmount(
  approvedOtHours: number,
  otType: OTType,
  hourlyRate: number,
  payrollRules?: PayrollRules | null,
): number {
  const multiplierMap = getOTMultipliers(payrollRules);
  const multiplier = multiplierMap[otType];
  return Math.round(approvedOtHours * hourlyRate * multiplier * 100) / 100;
}

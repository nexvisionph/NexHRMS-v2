/**
 * Minimum Wage Earner (MWE) Rules
 * Philippine labor law rules for minimum wage earners.
 * MWEs are exempt from income tax on their basic minimum wage.
 */

// ─── Regional Minimum Wage Rates (2026) ─────────────────────

export interface MinimumWageRate {
  region: string;
  regionName: string;
  dailyRate: number;
  effectiveDate: string;
  wageOrder: string;
}

/**
 * NCR and major regional minimum wage rates (2026 estimates)
 * These should be updated when new wage orders are issued.
 */
export const MINIMUM_WAGE_RATES: MinimumWageRate[] = [
  { region: "NCR", regionName: "National Capital Region", dailyRate: 645, effectiveDate: "2026-01-01", wageOrder: "NCR-25" },
  { region: "CAR", regionName: "Cordillera Administrative Region", dailyRate: 430, effectiveDate: "2026-01-01", wageOrder: "CAR-25" },
  { region: "I", regionName: "Ilocos Region", dailyRate: 420, effectiveDate: "2026-01-01", wageOrder: "RB1-25" },
  { region: "II", regionName: "Cagayan Valley", dailyRate: 420, effectiveDate: "2026-01-01", wageOrder: "RB2-25" },
  { region: "III", regionName: "Central Luzon", dailyRate: 530, effectiveDate: "2026-01-01", wageOrder: "RB3-25" },
  { region: "IV-A", regionName: "CALABARZON", dailyRate: 560, effectiveDate: "2026-01-01", wageOrder: "RB4A-25" },
  { region: "IV-B", regionName: "MIMAROPA", dailyRate: 395, effectiveDate: "2026-01-01", wageOrder: "RB4B-25" },
  { region: "V", regionName: "Bicol Region", dailyRate: 390, effectiveDate: "2026-01-01", wageOrder: "RB5-25" },
  { region: "VI", regionName: "Western Visayas", dailyRate: 480, effectiveDate: "2026-01-01", wageOrder: "RB6-25" },
  { region: "VII", regionName: "Central Visayas", dailyRate: 480, effectiveDate: "2026-01-01", wageOrder: "RB7-25" },
  { region: "VIII", regionName: "Eastern Visayas", dailyRate: 375, effectiveDate: "2026-01-01", wageOrder: "RB8-25" },
  { region: "IX", regionName: "Zamboanga Peninsula", dailyRate: 396, effectiveDate: "2026-01-01", wageOrder: "RB9-25" },
  { region: "X", regionName: "Northern Mindanao", dailyRate: 420, effectiveDate: "2026-01-01", wageOrder: "RB10-25" },
  { region: "XI", regionName: "Davao Region", dailyRate: 470, effectiveDate: "2026-01-01", wageOrder: "RB11-25" },
  { region: "XII", regionName: "SOCCSKSARGEN", dailyRate: 400, effectiveDate: "2026-01-01", wageOrder: "RB12-25" },
  { region: "XIII", regionName: "Caraga", dailyRate: 390, effectiveDate: "2026-01-01", wageOrder: "RB13-25" },
  { region: "BARMM", regionName: "Bangsamoro", dailyRate: 380, effectiveDate: "2026-01-01", wageOrder: "BARMM-25" },
];

// ─── MWE Determination ──────────────────────────────────────

export interface MWECheckInput {
  dailyRate: number;
  region?: string;
  /** Monthly salary (alternative to daily rate) */
  monthlySalary?: number;
  /** Working days per month for conversion (default 22) */
  workingDaysPerMonth?: number;
}

export interface MWECheckResult {
  isMWE: boolean;
  employeeDailyRate: number;
  minimumWageForRegion: number;
  region: string;
  difference: number; // positive = above MW, negative = below MW (violation)
  exemptions: MWEExemption[];
}

export interface MWEExemption {
  type: string;
  description: string;
}

/**
 * Check if an employee qualifies as a Minimum Wage Earner
 */
export function checkMWEStatus(input: MWECheckInput): MWECheckResult {
  const region = input.region || "NCR";
  const workingDays = input.workingDaysPerMonth ?? 22;

  // Convert monthly to daily if needed
  const dailyRate = input.dailyRate > 0
    ? input.dailyRate
    : (input.monthlySalary ?? 0) / workingDays;

  // Find minimum wage for region
  const regionRate = MINIMUM_WAGE_RATES.find((r) => r.region === region);
  const minimumWage = regionRate?.dailyRate ?? MINIMUM_WAGE_RATES[0].dailyRate;

  const isMWE = dailyRate <= minimumWage;
  const difference = dailyRate - minimumWage;

  // Determine exemptions for MWE
  const exemptions: MWEExemption[] = [];
  if (isMWE) {
    exemptions.push(
      { type: "income_tax", description: "Exempt from income tax on basic minimum wage" },
      { type: "holiday_pay", description: "Holiday pay, overtime pay, night shift differential, and hazard pay are also tax-exempt" },
    );
  }

  return {
    isMWE,
    employeeDailyRate: Math.round(dailyRate * 100) / 100,
    minimumWageForRegion: minimumWage,
    region,
    difference: Math.round(difference * 100) / 100,
    exemptions,
  };
}

/**
 * Get the minimum wage rate for a specific region
 */
export function getMinimumWage(region: string): number {
  const rate = MINIMUM_WAGE_RATES.find((r) => r.region === region);
  return rate?.dailyRate ?? MINIMUM_WAGE_RATES[0].dailyRate;
}

/**
 * Convert daily rate to monthly salary
 */
export function dailyToMonthly(dailyRate: number, workingDaysPerMonth = 22): number {
  return Math.round(dailyRate * workingDaysPerMonth * 100) / 100;
}

/**
 * Convert monthly salary to daily rate
 */
export function monthlyToDaily(monthlySalary: number, workingDaysPerMonth = 22): number {
  return Math.round((monthlySalary / workingDaysPerMonth) * 100) / 100;
}

/**
 * Check if a salary change would affect MWE status
 */
export function wouldChangeMWEStatus(
  currentDailyRate: number,
  newDailyRate: number,
  region = "NCR"
): { currentIsMWE: boolean; newIsMWE: boolean; statusChanged: boolean } {
  const currentCheck = checkMWEStatus({ dailyRate: currentDailyRate, region });
  const newCheck = checkMWEStatus({ dailyRate: newDailyRate, region });

  return {
    currentIsMWE: currentCheck.isMWE,
    newIsMWE: newCheck.isMWE,
    statusChanged: currentCheck.isMWE !== newCheck.isMWE,
  };
}

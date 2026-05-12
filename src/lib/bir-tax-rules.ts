/**
 * BIR Tax Rules — TRAIN Law (RA 10963)
 * --------------------------------------------------------------
 * ANNUAL withholding tax brackets effective 2023+ (RR 8-2018, as amended).
 *
 *   Annual taxable income  | Tax due
 *   ──────────────────────|─────────────────────────────────────
 *   ≤ ₱250,000             | 0
 *   ≤ ₱400,000             | 15% of excess over ₱250,000
 *   ≤ ₱800,000             | ₱22,500 + 20% of excess over ₱400,000
 *   ≤ ₱2,000,000           | ₱102,500 + 25% of excess over ₱800,000
 *   ≤ ₱8,000,000           | ₱402,500 + 30% of excess over ₱2,000,000
 *   > ₱8,000,000           | ₱2,202,500 + 35% of excess over ₱8,000,000
 *
 * Used by `annual-tax-engine` for year-end reconciliation and Form 2316.
 */

export interface AnnualTaxBracket {
    upperBound: number;
    base: number;
    rate: number;
    lowerBound: number;
}

/** TRAIN annual brackets — 2023 onwards. */
export const TRAIN_ANNUAL_BRACKETS: readonly AnnualTaxBracket[] = [
    { lowerBound: 0,         upperBound: 250_000,    base: 0,         rate: 0.00 },
    { lowerBound: 250_000,   upperBound: 400_000,    base: 0,         rate: 0.15 },
    { lowerBound: 400_000,   upperBound: 800_000,    base: 22_500,    rate: 0.20 },
    { lowerBound: 800_000,   upperBound: 2_000_000,  base: 102_500,   rate: 0.25 },
    { lowerBound: 2_000_000, upperBound: 8_000_000,  base: 402_500,   rate: 0.30 },
    { lowerBound: 8_000_000, upperBound: Infinity,   base: 2_202_500, rate: 0.35 },
] as const;

/**
 * Compute annual income tax due under TRAIN brackets.
 * @param annualTaxableIncome — gross taxable comp − statutory contributions − non-taxable benefits
 */
export function computeAnnualTax(annualTaxableIncome: number): number {
    if (!Number.isFinite(annualTaxableIncome) || annualTaxableIncome <= 250_000) {
        return 0;
    }
    for (const b of TRAIN_ANNUAL_BRACKETS) {
        if (annualTaxableIncome <= b.upperBound) {
            return Math.round(b.base + (annualTaxableIncome - b.lowerBound) * b.rate);
        }
    }
    return 0;
}

/**
 * Determine if year-end withholding leaves employee under-withheld (owes BIR)
 * or over-withheld (refund due).
 */
export function reconcileAnnualTax(
    annualTaxableIncome: number,
    totalTaxWithheld: number,
): {
    annualTaxDue: number;
    adjustment: number;             // signed: + = under-withheld; - = over-withheld
    type: "over_withheld" | "under_withheld" | "balanced";
} {
    const annualTaxDue = computeAnnualTax(annualTaxableIncome);
    const adjustment = annualTaxDue - totalTaxWithheld;

    let type: "over_withheld" | "under_withheld" | "balanced";
    if (Math.abs(adjustment) < 1) type = "balanced";
    else if (adjustment > 0) type = "under_withheld";
    else type = "over_withheld";

    return { annualTaxDue, adjustment, type };
}

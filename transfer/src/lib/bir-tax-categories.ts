/**
 * BIR Earnings Categorization
 * --------------------------------------------------------------
 * Categorizes a payslip's earnings into BIR-compliant buckets:
 *   - basic compensation (taxable / MWE-exempt)
 *   - overtime, holiday, night-diff, hazard (taxable / MWE-exempt)
 *   - 13th-month + bonuses (₱90k ceiling under TRAIN — RA 10963)
 *   - de minimis benefits (RR 11-2018 caps)
 *   - allowances / fringe
 *   - government statutory contributions (non-taxable)
 *
 * Used by `payroll.service` to populate `payslips.tax_categories` (jsonb)
 * and to compute `taxableCompensation` / `nonTaxableCompensation`.
 *
 * Reference: bir_alphalist.md §4 (Categorization Engine)
 */

import type { TaxCategoryBreakdown, Employee, Payslip } from "@/types";
import { isMWEExempt } from "./mwe-rules";

/** Annual ceiling for 13th-month + bonuses non-taxability (TRAIN). */
export const THIRTEENTH_MONTH_CEILING = 90_000;

/** RR 11-2018 de minimis caps (per period / per year). */
export const DE_MINIMIS_CAPS = {
    riceSubsidyMonthly: 2_000,
    medicalAllowanceQuarterly: 1_500,
    laundryAllowanceMonthly: 300,
    uniformAllowanceYearly: 6_000,
    // mealAllowance is 25% of basic minimum wage — caller provides
} as const;

export interface DeMinimisInputs {
    riceSubsidy?: number;
    medicalAllowance?: number;
    laundryAllowance?: number;
    uniformAllowance?: number;
    mealAllowance?: number;
    mealAllowanceCap?: number;          // 25% of min wage (computed by caller)
    other?: number;
}

export interface CategorizePayInputs {
    employee: Pick<Employee, "id" | "isMWE" | "mweDailyRate" | "salary">;
    /** Period basics. */
    basicPay: number;
    overtimePay?: number;
    holidayPay?: number;
    nightDiff?: number;
    hazardPay?: number;
    thirteenthMonth?: number;           // includes Christmas bonus when paid
    /** Year-to-date 13th-month already credited as non-taxable (so we don't
     * double-count the ₱90k ceiling). */
    ytdThirteenthMonthNonTaxable?: number;
    /** Allowances. */
    taxableAllowances?: number;
    nonTaxableAllowances?: number;
    deMinimis?: DeMinimisInputs;
    /** Government contributions (employee share — non-taxable). */
    sss: number;
    philHealth: number;
    pagIBIG: number;
    unionDues?: number;
    /** Tax withheld this period (post-categorization). */
    withholdingTax: number;
}

/**
 * Categorize a single period's earnings into BIR buckets.
 * Pure function — no side effects.
 */
export function categorizePay(input: CategorizePayInputs): TaxCategoryBreakdown {
    const mwe = isMWEExempt(input.employee);

    // 1. Basic compensation
    const basicPay = mwe ? 0 : round2(input.basicPay);
    const mweBasic = mwe ? round2(input.basicPay) : 0;

    // 2. Time-based earnings — exempt under MWE
    const overtimeRaw = input.overtimePay ?? 0;
    const holidayRaw = input.holidayPay ?? 0;
    const nightDiffRaw = input.nightDiff ?? 0;
    const hazardRaw = input.hazardPay ?? 0;

    const overtimePay = mwe ? 0 : round2(overtimeRaw);
    const mweOvertimePay = mwe ? round2(overtimeRaw) : 0;
    const holidayPay = mwe ? 0 : round2(holidayRaw);
    const mweHolidayPay = mwe ? round2(holidayRaw) : 0;
    const nightDiff = mwe ? 0 : round2(nightDiffRaw);
    const mweNightDiff = mwe ? round2(nightDiffRaw) : 0;
    const hazardPay = mwe ? 0 : round2(hazardRaw);
    const mweHazardPay = mwe ? round2(hazardRaw) : 0;

    // 3. 13th-month + bonuses — ₱90k annual ceiling
    const thirteenth = round2(input.thirteenthMonth ?? 0);
    const ytdNonTaxable = round2(input.ytdThirteenthMonthNonTaxable ?? 0);
    const remainingHeadroom = Math.max(0, THIRTEENTH_MONTH_CEILING - ytdNonTaxable);
    const thirteenthMonthNonTaxable = Math.min(thirteenth, remainingHeadroom);
    const thirteenthMonthTaxable = round2(thirteenth - thirteenthMonthNonTaxable);

    // 4. De minimis (RR 11-2018) — apply caps; excess → taxable
    const dm = input.deMinimis ?? {};
    const rice = capExcess(dm.riceSubsidy ?? 0, DE_MINIMIS_CAPS.riceSubsidyMonthly);
    const med = capExcess(
        dm.medicalAllowance ?? 0,
        DE_MINIMIS_CAPS.medicalAllowanceQuarterly,
    );
    const laundry = capExcess(
        dm.laundryAllowance ?? 0,
        DE_MINIMIS_CAPS.laundryAllowanceMonthly,
    );
    const uniform = capExcess(
        dm.uniformAllowance ?? 0,
        DE_MINIMIS_CAPS.uniformAllowanceYearly,
    );
    const mealCap =
        typeof dm.mealAllowanceCap === "number" && dm.mealAllowanceCap > 0
            ? dm.mealAllowanceCap
            : Number.POSITIVE_INFINITY;
    const meal = capExcess(dm.mealAllowance ?? 0, mealCap);
    const other = capExcess(dm.other ?? 0, Number.POSITIVE_INFINITY);

    const deMinimisRiceSubsidy = rice.allowed;
    const deMinimisMedicalAllowance = med.allowed;
    const deMinimisLaundryAllowance = laundry.allowed;
    const deMinimisUniformAllowance = uniform.allowed;
    const deMinimisMealAllowance = meal.allowed;
    const deMinimisOther = other.allowed;
    const deMinimisExcess = round2(
        rice.excess +
            med.excess +
            laundry.excess +
            uniform.excess +
            meal.excess +
            other.excess,
    );

    // 5. Allowances
    const taxableAllowances = round2(
        (input.taxableAllowances ?? 0) + deMinimisExcess,
    );
    const nonTaxableAllowances = round2(input.nonTaxableAllowances ?? 0);

    // 6. Statutory contributions — non-taxable
    const sssContribution = round2(input.sss);
    const philhealthContribution = round2(input.philHealth);
    const pagibigContribution = round2(input.pagIBIG);
    const unionDues = round2(input.unionDues ?? 0);

    // 7. Withholding
    const withholdingTax = round2(input.withholdingTax);

    // 8. Roll-up totals
    const taxableTotal = round2(
        basicPay +
            overtimePay +
            holidayPay +
            nightDiff +
            hazardPay +
            thirteenthMonthTaxable +
            taxableAllowances,
    );
    const nonTaxableTotal = round2(
        mweBasic +
            mweOvertimePay +
            mweHolidayPay +
            mweNightDiff +
            mweHazardPay +
            thirteenthMonthNonTaxable +
            deMinimisRiceSubsidy +
            deMinimisMedicalAllowance +
            deMinimisLaundryAllowance +
            deMinimisUniformAllowance +
            deMinimisMealAllowance +
            deMinimisOther +
            nonTaxableAllowances +
            sssContribution +
            philhealthContribution +
            pagibigContribution +
            unionDues,
    );

    return {
        basicPay,
        mweBasic,
        overtimePay,
        mweOvertimePay,
        holidayPay,
        mweHolidayPay,
        nightDiff,
        mweNightDiff,
        hazardPay,
        mweHazardPay,
        thirteenthMonth: thirteenth,
        thirteenthMonthTaxable,
        thirteenthMonthNonTaxable,
        deMinimisRiceSubsidy,
        deMinimisMedicalAllowance,
        deMinimisLaundryAllowance,
        deMinimisUniformAllowance,
        deMinimisMealAllowance,
        deMinimisOther,
        deMinimisExcess,
        taxableAllowances,
        nonTaxableAllowances,
        sssContribution,
        philhealthContribution,
        pagibigContribution,
        unionDues,
        withholdingTax,
        taxableTotal,
        nonTaxableTotal,
    };
}

/** Sum tax categories across many payslips for an employee in a year. */
export function aggregateCategories(
    payslips: Payslip[],
): TaxCategoryBreakdown {
    const acc: TaxCategoryBreakdown = emptyBreakdown();
    for (const p of payslips) {
        const c = p.taxCategories;
        if (!c) continue;
        (Object.keys(acc) as Array<keyof TaxCategoryBreakdown>).forEach((k) => {
            acc[k] = round2((acc[k] as number) + ((c[k] as number) ?? 0));
        });
    }
    return acc;
}

export function emptyBreakdown(): TaxCategoryBreakdown {
    return {
        basicPay: 0,
        mweBasic: 0,
        overtimePay: 0,
        mweOvertimePay: 0,
        holidayPay: 0,
        mweHolidayPay: 0,
        nightDiff: 0,
        mweNightDiff: 0,
        hazardPay: 0,
        mweHazardPay: 0,
        thirteenthMonth: 0,
        thirteenthMonthTaxable: 0,
        thirteenthMonthNonTaxable: 0,
        deMinimisRiceSubsidy: 0,
        deMinimisMedicalAllowance: 0,
        deMinimisLaundryAllowance: 0,
        deMinimisUniformAllowance: 0,
        deMinimisMealAllowance: 0,
        deMinimisOther: 0,
        deMinimisExcess: 0,
        taxableAllowances: 0,
        nonTaxableAllowances: 0,
        sssContribution: 0,
        philhealthContribution: 0,
        pagibigContribution: 0,
        unionDues: 0,
        withholdingTax: 0,
        taxableTotal: 0,
        nonTaxableTotal: 0,
    };
}

// ── helpers ─────────────────────────────────────────────────
function round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function capExcess(value: number, cap: number): { allowed: number; excess: number } {
    if (!Number.isFinite(value) || value <= 0) return { allowed: 0, excess: 0 };
    if (cap === Number.POSITIVE_INFINITY) return { allowed: round2(value), excess: 0 };
    if (value <= cap) return { allowed: round2(value), excess: 0 };
    return { allowed: round2(cap), excess: round2(value - cap) };
}

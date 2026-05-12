/**
 * Annual Tax Engine — Year-End Reconciliation
 * --------------------------------------------------------------
 * Aggregates a full year of categorized payslips into an `AnnualTaxSummary`,
 * folds in any previous-employer income, computes annual TRAIN tax due, and
 * determines the over/under-withheld adjustment.
 *
 * Reference: bir_alphalist.md §4 (Annual reconciliation)
 */

import type {
    Payslip,
    PreviousEmployerRecord,
    AnnualTaxSummary,
    AnnualTaxAdjustmentType,
} from "@/types";
import { aggregateCategories } from "./bir-tax-categories";
import { reconcileAnnualTax } from "./bir-tax-rules";

export interface BuildAnnualSummaryInput {
    employeeId: string;
    year: number;
    payslips: Payslip[];                    // pre-filtered to that employee+year
    prevEmployerRecords?: PreviousEmployerRecord[];
    existingId?: string;                    // for updates
    existingCreatedAt?: string;
}

/**
 * Build (or refresh) an `AnnualTaxSummary` from categorized payslips.
 * Returns a new object with status='reconciled' — caller decides when to finalize.
 */
export function buildAnnualSummary(
    input: BuildAnnualSummaryInput,
): AnnualTaxSummary {
    const totals = aggregateCategories(input.payslips);
    const prevIncome = sum(input.prevEmployerRecords?.map((r) => r.totalIncome) ?? []);
    const prevTax = sum(input.prevEmployerRecords?.map((r) => r.totalTaxWithheld) ?? []);

    // Annual taxable = current-employer taxable + prev-employer income
    // (per BIR Form 2316 line 21–24 — both employers' compensation aggregated)
    const annualTaxable = totals.taxableTotal + prevIncome;

    const { annualTaxDue, adjustment, type } = reconcileAnnualTax(
        annualTaxable,
        totals.withholdingTax + prevTax,
    );

    const now = new Date().toISOString();
    return {
        id: input.existingId ?? `ATS-${input.employeeId}-${input.year}`,
        employeeId: input.employeeId,
        year: input.year,
        totalTaxableComp: round2(totals.taxableTotal),
        totalNonTaxableComp: round2(totals.nonTaxableTotal),
        totalDeMinimis: round2(
            totals.deMinimisRiceSubsidy +
                totals.deMinimisMedicalAllowance +
                totals.deMinimisLaundryAllowance +
                totals.deMinimisUniformAllowance +
                totals.deMinimisMealAllowance +
                totals.deMinimisOther,
        ),
        totalSSS: round2(totals.sssContribution),
        totalPhilHealth: round2(totals.philhealthContribution),
        totalPagIBIG: round2(totals.pagibigContribution),
        total13thNonTaxable: round2(totals.thirteenthMonthNonTaxable),
        total13thTaxable: round2(totals.thirteenthMonthTaxable),
        totalOtherBenefits: round2(
            totals.taxableAllowances + totals.nonTaxableAllowances,
        ),
        totalTaxWithheld: round2(totals.withholdingTax),
        prevEmployerIncome: round2(prevIncome),
        prevEmployerTax: round2(prevTax),
        annualTaxDue: round2(annualTaxDue),
        adjustmentType: type as AnnualTaxAdjustmentType,
        adjustmentAmount: round2(adjustment),
        status: "reconciled",
        createdAt: input.existingCreatedAt ?? now,
        updatedAt: now,
    };
}

function sum(nums: number[]): number {
    return nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function round2(n: number): number {
    return Math.round((n ?? 0) * 100) / 100;
}

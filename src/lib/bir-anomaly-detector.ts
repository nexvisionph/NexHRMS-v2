/**
 * Anomaly Detector
 * --------------------------------------------------------------
 * Lightweight rule-based anomaly checks layered on top of the validation
 * engine. Designed to surface oddities that aren't strict BIR errors but
 * are worth a payroll/finance officer's attention.
 *
 * Reference: bir_alphalist.md §6 (Anomaly detection)
 */

import type {
    AnnualTaxSummary,
    Employee,
    BIRValidationIssue,
} from "@/types";

export interface AnomalyContext {
    employees: Employee[];
    summaries: AnnualTaxSummary[];
    /** Optional prior-year summaries for YoY comparison. */
    priorYearSummaries?: AnnualTaxSummary[];
}

export function detectAnomalies(ctx: AnomalyContext): BIRValidationIssue[] {
    const issues: BIRValidationIssue[] = [];
    const empById = new Map(ctx.employees.map((e) => [e.id, e]));
    const priorByEmp = new Map(
        (ctx.priorYearSummaries ?? []).map((s) => [s.employeeId, s]),
    );

    for (const s of ctx.summaries) {
        const emp = empById.get(s.employeeId);
        if (!emp) continue;

        // 1. Tax-to-income ratio outliers (very high)
        const ratio =
            s.totalTaxableComp > 0 ? s.totalTaxWithheld / s.totalTaxableComp : 0;
        if (ratio > 0.4) {
            issues.push({
                severity: "warning",
                code: "ANOMALY_HIGH_TAX_RATIO",
                message: `${emp.name}: tax withheld is ${(ratio * 100).toFixed(1)}% of taxable compensation (>40%). Verify computations.`,
                employeeId: emp.id,
            });
        }

        // 2. Year-over-year compensation spike
        const prior = priorByEmp.get(s.employeeId);
        if (prior && prior.totalTaxableComp > 0) {
            const yoy =
                (s.totalTaxableComp - prior.totalTaxableComp) /
                prior.totalTaxableComp;
            if (yoy > 1.0) {
                issues.push({
                    severity: "info",
                    code: "ANOMALY_COMP_SPIKE",
                    message: `${emp.name}: taxable compensation more than doubled YoY (+${(yoy * 100).toFixed(0)}%).`,
                    employeeId: emp.id,
                });
            } else if (yoy < -0.5) {
                issues.push({
                    severity: "info",
                    code: "ANOMALY_COMP_DROP",
                    message: `${emp.name}: taxable compensation dropped >50% YoY (${(yoy * 100).toFixed(0)}%).`,
                    employeeId: emp.id,
                });
            }
        }

        // 3. Large unexplained adjustment
        if (Math.abs(s.adjustmentAmount ?? 0) > 50_000) {
            issues.push({
                severity: "warning",
                code: "ANOMALY_LARGE_ADJUSTMENT",
                message: `${emp.name}: year-end adjustment of ₱${Math.abs(
                    s.adjustmentAmount ?? 0,
                ).toLocaleString("en-PH")} exceeds ₱50,000.`,
                employeeId: emp.id,
            });
        }

        // 4. Zero withholding on substantial taxable comp
        if (s.totalTaxableComp > 250_000 && s.totalTaxWithheld < 1) {
            issues.push({
                severity: "warning",
                code: "ANOMALY_NO_WITHHOLDING",
                message: `${emp.name}: ₱${s.totalTaxableComp.toLocaleString(
                    "en-PH",
                )} taxable compensation but no tax was withheld.`,
                employeeId: emp.id,
            });
        }
    }

    return issues;
}

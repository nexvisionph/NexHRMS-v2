/**
 * BIR Validation
 * --------------------------------------------------------------
 * Pre-export checks for Alphalist / Form 2316 / annual summaries.
 *
 * Reference: bir_alphalist.md §6 (Validation rules)
 */

import type {
    Employee,
    EmployeeTaxProfile,
    AnnualTaxSummary,
    BIRValidationIssue,
} from "@/types";

export interface ValidationContext {
    employees: Employee[];
    profiles: EmployeeTaxProfile[];
    summaries: AnnualTaxSummary[];
    year: number;
}

/** Validate Alphalist readiness — employees in `summaries` must have profiles + TIN. */
export function validateAlphalist(ctx: ValidationContext): BIRValidationIssue[] {
    const issues: BIRValidationIssue[] = [];
    const empById = new Map(ctx.employees.map((e) => [e.id, e]));
    const profileByEmp = new Map(ctx.profiles.map((p) => [p.employeeId, p]));
    const tinSeen = new Map<string, string>();

    for (const s of ctx.summaries) {
        const emp = empById.get(s.employeeId);
        const profile = profileByEmp.get(s.employeeId);

        if (!emp) {
            issues.push({
                severity: "error",
                code: "EMPLOYEE_NOT_FOUND",
                message: `Annual summary references missing employee ${s.employeeId}.`,
                employeeId: s.employeeId,
            });
            continue;
        }

        if (!profile) {
            issues.push({
                severity: "error",
                code: "PROFILE_MISSING",
                message: `${emp.name} has no BIR tax profile.`,
                employeeId: emp.id,
                suggestedFix: "Open the employee's BIR Profile and save before exporting.",
            });
            continue;
        }

        // TIN format
        if (!profile.tin) {
            issues.push({
                severity: "error",
                code: "TIN_MISSING",
                message: `${emp.name} is missing a TIN.`,
                employeeId: emp.id,
                field: "tin",
            });
        } else if (!isValidTinFormat(profile.tin)) {
            issues.push({
                severity: "error",
                code: "TIN_INVALID",
                message: `${emp.name}: TIN format invalid (got "${profile.tin}", expect NNN-NNN-NNN-NNN).`,
                employeeId: emp.id,
                field: "tin",
                value: profile.tin,
            });
        } else {
            // Duplicate TIN detection
            const dup = tinSeen.get(profile.tin);
            if (dup && dup !== emp.id) {
                issues.push({
                    severity: "error",
                    code: "TIN_DUPLICATE",
                    message: `Duplicate TIN ${profile.tin} on ${emp.name} and another employee.`,
                    employeeId: emp.id,
                    field: "tin",
                });
            } else {
                tinSeen.set(profile.tin, emp.id);
            }
        }

        // Negative tax due
        if ((s.totalTaxWithheld ?? 0) < 0) {
            issues.push({
                severity: "error",
                code: "TAX_WITHHELD_NEGATIVE",
                message: `${emp.name}: total tax withheld is negative.`,
                employeeId: emp.id,
            });
        }
        if ((s.totalTaxableComp ?? 0) < 0) {
            issues.push({
                severity: "error",
                code: "TAXABLE_NEGATIVE",
                message: `${emp.name}: total taxable compensation is negative.`,
                employeeId: emp.id,
            });
        }

        // MWE consistency: MWE should generally have zero withholding
        if (profile.isMWE && (s.totalTaxWithheld ?? 0) > 1) {
            issues.push({
                severity: "warning",
                code: "MWE_TAX_WITHHELD",
                message: `${emp.name} is MWE but tax was withheld (₱${(s.totalTaxWithheld ?? 0).toFixed(2)}). Verify classification.`,
                employeeId: emp.id,
            });
        }

        // 13th-month ceiling sanity
        if ((s.total13thNonTaxable ?? 0) > 90_000.01) {
            issues.push({
                severity: "error",
                code: "THIRTEENTH_MONTH_CEILING_EXCEEDED",
                message: `${emp.name}: 13th-month non-taxable portion exceeds ₱90,000 ceiling.`,
                employeeId: emp.id,
            });
        }

        // Adjustment over-withheld but no refund logged
        if (
            s.adjustmentType === "over_withheld" &&
            Math.abs(s.adjustmentAmount ?? 0) > 0 &&
            s.status === "open"
        ) {
            issues.push({
                severity: "info",
                code: "REFUND_PENDING",
                message: `${emp.name}: refund of ₱${Math.abs(s.adjustmentAmount ?? 0).toFixed(2)} pending — finalize before export.`,
                employeeId: emp.id,
            });
        }

        // Status sanity for export
        if (s.status === "open") {
            issues.push({
                severity: "warning",
                code: "SUMMARY_NOT_RECONCILED",
                message: `${emp.name}: annual summary still open — should be at least 'reconciled' before export.`,
                employeeId: emp.id,
            });
        }
    }

    return issues;
}

export function summarize(issues: BIRValidationIssue[]): {
    errors: number;
    warnings: number;
    infos: number;
    status: "passed" | "has_warnings" | "has_errors";
} {
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const infos = issues.filter((i) => i.severity === "info").length;
    const status: "passed" | "has_warnings" | "has_errors" =
        errors > 0 ? "has_errors" : warnings > 0 ? "has_warnings" : "passed";
    return { errors, warnings, infos, status };
}

export function isValidTinFormat(tin: string): boolean {
    return /^\d{3}-\d{3}-\d{3}-\d{3}$/.test(tin);
}

/**
 * MWE (Minimum Wage Earner) Rules — RA 9504
 * --------------------------------------------------------------
 * MWEs are exempt from withholding tax on:
 *   - basic minimum wage
 *   - holiday pay
 *   - overtime pay
 *   - night-shift differential
 *   - hazard pay
 *
 * Statutory contributions (SSS/PhilHealth/Pag-IBIG) are still required.
 *
 * Region-specific minimum wages are set by NCR / Regional Tripartite Wages
 * and Productivity Boards. We treat `mweDailyRate` on the employee record
 * as the authoritative threshold — admins set this when classifying as MWE.
 *
 * Reference: bir_alphalist.md §4 (MWE rules)
 */

import type { Employee } from "@/types";

/**
 * Returns true if employee qualifies as Minimum Wage Earner exempt from
 * withholding tax under RA 9504.
 *
 * Conservative implementation: requires explicit `isMWE = true` flag on the
 * employee. Admins must classify via the BIR Tax Profile UI; we do not infer.
 */
export function isMWEExempt(
    employee: Pick<Employee, "isMWE" | "mweDailyRate" | "salary">,
): boolean {
    return employee.isMWE === true;
}

/**
 * Validate a claimed MWE classification — ensures monthly equivalent of the
 * employee's salary does not exceed the regional minimum wage by a wide margin
 * (sanity check; DOLE wage orders define regional minimums).
 *
 * Returns warnings if classification looks suspicious; not a hard reject.
 */
export interface MWEValidationResult {
    valid: boolean;
    warnings: string[];
}

export function validateMWEClassification(
    employee: Pick<Employee, "isMWE" | "mweDailyRate" | "salary">,
    workDaysPerMonth = 22,
): MWEValidationResult {
    const warnings: string[] = [];
    if (!employee.isMWE) return { valid: true, warnings };

    if (!employee.mweDailyRate || employee.mweDailyRate <= 0) {
        warnings.push(
            "MWE classification requires mweDailyRate (regional minimum wage) to be set.",
        );
    } else {
        const expectedMonthly = employee.mweDailyRate * workDaysPerMonth;
        // Allow 10% tolerance for differential rates (e.g. allowances baked in).
        if (employee.salary > expectedMonthly * 1.1) {
            warnings.push(
                `Employee monthly salary ₱${employee.salary.toFixed(2)} exceeds expected MWE ceiling ` +
                    `₱${expectedMonthly.toFixed(2)} (daily ${employee.mweDailyRate} × ${workDaysPerMonth} days). ` +
                    `Verify MWE classification.`,
            );
        }
    }

    return { valid: warnings.length === 0, warnings };
}

/**
 * BIR Alphalist Generator
 * Generates the alphabetical list of employees for BIR annual filing (Form 1604-CF).
 * The alphalist contains compensation data for all employees during the taxable year.
 */

import type { Employee, Payslip } from "@/types";
import type { AlphalistEntry } from "@/store/bir-compliance.store";
import { NON_TAXABLE_LIMITS } from "./annual-tax-engine";

// ─── Alphalist Schedule Types ────────────────────────────────

export type AlphalistSchedule =
  | "7.1"   // Employees with tax withheld
  | "7.2"   // Employees with no tax withheld (MWE)
  | "7.3"   // Employees terminated before Dec 31
  | "7.4"   // Employees with previous employer
  | "7.5";  // Minimum wage earners

export interface AlphalistConfig {
  year: number;
  companyName: string;
  companyTIN: string;
  companyAddress: string;
  companyZipCode: string;
  rdoCode: string;
  categoryOfAgent: string;
}

export interface AlphalistOutput {
  schedule: AlphalistSchedule;
  entries: AlphalistEntry[];
  totalCompensation: number;
  totalNonTaxable: number;
  totalTaxable: number;
  totalTaxWithheld: number;
  employeeCount: number;
}

// ─── Generator Functions ─────────────────────────────────────

/**
 * Generate alphalist entries from employee and payslip data
 */
export function generateAlphalist(
  employees: Employee[],
  payslips: Payslip[],
  config: AlphalistConfig
): AlphalistOutput[] {
  const results: AlphalistOutput[] = [];

  // Group payslips by employee
  const payslipsByEmployee = new Map<string, Payslip[]>();
  for (const ps of payslips) {
    const year = new Date(ps.periodStart).getFullYear();
    if (year !== config.year) continue;
    const existing = payslipsByEmployee.get(ps.employeeId) || [];
    existing.push(ps);
    payslipsByEmployee.set(ps.employeeId, existing);
  }

  // Build entries for each employee
  const allEntries: AlphalistEntry[] = [];

  for (const emp of employees) {
    const empPayslips = payslipsByEmployee.get(emp.id) || [];
    if (empPayslips.length === 0) continue;

    const totalGross = empPayslips.reduce((sum, ps) => sum + ps.grossPay, 0);
    const totalSSS = empPayslips.reduce((sum, ps) => sum + ps.sssDeduction, 0);
    const totalPhilHealth = empPayslips.reduce((sum, ps) => sum + ps.philhealthDeduction, 0);
    const totalPagIBIG = empPayslips.reduce((sum, ps) => sum + ps.pagibigDeduction, 0);
    const totalTax = empPayslips.reduce((sum, ps) => sum + ps.taxDeduction, 0);

    // Compute non-taxable (13th month + mandatory contributions)
    const mandatoryContributions = totalSSS + totalPhilHealth + totalPagIBIG;
    const thirteenthMonthExempt = Math.min(
      emp.salary, // Approximate 13th month as 1 month salary
      NON_TAXABLE_LIMITS.thirteenthMonthAndBenefits
    );
    const nonTaxableIncome = mandatoryContributions + thirteenthMonthExempt;
    const taxableIncome = Math.max(0, totalGross - nonTaxableIncome);

    // Determine tax category
    const isMWE = emp.deductionExempt && emp.deductionExemptReason?.includes("Minimum wage");
    const taxCategory = isMWE ? "exempt" as const : "compensation" as const;

    allEntries.push({
      employeeId: emp.id,
      employeeName: emp.name,
      tin: "", // TIN should come from employee profile
      totalCompensation: Math.round(totalGross * 100) / 100,
      nonTaxableIncome: Math.round(nonTaxableIncome * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      taxWithheld: Math.round(totalTax * 100) / 100,
      taxCategory,
    });
  }

  // Sort alphabetically
  allEntries.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  // Schedule 7.1 — Employees with tax withheld
  const withTax = allEntries.filter((e) => e.taxWithheld > 0 && e.taxCategory !== "exempt");
  if (withTax.length > 0) {
    results.push({
      schedule: "7.1",
      entries: withTax,
      totalCompensation: withTax.reduce((s, e) => s + e.totalCompensation, 0),
      totalNonTaxable: withTax.reduce((s, e) => s + e.nonTaxableIncome, 0),
      totalTaxable: withTax.reduce((s, e) => s + e.taxableIncome, 0),
      totalTaxWithheld: withTax.reduce((s, e) => s + e.taxWithheld, 0),
      employeeCount: withTax.length,
    });
  }

  // Schedule 7.2 — Employees with no tax withheld (non-MWE)
  const noTaxNonMWE = allEntries.filter((e) => e.taxWithheld === 0 && e.taxCategory !== "exempt");
  if (noTaxNonMWE.length > 0) {
    results.push({
      schedule: "7.2",
      entries: noTaxNonMWE,
      totalCompensation: noTaxNonMWE.reduce((s, e) => s + e.totalCompensation, 0),
      totalNonTaxable: noTaxNonMWE.reduce((s, e) => s + e.nonTaxableIncome, 0),
      totalTaxable: noTaxNonMWE.reduce((s, e) => s + e.taxableIncome, 0),
      totalTaxWithheld: 0,
      employeeCount: noTaxNonMWE.length,
    });
  }

  // Schedule 7.5 — Minimum wage earners
  const mwe = allEntries.filter((e) => e.taxCategory === "exempt");
  if (mwe.length > 0) {
    results.push({
      schedule: "7.5",
      entries: mwe,
      totalCompensation: mwe.reduce((s, e) => s + e.totalCompensation, 0),
      totalNonTaxable: mwe.reduce((s, e) => s + e.nonTaxableIncome, 0),
      totalTaxable: 0,
      totalTaxWithheld: 0,
      employeeCount: mwe.length,
    });
  }

  return results;
}

/**
 * Export alphalist data to CSV format
 */
export function exportAlphalistToCSV(output: AlphalistOutput): string {
  const headers = [
    "Employee Name",
    "TIN",
    "Total Compensation",
    "Non-Taxable Income",
    "Taxable Income",
    "Tax Withheld",
    "Tax Category",
  ];

  const rows = output.entries.map((e) => [
    `"${e.employeeName}"`,
    e.tin || "N/A",
    e.totalCompensation.toFixed(2),
    e.nonTaxableIncome.toFixed(2),
    e.taxableIncome.toFixed(2),
    e.taxWithheld.toFixed(2),
    e.taxCategory,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

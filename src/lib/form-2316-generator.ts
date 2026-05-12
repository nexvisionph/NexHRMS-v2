/**
 * BIR Form 2316 Generator
 * Certificate of Compensation Payment/Tax Withheld
 * Generated annually for each employee.
 */

import type { Employee, Payslip } from "@/types";
import type { Form2316Data } from "@/store/bir-compliance.store";
import { computeAnnualTax, NON_TAXABLE_LIMITS } from "./annual-tax-engine";

// ─── Form 2316 Configuration ─────────────────────────────────

export interface Form2316Config {
  employer: {
    name: string;
    tin: string;
    address: string;
    zipCode: string;
    rdoCode: string;
    categoryOfAgent: string;
  };
  year: number;
}

// ─── Generator ───────────────────────────────────────────────

/**
 * Generate Form 2316 data for a single employee
 */
export function generateForm2316(
  employee: Employee,
  payslips: Payslip[],
  config: Form2316Config
): Omit<Form2316Data, "id" | "generatedAt"> {
  // Filter payslips for the target year
  const yearPayslips = payslips.filter((ps) => {
    const year = new Date(ps.periodStart).getFullYear();
    return year === config.year && ps.employeeId === employee.id;
  });

  // Aggregate compensation data
  const totalGross = yearPayslips.reduce((sum, ps) => sum + ps.grossPay, 0);
  const totalSSS = yearPayslips.reduce((sum, ps) => sum + ps.sssDeduction, 0);
  const totalPhilHealth = yearPayslips.reduce((sum, ps) => sum + ps.philhealthDeduction, 0);
  const totalPagIBIG = yearPayslips.reduce((sum, ps) => sum + ps.pagibigDeduction, 0);
  const totalTax = yearPayslips.reduce((sum, ps) => sum + ps.taxDeduction, 0);
  const totalAllowances = yearPayslips.reduce((sum, ps) => sum + ps.allowances, 0);

  // Estimate 13th month pay (1 month basic salary)
  const thirteenthMonthPay = employee.salary;

  // Compute non-taxable income
  const mandatoryContributions = totalSSS + totalPhilHealth + totalPagIBIG;
  const thirteenthMonthExempt = Math.min(thirteenthMonthPay, NON_TAXABLE_LIMITS.thirteenthMonthAndBenefits);
  const nonTaxableIncome = mandatoryContributions + thirteenthMonthExempt;

  // Compute taxable income
  const taxableIncome = Math.max(0, totalGross - nonTaxableIncome);

  // Compute annual tax
  const taxResult = computeAnnualTax({
    grossCompensation: totalGross,
    thirteenthMonthPay,
    otherNonTaxableBenefits: totalAllowances > thirteenthMonthExempt ? 0 : totalAllowances,
    sssContributions: totalSSS,
    philhealthContributions: totalPhilHealth,
    pagibigContributions: totalPagIBIG,
    taxAlreadyWithheld: totalTax,
    isMinimumWageEarner: employee.deductionExempt,
  });

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    tin: "", // Should come from employee profile
    year: config.year,
    employer: config.employer,
    compensation: {
      basicSalary: Math.round(totalGross * 100) / 100,
      thirteenthMonth: Math.round(thirteenthMonthPay * 100) / 100,
      otherBenefits: Math.round(totalAllowances * 100) / 100,
      totalCompensation: Math.round((totalGross + thirteenthMonthPay) * 100) / 100,
      nonTaxableIncome: Math.round(nonTaxableIncome * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
    },
    deductions: {
      sss: Math.round(totalSSS * 100) / 100,
      philhealth: Math.round(totalPhilHealth * 100) / 100,
      pagibig: Math.round(totalPagIBIG * 100) / 100,
      totalDeductions: Math.round(mandatoryContributions * 100) / 100,
    },
    tax: {
      taxDue: taxResult.annualTaxDue,
      taxWithheld: Math.round(totalTax * 100) / 100,
      overUnderWithholding: taxResult.overUnderWithholding,
    },
    status: "generated",
  };
}

/**
 * Generate Form 2316 for all employees
 */
export function generateBulkForm2316(
  employees: Employee[],
  payslips: Payslip[],
  config: Form2316Config
): Omit<Form2316Data, "id" | "generatedAt">[] {
  return employees
    .filter((emp) => emp.status === "active" || emp.resignedAt)
    .map((emp) => generateForm2316(emp, payslips, config));
}

/**
 * Validate Form 2316 data for anomalies
 */
export function validateForm2316(data: Form2316Data): string[] {
  const issues: string[] = [];

  if (!data.tin) {
    issues.push("Missing TIN number");
  }

  if (data.compensation.taxableIncome < 0) {
    issues.push("Negative taxable income detected");
  }

  if (data.tax.taxDue < 0) {
    issues.push("Negative tax due computed");
  }

  const tolerance = 100; // Allow ₱100 tolerance
  if (Math.abs(data.tax.overUnderWithholding) > data.tax.taxDue * 0.1 && Math.abs(data.tax.overUnderWithholding) > tolerance) {
    issues.push(`Significant over/under withholding: ₱${data.tax.overUnderWithholding.toFixed(2)}`);
  }

  if (data.compensation.totalCompensation === 0) {
    issues.push("Zero total compensation — verify employment period");
  }

  return issues;
}

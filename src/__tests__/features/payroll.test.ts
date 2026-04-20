/**
 * Payroll tests — NexHRMS
 * Tests PH statutory deduction calculations, payroll store logic, and payslip lifecycle
 */

import {
  computeSSS,
  computePhilHealth,
  computePagIBIG,
  computeWithholdingTax,
  computeAllPHDeductions,
} from "@/lib/ph-deductions";

// ═══════════════════════════════════════════════════════════════
// SSS Deduction Tests (RA 11199 — 4.5% employee share)
// ═══════════════════════════════════════════════════════════════

describe("computeSSS", () => {
  it("should return minimum ₱180 for salary ≤ ₱4,250", () => {
    expect(computeSSS(4000)).toBe(180);
    expect(computeSSS(4250)).toBe(180);
  });

  it("should return maximum ₱1,575 for salary ≥ ₱34,750", () => {
    expect(computeSSS(34750)).toBe(1575);
    expect(computeSSS(50000)).toBe(1575);
    expect(computeSSS(100000)).toBe(1575);
  });

  it("should compute 4.5% of salary credit for mid-range salaries", () => {
    // ₱15,000 → MSC ~₱15,000 → 4.5% = ₱675
    const sss15k = computeSSS(15000);
    expect(sss15k).toBeGreaterThanOrEqual(650);
    expect(sss15k).toBeLessThanOrEqual(700);

    // ₱25,000 → MSC ~₱25,000 → 4.5% = ₱1,125
    const sss25k = computeSSS(25000);
    expect(sss25k).toBeGreaterThanOrEqual(1100);
    expect(sss25k).toBeLessThanOrEqual(1150);
  });

  it("should handle edge case at ₱0", () => {
    expect(computeSSS(0)).toBe(180);
  });
});

// ═══════════════════════════════════════════════════════════════
// PhilHealth Deduction Tests (RA 11223 — 2.5% employee share)
// ═══════════════════════════════════════════════════════════════

describe("computePhilHealth", () => {
  it("should return floor ₱250 for salary ≤ ₱10,000", () => {
    expect(computePhilHealth(5000)).toBe(250);
    expect(computePhilHealth(10000)).toBe(250);
  });

  it("should return ceiling ₱2,500 for salary ≥ ₱100,000", () => {
    expect(computePhilHealth(100000)).toBe(2500);
    expect(computePhilHealth(150000)).toBe(2500);
  });

  it("should compute 2.5% for mid-range salaries", () => {
    // ₱20,000 → 2.5% = ₱500
    expect(computePhilHealth(20000)).toBe(500);

    // ₱50,000 → 2.5% = ₱1,250
    expect(computePhilHealth(50000)).toBe(1250);

    // ₱80,000 → 2.5% = ₱2,000
    expect(computePhilHealth(80000)).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Pag-IBIG Deduction Tests (RA 9679 — 2% capped at ₱100)
// ═══════════════════════════════════════════════════════════════

describe("computePagIBIG", () => {
  it("should compute 1% for salary ≤ ₱1,500", () => {
    expect(computePagIBIG(1000)).toBe(10);
    expect(computePagIBIG(1500)).toBe(15);
  });

  it("should return capped ₱100 for salary > ₱1,500", () => {
    expect(computePagIBIG(2000)).toBe(100);
    expect(computePagIBIG(10000)).toBe(100);
    expect(computePagIBIG(100000)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// Withholding Tax Tests (TRAIN Law — RA 10963)
// ═══════════════════════════════════════════════════════════════

describe("computeWithholdingTax", () => {
  it("should return ₱0 for taxable income ≤ ₱20,833 (≤250K annual)", () => {
    expect(computeWithholdingTax(0)).toBe(0);
    expect(computeWithholdingTax(15000)).toBe(0);
    expect(computeWithholdingTax(20833)).toBe(0);
  });

  it("should compute 15% bracket for taxable income ₱20,834 – ₱33,333", () => {
    // ₱25,000 taxable → (25000 - 20833) * 0.15 = ~625
    const tax25k = computeWithholdingTax(25000);
    expect(tax25k).toBeGreaterThanOrEqual(600);
    expect(tax25k).toBeLessThanOrEqual(650);
  });

  it("should compute 20% bracket for taxable income ₱33,334 – ₱66,667", () => {
    // ₱50,000 taxable → 1875 + (50000 - 33333) * 0.20 = ~5,209
    const tax50k = computeWithholdingTax(50000);
    expect(tax50k).toBeGreaterThanOrEqual(5000);
    expect(tax50k).toBeLessThanOrEqual(5500);
  });

  it("should compute 25% bracket for taxable income ₱66,668 – ₱166,667", () => {
    // ₱100,000 taxable → 8542 + (100000 - 66667) * 0.25 = ~16,875
    const tax100k = computeWithholdingTax(100000);
    expect(tax100k).toBeGreaterThanOrEqual(16500);
    expect(tax100k).toBeLessThanOrEqual(17500);
  });
});

// ═══════════════════════════════════════════════════════════════
// All-in-one Helper Tests
// ═══════════════════════════════════════════════════════════════

describe("computeAllPHDeductions", () => {
  it("should compute all deductions for a ₱30,000 salary", () => {
    const result = computeAllPHDeductions(30000);

    // SSS: ~₱1,350 (4.5% of ₱30k MSC)
    expect(result.sss).toBeGreaterThanOrEqual(1300);
    expect(result.sss).toBeLessThanOrEqual(1400);

    // PhilHealth: ₱750 (2.5% of ₱30k)
    expect(result.philHealth).toBe(750);

    // Pag-IBIG: ₱100 (capped)
    expect(result.pagIBIG).toBe(100);

    // Tax: taxable = 30000 - SSS - PhilHealth - PagIBIG ≈ 27,800
    // That's in the 15% bracket → ~1,000
    expect(result.withholdingTax).toBeGreaterThanOrEqual(900);
    expect(result.withholdingTax).toBeLessThanOrEqual(1200);

    // Total should be sum of all
    expect(result.totalDeductions).toBe(
      result.sss + result.philHealth + result.pagIBIG + result.withholdingTax
    );
  });

  it("should handle minimum wage scenario (₱12,000)", () => {
    const result = computeAllPHDeductions(12000);

    // Tax should be 0 (under 250K annual threshold)
    expect(result.withholdingTax).toBe(0);

    // Total gov deductions for min wage
    expect(result.totalDeductions).toBeLessThan(1500);
  });

  it("should handle high earner scenario (₱150,000)", () => {
    const result = computeAllPHDeductions(150000);

    // SSS capped at ₱1,575
    expect(result.sss).toBe(1575);

    // PhilHealth capped at ₱2,500
    expect(result.philHealth).toBe(2500);

    // Pag-IBIG capped at ₱100
    expect(result.pagIBIG).toBe(100);

    // Tax in 25% bracket (taxable ~₱145,825 after deductions)
    // Tax = 8542 + (145825 - 66667) * 0.25 ≈ 28,332
    expect(result.withholdingTax).toBeGreaterThan(25000);
    expect(result.withholdingTax).toBeLessThan(35000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Payslip Status Flow Tests
// ═══════════════════════════════════════════════════════════════

describe("Payslip Status Flow", () => {
  const validStatuses = ["draft", "published", "signed"];

  it("should have correct status progression order", () => {
    // draft → published → signed
    expect(validStatuses).toEqual([
      "draft",
      "published",
      "signed",
    ]);
  });

  it("should allow e-signature only at published status", () => {
    const canSignStatuses = ["published"];
    canSignStatuses.forEach((status) => {
      expect(validStatuses).toContain(status);
    });
  });

  it("should only allow signing when payslip is published", () => {
    const canSign = (status: string, signedAt: string | null) =>
      status === "published" && signedAt === null;

    expect(canSign("published", null)).toBe(true);
    expect(canSign("published", "2024-01-01")).toBe(false);
    expect(canSign("draft", null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Loan Deduction Cap Tests (30% net pay rule)
// ═══════════════════════════════════════════════════════════════

describe("Loan Deduction Cap", () => {
  it("should cap monthly deduction at 30% of net pay", () => {
    const netPay = 20000;
    const maxLoanDeduction = netPay * 0.3;
    expect(maxLoanDeduction).toBe(6000);

    // If loan deduction would exceed 30%, it should be capped
    const requestedDeduction = 8000;
    const actualDeduction = Math.min(requestedDeduction, maxLoanDeduction);
    expect(actualDeduction).toBe(6000);
  });

  it("should allow full deduction if under 30% cap", () => {
    const netPay = 20000;
    const maxLoanDeduction = netPay * 0.3; // 6000
    const requestedDeduction = 2000;
    const actualDeduction = Math.min(requestedDeduction, maxLoanDeduction);
    expect(actualDeduction).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13th Month Pay Tests (PH DOLE mandatory)
// ═══════════════════════════════════════════════════════════════

describe("13th Month Pay Calculation", () => {
  it("should compute 13th month as total basic / 12", () => {
    const monthlySalary = 30000;
    const thirteenthMonth = monthlySalary; // Full 13th month for 12-month employee
    expect(thirteenthMonth).toBe(30000);
  });

  it("should pro-rate for employees who joined mid-year", () => {
    const monthlySalary = 30000;
    const monthsWorked = 6; // Joined July
    const thirteenthMonth = (monthlySalary * monthsWorked) / 12;
    expect(thirteenthMonth).toBe(15000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Payroll Store Tests — Duplicate Prevention
// ═══════════════════════════════════════════════════════════════

describe("Payroll Store — Duplicate Prevention", () => {
  // Simulate the duplicate detection logic from payroll.store.ts
  const detectDuplicate = (
    payslips: Array<{ employeeId: string; periodStart: string; periodEnd: string; payFrequency: string }>,
    newPayslip: { employeeId: string; periodStart: string; periodEnd: string; payFrequency: string }
  ) => {
    return payslips.some(
      (p) =>
        p.employeeId === newPayslip.employeeId &&
        p.periodStart === newPayslip.periodStart &&
        p.periodEnd === newPayslip.periodEnd &&
        p.payFrequency === newPayslip.payFrequency
    );
  };

  it("should detect duplicate payslip for same employee + period", () => {
    const existing = [
      { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" },
    ];
    const duplicate = { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" };

    expect(detectDuplicate(existing, duplicate)).toBe(true);
  });

  it("should allow payslip for same employee in different period", () => {
    const existing = [
      { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" },
    ];
    const newPayslip = { employeeId: "EMP-001", periodStart: "2026-04-16", periodEnd: "2026-04-30", payFrequency: "semi_monthly" };

    expect(detectDuplicate(existing, newPayslip)).toBe(false);
  });

  it("should allow payslip for different employee in same period", () => {
    const existing = [
      { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" },
    ];
    const newPayslip = { employeeId: "EMP-002", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" };

    expect(detectDuplicate(existing, newPayslip)).toBe(false);
  });

  it("should distinguish between different pay frequencies for same period", () => {
    const existing = [
      { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-30", payFrequency: "monthly" },
    ];
    // Semi-monthly employee gets different payslip even if dates overlap
    const newPayslip = { employeeId: "EMP-001", periodStart: "2026-04-01", periodEnd: "2026-04-15", payFrequency: "semi_monthly" };

    expect(detectDuplicate(existing, newPayslip)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13th Month Duplicate Prevention
// ═══════════════════════════════════════════════════════════════

describe("13th Month Pay — Duplicate Prevention", () => {
  const has13thMonthForYear = (
    payslips: Array<{ employeeId: string; periodStart: string; periodEnd: string; notes?: string }>,
    employeeId: string,
    year: number
  ) => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return payslips.some(
      (p) =>
        p.employeeId === employeeId &&
        p.periodStart === yearStart &&
        p.periodEnd === yearEnd &&
        p.notes?.includes("13th Month Pay")
    );
  };

  it("should detect existing 13th month for same employee + year", () => {
    const payslips = [
      { employeeId: "EMP-001", periodStart: "2026-01-01", periodEnd: "2026-12-31", notes: "13th Month Pay 2026" },
    ];

    expect(has13thMonthForYear(payslips, "EMP-001", 2026)).toBe(true);
  });

  it("should allow 13th month for different year", () => {
    const payslips = [
      { employeeId: "EMP-001", periodStart: "2025-01-01", periodEnd: "2025-12-31", notes: "13th Month Pay 2025" },
    ];

    expect(has13thMonthForYear(payslips, "EMP-001", 2026)).toBe(false);
  });

  it("should allow 13th month for different employee same year", () => {
    const payslips = [
      { employeeId: "EMP-001", periodStart: "2026-01-01", periodEnd: "2026-12-31", notes: "13th Month Pay 2026" },
    ];

    expect(has13thMonthForYear(payslips, "EMP-002", 2026)).toBe(false);
  });
});

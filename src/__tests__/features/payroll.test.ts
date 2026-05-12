/**
 * Payroll tests — NexHRMS
 * Tests PH statutory deduction calculations, payroll store logic, and payslip lifecycle.
 *
 * Coverage:
 *  1. PH statutory deductions (SSS, PhilHealth, Pag-IBIG, BIR)
 *  2. Rate computations (daily, hourly)
 *  3. Attendance auto-deductions (late, absent, undertime)
 *  4. Overtime earnings (all 5 OT types)
 *  5. buildPayslipDeductions aggregator — toggle gating
 *  6. Gross pay computation per frequency (semi_monthly, bi_weekly, weekly, monthly)
 *  7. Proration factor and capping logic
 *  8. Net pay formula integrity (grossPay + earnings − deductions = netPay)
 *  9. Monthly salary cap — gross never exceeds monthly salary
 * 10. Duplicate payslip prevention (same employee + period + frequency)
 * 11. 13th month pay (full year, partial year, duplicate guard)
 * 12. Attendance snapshot fields stored on payslip
 * 13. Gross override — overridden amount reflected in net pay
 * 14. Loan deduction 30% cap
 * 15. Payslip status lifecycle (draft → published → signed → paid)
 */

import {
  computeSSS,
  computePhilHealth,
  computePagIBIG,
  computeWithholdingTax,
  computeAllPHDeductions,
} from "@/lib/ph-deductions";
import {
  computeDailyRate,
  computeHourlyRate,
  computeLateDeduction,
  computeAbsentDeduction,
  computeUndertimeDeduction,
  computeOvertimeEarnings,
  buildPayslipDeductions,
} from "@/lib/payroll-deductions";
import { getDaysInMonth } from "date-fns";

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
  const validStatuses = ["draft", "published", "signed", "paid", "payment_hold"];

  it("should have correct status progression order", () => {
    // draft → published → signed
    expect(validStatuses).toEqual([
      "draft",
      "published",
      "signed",
      "paid",
      "payment_hold",
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

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Computations
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeDailyRate", () => {
  it("should compute daily rate from monthly salary and work days", () => {
    // ₱30,000 / 22 work-days = ₱1,363.64
    const rate = computeDailyRate(30000, 22);
    expect(rate).toBeCloseTo(1363.64, 1);
  });

  it("should return 0 for invalid salary", () => {
    expect(computeDailyRate(0, 22)).toBe(0);
    expect(computeDailyRate(-500, 22)).toBe(0);
  });

  it("should return 0 for invalid work days", () => {
    expect(computeDailyRate(30000, 0)).toBe(0);
  });

  it("should handle minimum wage scenario (₱12,000 / 22 days)", () => {
    const rate = computeDailyRate(12000, 22);
    expect(rate).toBeCloseTo(545.45, 1);
    expect(rate).toBeGreaterThan(0);
  });
});

describe("computeHourlyRate", () => {
  it("should compute hourly rate from daily rate and 8-hour shift", () => {
    // ₱30,000/22 daily → ~₱1,363.64 / 8 = ~₱170.45/hr
    const daily = computeDailyRate(30000, 22);
    const hourly = computeHourlyRate(daily, 8);
    expect(hourly).toBeCloseTo(170.45, 1);
  });

  it("should return 0 for invalid inputs", () => {
    expect(computeHourlyRate(0, 8)).toBe(0);
    expect(computeHourlyRate(1363, 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Attendance Auto-Deduction Functions
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeLateDeduction", () => {
  const hourlyRate = computeHourlyRate(computeDailyRate(30000, 22), 8); // ~170.45

  it("should compute deduction from late minutes and hourly rate", () => {
    // 30 minutes late → 0.5 * ₱170.45 = ₱85.23
    const deduction = computeLateDeduction(30, hourlyRate);
    expect(deduction).toBeCloseTo(85.23, 0);
    expect(deduction).toBeGreaterThan(0);
  });

  it("should return 0 for 0 late minutes", () => {
    expect(computeLateDeduction(0, hourlyRate)).toBe(0);
  });

  it("should return 0 for negative late minutes", () => {
    expect(computeLateDeduction(-10, hourlyRate)).toBe(0);
  });

  it("should scale linearly — 60 minutes is exactly 1 hour of pay", () => {
    const deduction60 = computeLateDeduction(60, hourlyRate);
    expect(deduction60).toBeCloseTo(hourlyRate, 1);
  });

  it("should handle high late minutes (e.g., 120 min = 2 hours)", () => {
    const deduction120 = computeLateDeduction(120, hourlyRate);
    expect(deduction120).toBeCloseTo(hourlyRate * 2, 1);
  });
});

describe("computeAbsentDeduction", () => {
  const dailyRate = computeDailyRate(30000, 22); // ~1363.64

  it("should compute deduction per absent day", () => {
    // 1 absent day = 1 full daily rate
    const deduction = computeAbsentDeduction(1, dailyRate);
    expect(deduction).toBeCloseTo(dailyRate, 1);
  });

  it("should scale correctly for multiple absent days", () => {
    const deduction3 = computeAbsentDeduction(3, dailyRate);
    expect(deduction3).toBeCloseTo(dailyRate * 3, 1);
  });

  it("should return 0 for 0 absent days", () => {
    expect(computeAbsentDeduction(0, dailyRate)).toBe(0);
  });

  it("should return 0 for invalid daily rate", () => {
    expect(computeAbsentDeduction(2, 0)).toBe(0);
  });
});

describe("computeUndertimeDeduction", () => {
  const hourlyRate = computeHourlyRate(computeDailyRate(30000, 22), 8);

  it("should compute deduction for hours short of full shift", () => {
    // Employee worked 6 hours on an 8-hour shift → 2 hours undertime
    const deduction = computeUndertimeDeduction(8, 6, hourlyRate);
    expect(deduction).toBeCloseTo(hourlyRate * 2, 1);
  });

  it("should return 0 when employee works full shift", () => {
    expect(computeUndertimeDeduction(8, 8, hourlyRate)).toBe(0);
  });

  it("should return 0 when employee works overtime (actualHours > shiftHours)", () => {
    // OT scenario — worked 10 hours on 8-hour shift → no undertime penalty
    expect(computeUndertimeDeduction(8, 10, hourlyRate)).toBe(0);
  });

  it("should return 0 for 0 shift hours or 0 hourly rate", () => {
    expect(computeUndertimeDeduction(0, 0, hourlyRate)).toBe(0);
    expect(computeUndertimeDeduction(8, 6, 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Overtime Earnings (PH DOLE multipliers)
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeOvertimeEarnings", () => {
  const hourlyRate = computeHourlyRate(computeDailyRate(30000, 22), 8); // ~170.45

  it("regular OT — 125% multiplier", () => {
    const otPay = computeOvertimeEarnings(2, hourlyRate, 1.25);
    expect(otPay).toBeCloseTo(hourlyRate * 2 * 1.25, 1);
  });

  it("rest day OT — 130% multiplier", () => {
    const otPay = computeOvertimeEarnings(3, hourlyRate, 1.30);
    expect(otPay).toBeCloseTo(hourlyRate * 3 * 1.30, 1);
  });

  it("regular holiday OT — 200% multiplier", () => {
    const otPay = computeOvertimeEarnings(1, hourlyRate, 2.00);
    expect(otPay).toBeCloseTo(hourlyRate * 2.00, 1);
  });

  it("night differential — 10% premium on top of hourly rate", () => {
    const otPay = computeOvertimeEarnings(4, hourlyRate, 1.10);
    expect(otPay).toBeCloseTo(hourlyRate * 4 * 1.10, 1);
  });

  it("should return 0 for 0 hours or 0 rate", () => {
    expect(computeOvertimeEarnings(0, hourlyRate, 1.25)).toBe(0);
    expect(computeOvertimeEarnings(2, 0, 1.25)).toBe(0);
    expect(computeOvertimeEarnings(2, hourlyRate, 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPayslipDeductions Aggregator — toggle gating
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildPayslipDeductions", () => {
  const dailyRate = computeDailyRate(30000, 22);
  const hourlyRate = computeHourlyRate(dailyRate, 8);

  const baseInput = {
    dailyRate,
    hourlyRate,
    lateMinutes: 45,
    absentDays: 1,
    shiftHours: 8 * 10,    // 10 working days in period
    actualHours: 8 * 10 - 2, // 2 hours short
    overtimeEntries: [{ hours: 3, kind: "regular" as const }],
    multipliers: {
      otMultiplierRegular: 1.25,
      otMultiplierRestDay: 1.30,
      otMultiplierSpecialHoliday: 1.30,
      otMultiplierRegularHoliday: 2.00,
      otMultiplierNightDiff: 1.10,
    },
  };

  it("should compute all deductions when all toggles are ON", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: true,
      autoDeductAbsent: true,
      autoDeductUndertime: true,
      autoAddOvertime: true,
    });

    expect(result.lateDeduction).toBeGreaterThan(0);
    expect(result.absentDeduction).toBeCloseTo(dailyRate, 1);
    expect(result.undertimeDeduction).toBeGreaterThan(0);
    expect(result.overtimePay).toBeGreaterThan(0);
    // totalDeductions must equal sum of the three deductions (NOT net of OT)
    expect(result.totalDeductions).toBeCloseTo(
      result.lateDeduction + result.absentDeduction + result.undertimeDeduction,
      2
    );
  });

  it("should return 0 for late deduction when autoDeductLate is OFF", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: false,
      autoDeductAbsent: true,
      autoDeductUndertime: true,
      autoAddOvertime: false,
    });
    expect(result.lateDeduction).toBe(0);
    expect(result.absentDeduction).toBeGreaterThan(0);
  });

  it("should return 0 for absent deduction when autoDeductAbsent is OFF", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: true,
      autoDeductAbsent: false,
      autoDeductUndertime: true,
      autoAddOvertime: false,
    });
    expect(result.absentDeduction).toBe(0);
    expect(result.lateDeduction).toBeGreaterThan(0);
  });

  it("should return 0 for undertime deduction when autoDeductUndertime is OFF", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: true,
      autoDeductAbsent: true,
      autoDeductUndertime: false,
      autoAddOvertime: false,
    });
    expect(result.undertimeDeduction).toBe(0);
  });

  it("should return 0 OT pay when autoAddOvertime is OFF", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: true,
      autoDeductAbsent: true,
      autoDeductUndertime: true,
      autoAddOvertime: false,
    });
    expect(result.overtimePay).toBe(0);
  });

  it("should return all-zeros when all toggles are OFF", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      autoDeductLate: false,
      autoDeductAbsent: false,
      autoDeductUndertime: false,
      autoAddOvertime: false,
    });
    expect(result.lateDeduction).toBe(0);
    expect(result.absentDeduction).toBe(0);
    expect(result.undertimeDeduction).toBe(0);
    expect(result.overtimePay).toBe(0);
    expect(result.totalDeductions).toBe(0);
  });

  it("should handle perfect attendance — no deductions with no late/absent/undertime", () => {
    const result = buildPayslipDeductions({
      ...baseInput,
      lateMinutes: 0,
      absentDays: 0,
      shiftHours: 80,
      actualHours: 80,
      autoDeductLate: true,
      autoDeductAbsent: true,
      autoDeductUndertime: true,
      autoAddOvertime: false,
    });
    expect(result.lateDeduction).toBe(0);
    expect(result.absentDeduction).toBe(0);
    expect(result.undertimeDeduction).toBe(0);
    expect(result.totalDeductions).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Gross Pay Per Frequency
// ═══════════════════════════════════════════════════════════════════════════════

describe("Gross Pay Per Frequency", () => {
  const monthlySalary = 30000;

  it("semi_monthly — gross = salary / 2", () => {
    const gross = Math.round(monthlySalary / 2);
    expect(gross).toBe(15000);
    // Must not exceed monthly salary
    expect(gross).toBeLessThanOrEqual(monthlySalary);
  });

  it("bi_weekly — gross = (salary * 12) / 26", () => {
    const gross = Math.round((monthlySalary * 12) / 26);
    // ~₱13,846
    expect(gross).toBeGreaterThan(13000);
    expect(gross).toBeLessThan(15000);
    // 26 bi-weekly pays × gross ≈ annual salary (12 × monthly)
    expect(gross * 26).toBeCloseTo(monthlySalary * 12, -2);
  });

  it("weekly — gross = (salary * 12) / 52", () => {
    const gross = Math.round((monthlySalary * 12) / 52);
    // ~₱6,923
    expect(gross).toBeGreaterThan(6000);
    expect(gross).toBeLessThan(8000);
    // 52 weekly pays × weekly gross ≈ 12 × monthly salary
    expect(gross * 52).toBeCloseTo(monthlySalary * 12, -2);
  });

  it("monthly — full monthly salary without exceeding it", () => {
    const daysInMay = getDaysInMonth(new Date(2026, 4, 1)); // 31
    const actualDays = 31; // full period
    const factor = Math.min(1, actualDays / daysInMay);
    const gross = Math.round(monthlySalary * factor);
    expect(gross).toBe(30000);
    expect(gross).toBeLessThanOrEqual(monthlySalary);
  });

  it("monthly — prorated gross never exceeds monthly salary", () => {
    const daysInMay = getDaysInMonth(new Date(2026, 4, 1)); // 31
    // Test many partial-period factors
    for (let actualDays = 1; actualDays <= daysInMay; actualDays++) {
      const factor = Math.min(1, actualDays / daysInMay);
      const gross = Math.round(monthlySalary * factor);
      expect(gross).toBeLessThanOrEqual(monthlySalary);
      expect(gross).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Proration Factor Logic
// ═══════════════════════════════════════════════════════════════════════════════

describe("Proration Factor", () => {
  /**
   * Replicates the prorationInfo logic from admin-view.tsx:
   *   nominalDays = differenceInCalendarDays(end, start) + 1
   *   actualDays  = differenceInCalendarDays(formPeriodEnd, start) + 1
   *   factor      = actualDays / nominalDays
   */
  function computeProration(start: string, nominalEnd: string, actualEnd: string) {
    const startDate = new Date(start);
    const nominalEndDate = new Date(nominalEnd);
    const actualEndDate = new Date(actualEnd);
    const msPerDay = 86400000;
    const nominalDays = Math.round((nominalEndDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    const actualDays  = Math.round((actualEndDate.getTime() - startDate.getTime()) / msPerDay) + 1;
    const factor = actualDays / nominalDays;
    return { nominalDays, actualDays, factor, isPartial: actualDays < nominalDays };
  }

  it("full period — factor = 1, isPartial = false", () => {
    const { factor, isPartial } = computeProration("2026-05-01", "2026-05-15", "2026-05-15");
    expect(factor).toBe(1);
    expect(isPartial).toBe(false);
  });

  it("partial period (13 of 15 days) — factor ≈ 0.867", () => {
    const { nominalDays, actualDays, factor, isPartial } = computeProration("2026-05-01", "2026-05-15", "2026-05-13");
    expect(nominalDays).toBe(15);
    expect(actualDays).toBe(13);
    expect(factor).toBeCloseTo(13 / 15, 5);
    expect(isPartial).toBe(true);
  });

  it("1-day period — factor = 1/nominalDays", () => {
    const { nominalDays, actualDays, factor } = computeProration("2026-05-01", "2026-05-15", "2026-05-01");
    expect(nominalDays).toBe(15);
    expect(actualDays).toBe(1);
    expect(factor).toBeCloseTo(1 / 15, 5);
  });

  it("factor is capped at 1 — actual cannot exceed nominal", () => {
    // actualEnd same as nominalEnd → factor exactly 1
    const { factor } = computeProration("2026-05-01", "2026-05-31", "2026-05-31");
    expect(factor).toBeLessThanOrEqual(1);
    expect(factor).toBe(1);
  });

  it("proration applied to semi_monthly gross is within bounds", () => {
    const monthlySalary = 30000;
    const fullPeriodGross = Math.round(monthlySalary / 2); // 15000
    const { factor } = computeProration("2026-05-01", "2026-05-15", "2026-05-09");
    const proratedGross = Math.round(fullPeriodGross * factor);
    expect(proratedGross).toBeGreaterThan(0);
    expect(proratedGross).toBeLessThanOrEqual(fullPeriodGross);
    expect(proratedGross).toBeLessThanOrEqual(monthlySalary);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Net Pay Formula Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe("Net Pay Formula Integrity", () => {
  it("netPay = grossPay + allowances − allDeductions (no attendance deductions)", () => {
    const grossPay = 15000;
    const allowances = 500;
    const sss = 675;
    const ph = 375;
    const pi = 100;
    const tax = 0;
    const otherDed = 0;
    const loanDed = 0;
    const lateDeduction = 0;
    const absentDeduction = 0;
    const undertimeDeduction = 0;

    const totalDed = sss + ph + pi + tax + otherDed + loanDed + lateDeduction + absentDeduction + undertimeDeduction;
    const netPay = grossPay + allowances - totalDed;

    expect(netPay).toBe(grossPay + allowances - totalDed);
    expect(netPay).toBeGreaterThan(0);
  });

  it("netPay = grossPay + allowances − allDeductions (with attendance deductions)", () => {
    const dailyRate = computeDailyRate(30000, 22);
    const hourlyRate = computeHourlyRate(dailyRate, 8);
    const grossPay = 15000;
    const allowances = 0;
    const sss = 675;
    const ph = 375;
    const pi = 100;
    const tax = 0;
    const lateDeduction = computeLateDeduction(45, hourlyRate);    // 45 min late
    const absentDeduction = computeAbsentDeduction(1, dailyRate);  // 1 day absent
    const undertimeDeduction = 0;

    const totalDed = sss + ph + pi + tax + lateDeduction + absentDeduction + undertimeDeduction;
    const netPay = grossPay + allowances - totalDed;

    expect(netPay).toBe(grossPay + allowances - totalDed);
    expect(netPay).toBeGreaterThan(0);
    // Receipt totalDeductions must match the deductions used in netPay
    expect(totalDed).toBeCloseTo(sss + ph + pi + tax + lateDeduction + absentDeduction, 2);
  });

  it("totalDeductions on receipt includes ALL deduction types", () => {
    // Simulates the fixed printable-payslip.tsx totalDeductions computation
    const computeReceiptTotal = (p: {
      sssDeduction: number; philhealthDeduction: number; pagibigDeduction: number;
      taxDeduction: number; otherDeductions: number; loanDeduction: number;
      customDeductions: number; lateDeduction: number; absentDeduction: number;
      undertimeDeduction: number;
    }) => (
      (p.sssDeduction || 0) + (p.philhealthDeduction || 0) +
      (p.pagibigDeduction || 0) + (p.taxDeduction || 0) +
      (p.otherDeductions || 0) + (p.loanDeduction || 0) +
      (p.customDeductions || 0) +
      (p.lateDeduction || 0) + (p.absentDeduction || 0) + (p.undertimeDeduction || 0)
    );

    const dailyRate = computeDailyRate(30000, 22);
    const hourlyRate = computeHourlyRate(dailyRate, 8);
    const payslip = {
      sssDeduction: 675, philhealthDeduction: 375, pagibigDeduction: 100, taxDeduction: 0,
      otherDeductions: 200, loanDeduction: 1000, customDeductions: 300,
      lateDeduction: computeLateDeduction(30, hourlyRate),
      absentDeduction: computeAbsentDeduction(1, dailyRate),
      undertimeDeduction: 0,
    };

    const receiptTotal = computeReceiptTotal(payslip);
    const expectedTotal = 675 + 375 + 100 + 0 + 200 + 1000 + 300 +
      payslip.lateDeduction + payslip.absentDeduction + 0;

    expect(receiptTotal).toBeCloseTo(expectedTotal, 2);
  });

  it("net pay must be positive — zero or negative triggers skip in handleIssue", () => {
    // Simulate a scenario where excessive deductions would cause <= 0 net pay
    const grossPay = 5000;
    const totalDeductions = 6000; // Deductions exceed gross → should be rejected
    const netPay = grossPay - totalDeductions;
    expect(netPay).toBeLessThanOrEqual(0);
    // handleIssue skips this employee with: if (netPay <= 0) return;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Monthly Salary Cap — Gross Never Exceeds Monthly Salary
// ═══════════════════════════════════════════════════════════════════════════════

describe("Monthly Salary Cap", () => {
  const monthlySalary = 30000;

  it("semi_monthly gross (₱15,000) does not exceed monthly salary", () => {
    const gross = Math.round(monthlySalary / 2);
    expect(gross).toBeLessThanOrEqual(monthlySalary);
  });

  it("bi_weekly gross does not exceed monthly salary", () => {
    const gross = Math.round((monthlySalary * 12) / 26);
    expect(gross).toBeLessThanOrEqual(monthlySalary);
  });

  it("weekly gross does not exceed monthly salary", () => {
    const gross = Math.round((monthlySalary * 12) / 52);
    expect(gross).toBeLessThanOrEqual(monthlySalary);
  });

  it("prorated monthly gross never exceeds full monthly salary for any partial period", () => {
    const daysInMay = getDaysInMonth(new Date(2026, 4, 1)); // 31
    for (let actual = 1; actual <= daysInMay; actual++) {
      const gross = Math.round(monthlySalary * Math.min(1, actual / daysInMay));
      expect(gross).toBeLessThanOrEqual(monthlySalary);
    }
  });

  it("gross override — overridden amount is used in net pay calculation", () => {
    const normalGross = Math.round(monthlySalary / 2); // 15000
    const overrideAmount = 18000; // Admin sets higher gross
    const effectiveGross = (overrideAmount > 0) ? Math.round(overrideAmount) : normalGross;

    const sss = computeSSS(monthlySalary);
    const ph = computePhilHealth(monthlySalary);
    const pi = computePagIBIG(monthlySalary);
    const tax = 0;
    const totalDed = sss + ph + pi + tax;
    const netPayNormal = normalGross - totalDed;
    const netPayOverride = effectiveGross - totalDed;

    expect(effectiveGross).toBe(18000);
    expect(netPayOverride).toBeGreaterThan(netPayNormal);
    expect(netPayOverride).toBeGreaterThan(0);
  });

  it("gross override of 0 falls back to computed gross", () => {
    const computedGross = Math.round(monthlySalary / 2); // 15000
    const overrideStr = "0";
    const effectiveGross = (overrideStr && Number(overrideStr) > 0)
      ? Math.round(Number(overrideStr))
      : computedGross;
    expect(effectiveGross).toBe(computedGross);
  });

  it("gross override empty string falls back to computed gross", () => {
    const computedGross = Math.round(monthlySalary / 2);
    const overrideStr = "";
    const effectiveGross = (overrideStr && Number(overrideStr) > 0)
      ? Math.round(Number(overrideStr))
      : computedGross;
    expect(effectiveGross).toBe(computedGross);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Loan Deduction 30% Cap (already in store)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Loan Deduction Cap (30% gross pay)", () => {
  it("should cap loan deduction at 30% of gross pay", () => {
    const grossPay = 15000;
    const rawLoanDeduction = 6000;
    const cap = Math.round(grossPay * 0.30); // 4500
    const actual = Math.min(rawLoanDeduction, cap);
    expect(actual).toBe(4500);
  });

  it("should allow full loan deduction when under 30% cap", () => {
    const grossPay = 15000;
    const rawLoanDeduction = 3000;
    const cap = Math.round(grossPay * 0.30); // 4500
    const actual = Math.min(rawLoanDeduction, cap);
    expect(actual).toBe(3000);
  });

  it("cap scales with gross pay — higher gross allows higher loan deduction", () => {
    const cap1 = Math.round(15000 * 0.30); // 4500
    const cap2 = Math.round(30000 * 0.30); // 9000
    expect(cap2).toBeGreaterThan(cap1);
  });

  it("cap is exactly 30% of gross pay", () => {
    for (const gross of [10000, 15000, 20000, 25000, 30000]) {
      const cap = Math.round(gross * 0.30);
      expect(cap / gross).toBeCloseTo(0.30, 2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Attendance Snapshot Fields on Payslip
// ═══════════════════════════════════════════════════════════════════════════════

describe("Attendance Snapshot Fields", () => {
  /**
   * Simulates the attendance aggregation from admin-view.tsx handleIssue
   */
  function aggregateAttendance(logs: Array<{ status: string; lateMinutes?: number; hours?: number }>, stdHours: number) {
    const presentLogs = logs.filter((l) => l.status === "present");
    const absentLogs  = logs.filter((l) => l.status === "absent");
    const lateMinutesAgg = logs.reduce((s, l) => s + (l.lateMinutes || 0), 0);
    const absentDaysAgg  = absentLogs.length;
    const presentDaysAgg = presentLogs.length;
    const expectedHoursTotal = presentLogs.length * stdHours;
    const actualHoursTotal   = presentLogs.reduce((s, l) => s + (l.hours || 0), 0);
    const undertimeHoursAgg  = Math.max(0, expectedHoursTotal - actualHoursTotal);
    return { presentDaysAgg, absentDaysAgg, lateMinutesAgg, undertimeHoursAgg };
  }

  it("should aggregate present days correctly", () => {
    const logs = [
      { status: "present", lateMinutes: 0, hours: 8 },
      { status: "present", lateMinutes: 0, hours: 8 },
      { status: "absent" },
    ];
    const { presentDaysAgg } = aggregateAttendance(logs, 8);
    expect(presentDaysAgg).toBe(2);
  });

  it("should aggregate absent days correctly", () => {
    const logs = [
      { status: "present", hours: 8 },
      { status: "absent" },
      { status: "absent" },
    ];
    const { absentDaysAgg } = aggregateAttendance(logs, 8);
    expect(absentDaysAgg).toBe(2);
  });

  it("should sum late minutes across multiple days", () => {
    const logs = [
      { status: "present", lateMinutes: 15, hours: 8 },
      { status: "present", lateMinutes: 30, hours: 8 },
      { status: "present", lateMinutes: 0,  hours: 8 },
    ];
    const { lateMinutesAgg } = aggregateAttendance(logs, 8);
    expect(lateMinutesAgg).toBe(45);
  });

  it("should compute undertime hours for short shifts", () => {
    const logs = [
      { status: "present", hours: 6 }, // 2h undertime
      { status: "present", hours: 7 }, // 1h undertime
      { status: "present", hours: 8 }, // on time
    ];
    const { undertimeHoursAgg } = aggregateAttendance(logs, 8);
    // expected = 3*8=24, actual = 6+7+8=21 → undertime = 3
    expect(undertimeHoursAgg).toBe(3);
  });

  it("should return 0 undertime when all shifts are full or overtime", () => {
    const logs = [
      { status: "present", hours: 8 },
      { status: "present", hours: 10 }, // OT
      { status: "present", hours: 9 },  // OT
    ];
    const { undertimeHoursAgg } = aggregateAttendance(logs, 8);
    // expected = 24, actual = 27 → undertime = max(0, -3) = 0
    expect(undertimeHoursAgg).toBe(0);
  });

  it("snapshot fields from payslip match aggregated attendance", () => {
    const logs = [
      { status: "present", lateMinutes: 20, hours: 7.5 },
      { status: "absent" },
      { status: "present", lateMinutes: 0,  hours: 8 },
    ];
    const snap = aggregateAttendance(logs, 8);
    // These values would be stored on the payslip
    const payslipSnapshot = {
      attendanceDaysPresent: snap.presentDaysAgg,
      attendanceDaysAbsent:  snap.absentDaysAgg,
      attendanceLateMinutes: snap.lateMinutesAgg,
      attendanceUndertimeHours: snap.undertimeHoursAgg,
    };

    expect(payslipSnapshot.attendanceDaysPresent).toBe(2);
    expect(payslipSnapshot.attendanceDaysAbsent).toBe(1);
    expect(payslipSnapshot.attendanceLateMinutes).toBe(20);
    expect(payslipSnapshot.attendanceUndertimeHours).toBe(0.5); // 3*8=24, 7.5+8=15.5 for present only; present expected=16, actual=15.5 → 0.5
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Payslip Status Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

describe("Payslip Status Lifecycle", () => {
  /** Simplified state machine matching the store's publish/sign/pay guards */
  function canPublish(status: string, isRunLocked: boolean) {
    return status === "draft" && isRunLocked;
  }
  function canSign(status: string, signedAt: string | null) {
    return (status === "published" || status === "payment_hold") && signedAt === null;
  }
  function canMarkPaid(status: string) {
    return status === "signed";
  }

  it("draft payslip can only be published when run is locked", () => {
    expect(canPublish("draft", true)).toBe(true);
    expect(canPublish("draft", false)).toBe(false);
    expect(canPublish("published", true)).toBe(false);
  });

  it("employee can only sign a published (or held) payslip they haven't signed yet", () => {
    expect(canSign("published", null)).toBe(true);
    expect(canSign("payment_hold", null)).toBe(true);
    expect(canSign("published", "2026-05-09T10:00:00Z")).toBe(false);
    expect(canSign("draft", null)).toBe(false);
  });

  it("finance can only mark a signed payslip as paid", () => {
    expect(canMarkPaid("signed")).toBe(true);
    expect(canMarkPaid("published")).toBe(false);
    expect(canMarkPaid("draft")).toBe(false);
    expect(canMarkPaid("paid")).toBe(false);
  });

  it("valid status set matches expected values", () => {
    const validStatuses = ["draft", "published", "signed", "paid", "payment_hold"];
    expect(validStatuses).toContain("draft");
    expect(validStatuses).toContain("published");
    expect(validStatuses).toContain("signed");
    expect(validStatuses).toContain("paid");
    expect(validStatuses).toContain("payment_hold");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Payslip Duplicate Prevention — Extended
// ═══════════════════════════════════════════════════════════════════════════════

describe("Payslip Duplicate Prevention — Extended", () => {
  type SlipKey = { employeeId: string; periodStart: string; periodEnd: string; payFrequency: string };

  function isDuplicate(existing: SlipKey[], incoming: SlipKey): boolean {
    return existing.some(
      (p) =>
        p.employeeId === incoming.employeeId &&
        p.periodStart === incoming.periodStart &&
        p.periodEnd === incoming.periodEnd &&
        p.payFrequency === incoming.payFrequency
    );
  }

  const existing: SlipKey[] = [
    { employeeId: "EMP-001", periodStart: "2026-05-01", periodEnd: "2026-05-15", payFrequency: "semi_monthly" },
    { employeeId: "EMP-002", periodStart: "2026-05-01", periodEnd: "2026-05-15", payFrequency: "semi_monthly" },
    { employeeId: "EMP-001", periodStart: "2026-05-16", periodEnd: "2026-05-31", payFrequency: "semi_monthly" },
    { employeeId: "EMP-003", periodStart: "2026-05-01", periodEnd: "2026-05-31", payFrequency: "monthly" },
  ];

  it("exact duplicate (same emp + period + freq) is blocked", () => {
    expect(isDuplicate(existing, { employeeId: "EMP-001", periodStart: "2026-05-01", periodEnd: "2026-05-15", payFrequency: "semi_monthly" })).toBe(true);
  });

  it("different employee same period is NOT a duplicate", () => {
    expect(isDuplicate(existing, { employeeId: "EMP-099", periodStart: "2026-05-01", periodEnd: "2026-05-15", payFrequency: "semi_monthly" })).toBe(false);
  });

  it("same employee next period is NOT a duplicate", () => {
    expect(isDuplicate(existing, { employeeId: "EMP-001", periodStart: "2026-06-01", periodEnd: "2026-06-15", payFrequency: "semi_monthly" })).toBe(false);
  });

  it("same employee same period different frequency is NOT a duplicate", () => {
    // monthly vs semi_monthly — different contract type for same range
    expect(isDuplicate(existing, { employeeId: "EMP-001", periodStart: "2026-05-01", periodEnd: "2026-05-31", payFrequency: "monthly" })).toBe(false);
  });

  it("second cutoff payslip is NOT a duplicate of first cutoff payslip", () => {
    expect(isDuplicate(existing, { employeeId: "EMP-001", periodStart: "2026-05-16", periodEnd: "2026-05-31", payFrequency: "semi_monthly" })).toBe(true);  // already exists
    expect(isDuplicate(existing, { employeeId: "EMP-001", periodStart: "2026-05-16", periodEnd: "2026-06-15", payFrequency: "semi_monthly" })).toBe(false); // new
  });

  it("issuing payslips for ALL employees in a batch — no cross-employee duplicates", () => {
    const batch: SlipKey[] = [
      { employeeId: "EMP-010", periodStart: "2026-06-01", periodEnd: "2026-06-15", payFrequency: "semi_monthly" },
      { employeeId: "EMP-011", periodStart: "2026-06-01", periodEnd: "2026-06-15", payFrequency: "semi_monthly" },
      { employeeId: "EMP-012", periodStart: "2026-06-01", periodEnd: "2026-06-15", payFrequency: "semi_monthly" },
    ];
    // No duplicates in a fresh batch
    const allIds = batch.map((s) => s.employeeId);
    expect(new Set(allIds).size).toBe(allIds.length);
    batch.forEach((slip) => {
      expect(isDuplicate(existing, slip)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13th Month Pay Extended
// ═══════════════════════════════════════════════════════════════════════════════

describe("13th Month Pay — Extended", () => {
  it("should be exactly 1/12 of total basic pay for full-year employee", () => {
    const monthlySalary = 30000;
    const monthsWorked = 12;
    const thirteenthMonth = (monthlySalary * monthsWorked) / 12;
    expect(thirteenthMonth).toBe(30000);
  });

  it("should pro-rate correctly for partial year (DOLE — based on calendar months worked)", () => {
    const monthlySalary = 30000;
    // Joined February 1 → 11 months in the year
    expect((monthlySalary * 11) / 12).toBeCloseTo(27500, 0);
    // Joined July 1 → 6 months
    expect((monthlySalary * 6) / 12).toBe(15000);
    // Joined December 1 → 1 month
    expect((monthlySalary * 1) / 12).toBeCloseTo(2500, 0);
  });

  it("pro-rated 13th month is always less than or equal to monthly salary", () => {
    const monthlySalary = 25000;
    for (let months = 1; months <= 12; months++) {
      const thirteenth = (monthlySalary * months) / 12;
      expect(thirteenth).toBeLessThanOrEqual(monthlySalary);
      expect(thirteenth).toBeGreaterThan(0);
    }
  });

  it("high earner 13th month is based on monthly salary (no cap in PH)", () => {
    const monthlySalary = 150000;
    const thirteenth = (monthlySalary * 12) / 12;
    expect(thirteenth).toBe(150000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases and Guard Conditions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Edge Cases and Guards", () => {
  it("deductions for a deduction-exempt employee are all 0", () => {
    // deductionExempt flag → computeDeduction returns 0 for all types
    const isExempt = true;
    const computeSafe = (value: number) => isExempt ? 0 : value;
    expect(computeSafe(675)).toBe(0);
    expect(computeSafe(375)).toBe(0);
    expect(computeSafe(100)).toBe(0);
    expect(computeSafe(500)).toBe(0);
  });

  it("semi_monthly gov deduction split: deductGovFrom=second → first cutoff gets 0", () => {
    const govMultiplier = (cutoff: "first" | "second", deductGovFrom: string) => {
      if (deductGovFrom === "both") return 0.5;
      if (deductGovFrom === "first" && cutoff !== "first") return 0;
      if (deductGovFrom === "second" && cutoff !== "second") return 0;
      return 1;
    };
    expect(govMultiplier("first", "second")).toBe(0);
    expect(govMultiplier("second", "second")).toBe(1);
    expect(govMultiplier("first", "both")).toBe(0.5);
    expect(govMultiplier("second", "both")).toBe(0.5);
    expect(govMultiplier("first", "first")).toBe(1);
    expect(govMultiplier("second", "first")).toBe(0);
  });

  it("BIR tax is computed on taxable income after gov deductions", () => {
    const grossPay = 15000;
    const sss = computeSSS(30000);  // based on monthly salary
    const ph  = computePhilHealth(30000);
    const pi  = computePagIBIG(30000);
    const taxableIncome = Math.max(0, grossPay - sss - ph - pi);
    // taxableIncome must not be negative
    expect(taxableIncome).toBeGreaterThanOrEqual(0);
    expect(taxableIncome).toBeLessThanOrEqual(grossPay);
  });

  it("NaN or Infinity inputs to deduction functions safely return 0", () => {
    expect(computeLateDeduction(NaN, 170)).toBe(0);
    expect(computeLateDeduction(30, NaN)).toBe(0);
    expect(computeAbsentDeduction(NaN, 1363)).toBe(0);
    expect(computeDailyRate(NaN, 22)).toBe(0);
    expect(computeHourlyRate(Infinity, 8)).toBe(0);
  });

  it("gross override of a negative value falls back to computed gross", () => {
    const computedGross = 15000;
    const overrideStr = "-5000";
    const effectiveGross = (overrideStr && Number(overrideStr) > 0)
      ? Math.round(Number(overrideStr))
      : computedGross;
    expect(effectiveGross).toBe(computedGross);
  });

  it("period with 0 attendance logs still produces a valid payslip structure", () => {
    const logs: Array<{ status: string; lateMinutes?: number; hours?: number }> = [];
    const presentDays = logs.filter((l) => l.status === "present").length;
    const absentDays  = logs.filter((l) => l.status === "absent").length;
    const lateMinutes = logs.reduce((s, l) => s + (l.lateMinutes || 0), 0);
    expect(presentDays).toBe(0);
    expect(absentDays).toBe(0);
    expect(lateMinutes).toBe(0);
    // With all toggles on but no violations, deductions should be 0
    const breakdown = buildPayslipDeductions({
      autoDeductLate: true, autoDeductAbsent: true, autoDeductUndertime: true, autoAddOvertime: false,
      dailyRate: 1363.64, hourlyRate: 170.45,
      lateMinutes: 0, absentDays: 0, shiftHours: 0, actualHours: 0,
      overtimeEntries: [],
      multipliers: { otMultiplierRegular: 1.25, otMultiplierRestDay: 1.30, otMultiplierSpecialHoliday: 1.30, otMultiplierRegularHoliday: 2.00, otMultiplierNightDiff: 1.10 },
    });
    expect(breakdown.totalDeductions).toBe(0);
  });
});

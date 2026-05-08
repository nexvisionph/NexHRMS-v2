import {
  buildPayslipDeductions,
  computeAbsentDeduction,
  computeDailyRate,
  computeHourlyRate,
  computeLateDeduction,
  computeOvertimeEarnings,
  computeUndertimeDeduction,
  pickMultiplier,
  round2,
  type OvertimeMultipliers,
} from "@/lib/payroll-deductions";

const DOLE_MULTIPLIERS: OvertimeMultipliers = {
  otMultiplierRegular: 1.25,
  otMultiplierRestDay: 1.30,
  otMultiplierSpecialHoliday: 1.30,
  otMultiplierRegularHoliday: 2.00,
  otMultiplierNightDiff: 1.10,
};

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(43.4375)).toBe(43.44);
    expect(round2(43.4349)).toBe(43.43);
  });
  it("clamps invalid/negative inputs to 0", () => {
    expect(round2(NaN)).toBe(0);
    expect(round2(-5)).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe("computeDailyRate", () => {
  it("monthly 15,290 / 22 days = 695", () => {
    expect(computeDailyRate(15290, 22)).toBe(695);
  });
  it("returns 0 for non-positive divisor", () => {
    expect(computeDailyRate(15290, 0)).toBe(0);
    expect(computeDailyRate(15290, -1)).toBe(0);
  });
});

describe("computeHourlyRate", () => {
  it("daily 695 / 8h = 86.88", () => {
    expect(computeHourlyRate(695, 8)).toBe(86.88);
  });
});

describe("computeLateDeduction", () => {
  it("30 late minutes @ ₱86.88/hr = ₱43.44", () => {
    expect(computeLateDeduction(30, 86.88)).toBe(43.44);
  });
  it("0 minutes = 0", () => {
    expect(computeLateDeduction(0, 86.88)).toBe(0);
  });
});

describe("computeAbsentDeduction", () => {
  it("1 absent day @ ₱695 = ₱695", () => {
    expect(computeAbsentDeduction(1, 695)).toBe(695);
  });
  it("3 absent days @ ₱695 = ₱2,085", () => {
    expect(computeAbsentDeduction(3, 695)).toBe(2085);
  });
});

describe("computeUndertimeDeduction", () => {
  it("8h shift, 6h actual @ ₱86.88/hr = ₱173.76", () => {
    expect(computeUndertimeDeduction(8, 6, 86.88)).toBe(173.76);
  });
  it("returns 0 when worked full shift", () => {
    expect(computeUndertimeDeduction(8, 8, 86.88)).toBe(0);
  });
  it("returns 0 when worked overtime (actual > shift)", () => {
    expect(computeUndertimeDeduction(8, 9, 86.88)).toBe(0);
  });
  it("returns 0 for invalid actualHours", () => {
    expect(computeUndertimeDeduction(8, -1, 86.88)).toBe(0);
  });
});

describe("computeOvertimeEarnings", () => {
  it("2h OT @ ₱86.88 × 1.25 = ₱217.20", () => {
    expect(computeOvertimeEarnings(2, 86.88, 1.25)).toBe(217.20);
  });
  it("2h OT on regular holiday @ ₱86.88 × 2.00 = ₱347.52", () => {
    expect(computeOvertimeEarnings(2, 86.88, 2.0)).toBe(347.52);
  });
});

describe("pickMultiplier", () => {
  it("maps each kind to its DOLE default", () => {
    expect(pickMultiplier("regular", DOLE_MULTIPLIERS)).toBe(1.25);
    expect(pickMultiplier("rest_day", DOLE_MULTIPLIERS)).toBe(1.30);
    expect(pickMultiplier("special_holiday", DOLE_MULTIPLIERS)).toBe(1.30);
    expect(pickMultiplier("regular_holiday", DOLE_MULTIPLIERS)).toBe(2.00);
    expect(pickMultiplier("night_diff", DOLE_MULTIPLIERS)).toBe(1.10);
  });
});

describe("buildPayslipDeductions", () => {
  const baseInput = {
    autoDeductLate: true,
    autoDeductAbsent: true,
    autoDeductUndertime: true,
    autoAddOvertime: true,
    dailyRate: 695,
    hourlyRate: 86.88,
    lateMinutes: 30,
    absentDays: 1,
    shiftHours: 8,
    actualHours: 6,
    overtimeEntries: [{ hours: 2, kind: "regular" as const }],
    multipliers: DOLE_MULTIPLIERS,
  };

  it("computes all four lines with all toggles ON", () => {
    const r = buildPayslipDeductions(baseInput);
    expect(r.lateDeduction).toBe(43.44);
    expect(r.absentDeduction).toBe(695);
    expect(r.undertimeDeduction).toBe(173.76);
    expect(r.overtimePay).toBe(217.20);
    expect(r.totalDeductions).toBe(43.44 + 695 + 173.76);
  });

  it("disables late deduction when toggle is OFF", () => {
    const r = buildPayslipDeductions({ ...baseInput, autoDeductLate: false });
    expect(r.lateDeduction).toBe(0);
    expect(r.absentDeduction).toBe(695);
  });

  it("disables OT when autoAddOvertime is OFF", () => {
    const r = buildPayslipDeductions({ ...baseInput, autoAddOvertime: false });
    expect(r.overtimePay).toBe(0);
  });

  it("sums multiple OT entries with mixed kinds", () => {
    const r = buildPayslipDeductions({
      ...baseInput,
      overtimeEntries: [
        { hours: 2, kind: "regular" },          // 2 * 86.88 * 1.25 = 217.20
        { hours: 1, kind: "regular_holiday" },  // 1 * 86.88 * 2.00 = 173.76
      ],
    });
    expect(r.overtimePay).toBe(round2(217.20 + 173.76));
  });
});

/**
 * Unit tests — BIR Tax Categorization, Tax Rules, Annual Engine, Validation
 */

import {
    categorizePay,
    aggregateCategories,
    emptyBreakdown,
    THIRTEENTH_MONTH_CEILING,
} from "@/lib/bir-tax-categories";
import {
    computeAnnualTax,
    reconcileAnnualTax,
    TRAIN_ANNUAL_BRACKETS,
} from "@/lib/bir-tax-rules";
import { buildAnnualSummary } from "@/lib/annual-tax-engine";
import { validateAlphalist, isValidTinFormat, summarize } from "@/lib/bir-validation";
import { buildAlphalist } from "@/lib/alphalist-generator";
import type {
    Employee,
    Payslip,
    EmployeeTaxProfile,
    AnnualTaxSummary,
} from "@/types";

const baseEmployee: Pick<Employee, "id" | "isMWE" | "mweDailyRate" | "salary"> = {
    id: "EMP-1",
    isMWE: false,
    salary: 30_000,
};

const fullEmployee = (overrides: Partial<Employee> = {}): Employee => ({
    id: "EMP-1",
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    role: "employee",
    department: "IT",
    status: "active",
    workType: "WFO",
    salary: 30_000,
    joinDate: "2020-01-01",
    productivity: 0,
    location: "Manila",
    ...overrides,
});

const baseProfile = (overrides: Partial<EmployeeTaxProfile> = {}): EmployeeTaxProfile => ({
    id: "ETP-1",
    employeeId: "EMP-1",
    tin: "123-456-789-000",
    employmentClassification: "R",
    isMWE: false,
    substitutedFiling: true,
    taxStatus: "S",
    taxResidency: "resident",
    prev2316Received: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
});

describe("bir-tax-categories: categorizePay", () => {
    it("buckets a normal regular employee correctly", () => {
        const r = categorizePay({
            employee: baseEmployee,
            basicPay: 30_000,
            sss: 1_350,
            philHealth: 750,
            pagIBIG: 200,
            withholdingTax: 1_500,
        });
        expect(r.basicPay).toBe(30_000);
        expect(r.mweBasic).toBe(0);
        expect(r.sssContribution).toBe(1_350);
        expect(r.taxableTotal).toBeGreaterThan(0);
    });

    it("treats a MWE employee's basic + OT as exempt", () => {
        const r = categorizePay({
            employee: { ...baseEmployee, isMWE: true, mweDailyRate: 610 },
            basicPay: 13_420,
            overtimePay: 800,
            sss: 0,
            philHealth: 0,
            pagIBIG: 0,
            withholdingTax: 0,
        });
        expect(r.basicPay).toBe(0);
        expect(r.mweBasic).toBe(13_420);
        expect(r.mweOvertimePay).toBe(800);
        expect(r.taxableTotal).toBe(0);
    });

    it("applies the ₱90k 13th-month ceiling with YTD tracking", () => {
        // First period: ₱60,000 13th month (under cap)
        const a = categorizePay({
            employee: baseEmployee,
            basicPay: 0,
            thirteenthMonth: 60_000,
            ytdThirteenthMonthNonTaxable: 0,
            sss: 0,
            philHealth: 0,
            pagIBIG: 0,
            withholdingTax: 0,
        });
        expect(a.thirteenthMonthNonTaxable).toBe(60_000);
        expect(a.thirteenthMonthTaxable).toBe(0);

        // Second period: ₱40,000 more — only ₱30k more fits under cap
        const b = categorizePay({
            employee: baseEmployee,
            basicPay: 0,
            thirteenthMonth: 40_000,
            ytdThirteenthMonthNonTaxable: 60_000,
            sss: 0,
            philHealth: 0,
            pagIBIG: 0,
            withholdingTax: 0,
        });
        expect(b.thirteenthMonthNonTaxable).toBe(THIRTEENTH_MONTH_CEILING - 60_000);
        expect(b.thirteenthMonthTaxable).toBe(40_000 - (THIRTEENTH_MONTH_CEILING - 60_000));
    });

    it("aggregateCategories sums properly across payslips", () => {
        const cat = categorizePay({
            employee: baseEmployee, basicPay: 30_000,
            sss: 1_350, philHealth: 750, pagIBIG: 200, withholdingTax: 1_500,
        });
        const mkSlip = (id: string): Payslip => ({
            id,
            employeeId: "EMP-1",
            periodStart: "2025-01-01",
            periodEnd: "2025-01-31",
            grossPay: 30_000,
            allowances: 0,
            sssDeduction: 1_350,
            philhealthDeduction: 750,
            pagibigDeduction: 200,
            taxDeduction: 1_500,
            otherDeductions: 0,
            loanDeduction: 0,
            netPay: 26_200,
            issuedAt: "2025-01-31",
            status: "published",
            taxCategories: cat,
        });
        const sum = aggregateCategories([mkSlip("a"), mkSlip("b")]);
        expect(sum.basicPay).toBeCloseTo(cat.basicPay * 2, 2);
        expect(sum.withholdingTax).toBeCloseTo(3_000, 2);
    });

    it("emptyBreakdown returns zero for everything", () => {
        const e = emptyBreakdown();
        expect(e.basicPay).toBe(0);
        expect(e.taxableTotal).toBe(0);
        expect(e.nonTaxableTotal).toBe(0);
    });
});

describe("bir-tax-rules: TRAIN", () => {
    it("zero tax for income at or below ₱250k", () => {
        expect(computeAnnualTax(0)).toBe(0);
        expect(computeAnnualTax(250_000)).toBe(0);
    });
    it("matches BIR examples for ₱400k", () => {
        // 400k - 250k = 150k * 15% = 22,500
        expect(computeAnnualTax(400_000)).toBeCloseTo(22_500, 0);
    });
    it("hits the top bracket on ₱9M", () => {
        // 9M - 8M = 1M * 35% + 2,202,500 = 2,552,500
        expect(computeAnnualTax(9_000_000)).toBeCloseTo(2_552_500, 0);
    });
    it("brackets are monotonic and cover full range", () => {
        for (let i = 1; i < TRAIN_ANNUAL_BRACKETS.length; i++) {
            expect(TRAIN_ANNUAL_BRACKETS[i].lowerBound).toBeGreaterThan(
                TRAIN_ANNUAL_BRACKETS[i - 1].lowerBound,
            );
        }
    });
    it("reconcileAnnualTax flags over/under withholding", () => {
        const over = reconcileAnnualTax(400_000, 30_000);
        expect(over.type).toBe("over_withheld");
        expect(Math.abs(over.adjustment)).toBeCloseTo(7_500, 0);

        const under = reconcileAnnualTax(400_000, 10_000);
        expect(under.type).toBe("under_withheld");
        expect(under.adjustment).toBeCloseTo(12_500, 0);
    });
});

describe("annual-tax-engine: buildAnnualSummary", () => {
    const psBase: Omit<Payslip, "id"> = {
        employeeId: "EMP-1",
        periodStart: "2025-01-01",
        periodEnd: "2025-01-31",
        grossPay: 30_000,
        allowances: 0,
        sssDeduction: 1_350,
        philhealthDeduction: 750,
        pagibigDeduction: 200,
        taxDeduction: 1_500,
        otherDeductions: 0,
        loanDeduction: 0,
        netPay: 26_200,
        issuedAt: "2025-01-31",
        status: "published",
    };

    it("aggregates 12 months into a reconciled summary", () => {
        const cat = categorizePay({
            employee: baseEmployee, basicPay: 30_000,
            sss: 1_350, philHealth: 750, pagIBIG: 200, withholdingTax: 1_500,
        });
        const payslips: Payslip[] = Array.from({ length: 12 }, (_, i) => ({
            ...psBase,
            id: `PS-${i}`,
            periodStart: `2025-${String(i + 1).padStart(2, "0")}-01`,
            periodEnd: `2025-${String(i + 1).padStart(2, "0")}-28`,
            issuedAt: `2025-${String(i + 1).padStart(2, "0")}-28`,
            taxCategories: cat,
        }));
        const summary = buildAnnualSummary({
            employeeId: "EMP-1",
            year: 2025,
            payslips,
        });
        expect(summary.year).toBe(2025);
        expect(summary.totalSSS).toBeCloseTo(16_200, 0);
        expect(summary.totalTaxWithheld).toBeCloseTo(18_000, 0);
        expect(summary.status).toBe("reconciled");
        expect(summary.annualTaxDue).toBeGreaterThanOrEqual(0);
    });
});

describe("bir-validation", () => {
    it("isValidTinFormat enforces NNN-NNN-NNN-NNN", () => {
        expect(isValidTinFormat("123-456-789-000")).toBe(true);
        expect(isValidTinFormat("123456789000")).toBe(false);
        expect(isValidTinFormat("123-45-789-000")).toBe(false);
    });

    const stubSummary = (employeeId: string, id = `S-${employeeId}`): AnnualTaxSummary => ({
        id, employeeId, year: 2025,
        totalTaxableComp: 360_000, totalNonTaxableComp: 27_600, totalDeMinimis: 0,
        totalSSS: 16_200, totalPhilHealth: 9_000, totalPagIBIG: 2_400,
        total13thNonTaxable: 30_000, total13thTaxable: 0, totalOtherBenefits: 0,
        totalTaxWithheld: 18_000, prevEmployerIncome: 0, prevEmployerTax: 0,
        annualTaxDue: 16_500, status: "finalized",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    it("flags missing TIN as error", () => {
        const issues = validateAlphalist({
            employees: [fullEmployee()],
            profiles: [baseProfile({ tin: undefined })],
            summaries: [stubSummary("EMP-1")],
            year: 2025,
        });
        expect(issues.some((i) => i.code === "TIN_MISSING")).toBe(true);
    });

    it("flags duplicate TINs", () => {
        const issues = validateAlphalist({
            employees: [fullEmployee({ id: "E1" }), fullEmployee({ id: "E2" })],
            profiles: [
                baseProfile({ id: "P1", employeeId: "E1", tin: "123-456-789-000" }),
                baseProfile({ id: "P2", employeeId: "E2", tin: "123-456-789-000" }),
            ],
            summaries: [stubSummary("E1"), stubSummary("E2")],
            year: 2025,
        });
        expect(issues.some((i) => i.code === "TIN_DUPLICATE")).toBe(true);
    });

    it("summarize counts severities", () => {
        const issues = validateAlphalist({
            employees: [fullEmployee()],
            profiles: [baseProfile({ tin: undefined })],
            summaries: [stubSummary("EMP-1")],
            year: 2025,
        });
        const s = summarize(issues);
        expect(s.errors).toBeGreaterThan(0);
        expect(s.status).toBe("has_errors");
    });
});

describe("alphalist-generator", () => {
    it("places active employees in schedule_1 and separated in schedule_2", () => {
        const summary: AnnualTaxSummary = {
            id: "S1",
            employeeId: "EMP-1",
            year: 2025,
            totalTaxableComp: 360_000,
            totalNonTaxableComp: 27_600,
            totalDeMinimis: 0,
            totalSSS: 16_200,
            totalPhilHealth: 9_000,
            totalPagIBIG: 2_400,
            total13thNonTaxable: 30_000,
            total13thTaxable: 0,
            totalOtherBenefits: 0,
            totalTaxWithheld: 18_000,
            prevEmployerIncome: 0,
            prevEmployerTax: 0,
            annualTaxDue: 16_500,
            status: "finalized",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const result = buildAlphalist({
            year: 2025,
            schedule: "both",
            employees: [
                fullEmployee({ id: "EMP-1", name: "Active One" }),
                fullEmployee({ id: "EMP-2", name: "Separated Two" }),
            ],
            profiles: [
                baseProfile({ id: "P1", employeeId: "EMP-1" }),
                baseProfile({
                    id: "P2",
                    employeeId: "EMP-2",
                    separationDate: "2025-06-30",
                    separationType: "resigned",
                }),
            ],
            summaries: [summary, { ...summary, id: "S2", employeeId: "EMP-2" }],
        });
        expect(result.schedule1.length).toBe(1);
        expect(result.schedule2.length).toBe(1);
        expect(result.totals.employeeCount).toBe(2);
    });
});

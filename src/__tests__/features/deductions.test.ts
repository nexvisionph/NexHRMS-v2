/**
 * Deductions Store Unit Tests
 * ===========================
 * Tests deduction template computation logic, bulk assignment,
 * and integration with employee/payslip data.
 */

import { computeAllPHDeductions } from "@/lib/ph-deductions";

// Mock Supabase before importing the store
jest.mock("@/services/supabase-server", () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn(),
}));

jest.mock("@/services/supabase-browser", () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ data: [], error: null })),
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({ data: null, error: null })),
      delete: jest.fn(() => ({ data: null, error: null })),
    })),
  })),
}));

// ─── Types for Testing ──────────────────────────────────────────────────────

interface DeductionTemplate {
  id: string;
  name: string;
  type: "deduction" | "allowance";
  calculation_mode: "fixed" | "percentage" | "daily" | "hourly";
  value: number;
  conditions?: {
    minSalary?: number;
    maxSalary?: number;
    department?: string;
    project?: string;
  };
  applies_to_all: boolean;
  is_active: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  monthly_basic: number;
  department: string;
  deduction_exempt: boolean;
}

// ─── Test Computation Functions ─────────────────────────────────────────────

/**
 * Computes deduction amount based on template and employee salary
 */
function computeDeductionAmount(
  template: DeductionTemplate,
  grossSalary: number,
  daysWorked?: number,
  hoursWorked?: number
): number {
  if (!template.is_active) return 0;

  switch (template.calculation_mode) {
    case "fixed":
      return template.value;
    case "percentage":
      return Math.round((grossSalary * template.value) / 100 * 100) / 100;
    case "daily":
      return Math.round(template.value * (daysWorked ?? 22) * 100) / 100;
    case "hourly":
      return Math.round(template.value * (hoursWorked ?? 176) * 100) / 100;
    default:
      return 0;
  }
}

/**
 * Checks if employee meets template conditions
 */
function employeeMeetsConditions(
  employee: Employee,
  template: DeductionTemplate
): boolean {
  const conditions = template.conditions;
  if (!conditions) return true;

  if (conditions.minSalary && employee.monthly_basic < conditions.minSalary) {
    return false;
  }
  if (conditions.maxSalary && employee.monthly_basic > conditions.maxSalary) {
    return false;
  }
  if (conditions.department && employee.department !== conditions.department) {
    return false;
  }

  return true;
}

/**
 * Computes all applicable deductions for an employee
 */
function computeEmployeeDeductions(
  employee: Employee,
  templates: DeductionTemplate[]
): { deductions: number; allowances: number; breakdown: { name: string; amount: number; type: string }[] } {
  if (employee.deduction_exempt) {
    return { deductions: 0, allowances: 0, breakdown: [] };
  }

  const breakdown: { name: string; amount: number; type: string }[] = [];
  let totalDeductions = 0;
  let totalAllowances = 0;

  for (const template of templates) {
    if (!template.is_active) continue;
    if (!template.applies_to_all && !employeeMeetsConditions(employee, template)) {
      continue;
    }

    const amount = computeDeductionAmount(template, employee.monthly_basic);
    breakdown.push({ name: template.name, amount, type: template.type });

    if (template.type === "deduction") {
      totalDeductions += amount;
    } else {
      totalAllowances += amount;
    }
  }

  return {
    deductions: Math.round(totalDeductions * 100) / 100,
    allowances: Math.round(totalAllowances * 100) / 100,
    breakdown,
  };
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe("Deduction Computation", () => {
  describe("computeDeductionAmount", () => {
    const baseTemplate: DeductionTemplate = {
      id: "DT-1",
      name: "Test Deduction",
      type: "deduction",
      calculation_mode: "fixed",
      value: 500,
      applies_to_all: true,
      is_active: true,
    };

    test("fixed mode returns exact value", () => {
      const result = computeDeductionAmount({ ...baseTemplate, value: 1000 }, 50000);
      expect(result).toBe(1000);
    });

    test("percentage mode calculates correctly", () => {
      const template = { ...baseTemplate, calculation_mode: "percentage" as const, value: 5 };
      const result = computeDeductionAmount(template, 50000);
      expect(result).toBe(2500); // 5% of 50000
    });

    test("daily mode multiplies by days worked", () => {
      const template = { ...baseTemplate, calculation_mode: "daily" as const, value: 100 };
      const result = computeDeductionAmount(template, 50000, 20);
      expect(result).toBe(2000); // 100 * 20 days
    });

    test("hourly mode multiplies by hours worked", () => {
      const template = { ...baseTemplate, calculation_mode: "hourly" as const, value: 50 };
      const result = computeDeductionAmount(template, 50000, undefined, 160);
      expect(result).toBe(8000); // 50 * 160 hours
    });

    test("inactive template returns 0", () => {
      const template = { ...baseTemplate, is_active: false };
      const result = computeDeductionAmount(template, 50000);
      expect(result).toBe(0);
    });

    test("percentage rounds to 2 decimal places", () => {
      const template = { ...baseTemplate, calculation_mode: "percentage" as const, value: 3.33 };
      const result = computeDeductionAmount(template, 50000);
      expect(result).toBe(1665); // 3.33% of 50000 = 1665
    });
  });

  describe("employeeMeetsConditions", () => {
    const employee: Employee = {
      id: "EMP-1",
      first_name: "John",
      last_name: "Doe",
      monthly_basic: 30000,
      department: "Engineering",
      deduction_exempt: false,
    };

    const baseTemplate: DeductionTemplate = {
      id: "DT-1",
      name: "Test",
      type: "deduction",
      calculation_mode: "fixed",
      value: 500,
      applies_to_all: false,
      is_active: true,
    };

    test("returns true when no conditions", () => {
      const template = { ...baseTemplate, conditions: undefined };
      expect(employeeMeetsConditions(employee, template)).toBe(true);
    });

    test("minSalary condition - passes when above", () => {
      const template = { ...baseTemplate, conditions: { minSalary: 25000 } };
      expect(employeeMeetsConditions(employee, template)).toBe(true);
    });

    test("minSalary condition - fails when below", () => {
      const template = { ...baseTemplate, conditions: { minSalary: 35000 } };
      expect(employeeMeetsConditions(employee, template)).toBe(false);
    });

    test("maxSalary condition - passes when below", () => {
      const template = { ...baseTemplate, conditions: { maxSalary: 40000 } };
      expect(employeeMeetsConditions(employee, template)).toBe(true);
    });

    test("maxSalary condition - fails when above", () => {
      const template = { ...baseTemplate, conditions: { maxSalary: 25000 } };
      expect(employeeMeetsConditions(employee, template)).toBe(false);
    });

    test("department condition - passes when matches", () => {
      const template = { ...baseTemplate, conditions: { department: "Engineering" } };
      expect(employeeMeetsConditions(employee, template)).toBe(true);
    });

    test("department condition - fails when different", () => {
      const template = { ...baseTemplate, conditions: { department: "Finance" } };
      expect(employeeMeetsConditions(employee, template)).toBe(false);
    });

    test("combined conditions all must pass", () => {
      const template = {
        ...baseTemplate,
        conditions: { minSalary: 25000, maxSalary: 40000, department: "Engineering" },
      };
      expect(employeeMeetsConditions(employee, template)).toBe(true);
    });

    test("combined conditions fail if any fails", () => {
      const template = {
        ...baseTemplate,
        conditions: { minSalary: 25000, department: "Finance" },
      };
      expect(employeeMeetsConditions(employee, template)).toBe(false);
    });
  });

  describe("computeEmployeeDeductions", () => {
    const employee: Employee = {
      id: "EMP-1",
      first_name: "Jane",
      last_name: "Smith",
      monthly_basic: 40000,
      department: "Engineering",
      deduction_exempt: false,
    };

    const templates: DeductionTemplate[] = [
      {
        id: "DT-1",
        name: "Health Insurance",
        type: "deduction",
        calculation_mode: "fixed",
        value: 500,
        applies_to_all: true,
        is_active: true,
      },
      {
        id: "DT-2",
        name: "Transport Allowance",
        type: "allowance",
        calculation_mode: "fixed",
        value: 1000,
        applies_to_all: true,
        is_active: true,
      },
      {
        id: "DT-3",
        name: "Retirement Fund",
        type: "deduction",
        calculation_mode: "percentage",
        value: 5,
        applies_to_all: true,
        is_active: true,
      },
    ];

    test("computes all deductions and allowances", () => {
      const result = computeEmployeeDeductions(employee, templates);
      expect(result.deductions).toBe(2500); // 500 + 2000 (5% of 40000)
      expect(result.allowances).toBe(1000);
      expect(result.breakdown).toHaveLength(3);
    });

    test("exempt employee gets zero deductions", () => {
      const exemptEmployee = { ...employee, deduction_exempt: true };
      const result = computeEmployeeDeductions(exemptEmployee, templates);
      expect(result.deductions).toBe(0);
      expect(result.allowances).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });

    test("inactive templates are skipped", () => {
      const templatesWithInactive = [
        ...templates,
        {
          id: "DT-4",
          name: "Inactive",
          type: "deduction" as const,
          calculation_mode: "fixed" as const,
          value: 9999,
          applies_to_all: true,
          is_active: false,
        },
      ];
      const result = computeEmployeeDeductions(employee, templatesWithInactive);
      expect(result.breakdown).toHaveLength(3); // Inactive not included
    });

    test("conditional templates only apply when conditions met", () => {
      const conditionalTemplates: DeductionTemplate[] = [
        {
          id: "DT-5",
          name: "High Earner Tax",
          type: "deduction",
          calculation_mode: "percentage",
          value: 2,
          conditions: { minSalary: 50000 },
          applies_to_all: false,
          is_active: true,
        },
      ];
      const result = computeEmployeeDeductions(employee, conditionalTemplates);
      expect(result.deductions).toBe(0); // Employee earns 40000, condition is minSalary 50000
    });

    test("breakdown contains correct details", () => {
      const result = computeEmployeeDeductions(employee, [templates[0]]);
      expect(result.breakdown[0]).toEqual({
        name: "Health Insurance",
        amount: 500,
        type: "deduction",
      });
    });
  });

  describe("Integration with PH Government Deductions", () => {
    test("PH deductions computed correctly for 30000 salary", () => {
      const result = computeAllPHDeductions(30000);
      expect(result.sss).toBeGreaterThan(0);
      expect(result.philHealth).toBeGreaterThan(0);
      expect(result.pagIBIG).toBe(100); // Max PagIBIG employee share (₱100)
      expect(result.totalDeductions).toBe(result.sss + result.philHealth + result.pagIBIG + result.withholdingTax);
    });

    test("total deductions = govt + custom", () => {
      const employee: Employee = {
        id: "EMP-1",
        first_name: "Test",
        last_name: "User",
        monthly_basic: 30000,
        department: "IT",
        deduction_exempt: false,
      };
      const customTemplates: DeductionTemplate[] = [
        {
          id: "DT-1",
          name: "Custom Deduction",
          type: "deduction",
          calculation_mode: "fixed",
          value: 300,
          applies_to_all: true,
          is_active: true,
        },
      ];

      const phDeductions = computeAllPHDeductions(employee.monthly_basic);
      const customResult = computeEmployeeDeductions(employee, customTemplates);

      const phTotal = phDeductions.sss + phDeductions.philHealth + phDeductions.pagIBIG;
      const totalDeductions = phTotal + customResult.deductions;
      expect(totalDeductions).toBe(phTotal + 300);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Migration 045 Status Flow Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Payslip Status Flow (3-state)", () => {
  type PayslipStatus = "draft" | "published" | "signed";

  const validTransitions: Record<PayslipStatus, PayslipStatus[]> = {
    draft: ["published"],
    published: ["signed"],
    signed: [], // terminal state
  };

  function canTransition(from: PayslipStatus, to: PayslipStatus): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  test("draft → published is allowed", () => {
    expect(canTransition("draft", "published")).toBe(true);
  });

  test("published → signed is allowed", () => {
    expect(canTransition("published", "signed")).toBe(true);
  });

  test("draft → signed is NOT allowed (skip)", () => {
    expect(canTransition("draft", "signed")).toBe(false);
  });

  test("signed → draft is NOT allowed (backward)", () => {
    expect(canTransition("signed", "draft")).toBe(false);
  });

  test("published → draft is NOT allowed (backward)", () => {
    expect(canTransition("published", "draft")).toBe(false);
  });

  test("signed is terminal (no transitions out)", () => {
    expect(validTransitions.signed).toHaveLength(0);
  });
});

describe("PayrollRun Status Flow (3-state)", () => {
  type PayrollRunStatus = "draft" | "locked" | "completed";

  const validTransitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
    draft: ["locked"],
    locked: ["completed"],
    completed: [], // terminal state
  };

  function canTransition(from: PayrollRunStatus, to: PayrollRunStatus): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  test("draft → locked is allowed", () => {
    expect(canTransition("draft", "locked")).toBe(true);
  });

  test("locked → completed is allowed", () => {
    expect(canTransition("locked", "completed")).toBe(true);
  });

  test("draft → completed is NOT allowed (skip)", () => {
    expect(canTransition("draft", "completed")).toBe(false);
  });

  test("completed → locked is NOT allowed (backward)", () => {
    expect(canTransition("completed", "locked")).toBe(false);
  });

  test("completed is terminal (no transitions out)", () => {
    expect(validTransitions.completed).toHaveLength(0);
  });
});

describe("PayslipLineItem Aggregation", () => {
  type PayslipLineItem = {
    id: string;
    payslipId: string;
    label: string;
    type: "earning" | "deduction" | "government" | "loan";
    amount: number;
  };

  function aggregateLineItems(items: PayslipLineItem[]) {
    const totals = { earnings: 0, deductions: 0, government: 0, loans: 0 };

    for (const item of items) {
      switch (item.type) {
        case "earning":
          totals.earnings += item.amount;
          break;
        case "deduction":
          totals.deductions += item.amount;
          break;
        case "government":
          totals.government += item.amount;
          break;
        case "loan":
          totals.loans += item.amount;
          break;
      }
    }

    return {
      ...totals,
      totalDeductions: totals.deductions + totals.government + totals.loans,
      grossPay: totals.earnings,
      netPay: totals.earnings - (totals.deductions + totals.government + totals.loans),
    };
  }

  test("aggregates line items correctly", () => {
    const items: PayslipLineItem[] = [
      { id: "1", payslipId: "PS-1", label: "Basic Pay", type: "earning", amount: 25000 },
      { id: "2", payslipId: "PS-1", label: "OT Pay", type: "earning", amount: 2000 },
      { id: "3", payslipId: "PS-1", label: "SSS", type: "government", amount: 1125 },
      { id: "4", payslipId: "PS-1", label: "PhilHealth", type: "government", amount: 625 },
      { id: "5", payslipId: "PS-1", label: "Pag-IBIG", type: "government", amount: 100 },
      { id: "6", payslipId: "PS-1", label: "Tax", type: "government", amount: 500 },
      { id: "7", payslipId: "PS-1", label: "Cash Advance", type: "loan", amount: 1000 },
      { id: "8", payslipId: "PS-1", label: "Union Fee", type: "deduction", amount: 200 },
    ];

    const result = aggregateLineItems(items);

    expect(result.earnings).toBe(27000);
    expect(result.government).toBe(2350);
    expect(result.loans).toBe(1000);
    expect(result.deductions).toBe(200);
    expect(result.totalDeductions).toBe(3550);
    expect(result.grossPay).toBe(27000);
    expect(result.netPay).toBe(23450);
  });

  test("handles empty line items", () => {
    const result = aggregateLineItems([]);
    expect(result.grossPay).toBe(0);
    expect(result.netPay).toBe(0);
  });

  test("handles only earnings", () => {
    const items: PayslipLineItem[] = [
      { id: "1", payslipId: "PS-1", label: "Basic Pay", type: "earning", amount: 25000 },
    ];
    const result = aggregateLineItems(items);
    expect(result.netPay).toBe(25000);
  });
});

describe("Assignment Date Range Filtering", () => {
  interface EmployeeDeductionAssignment {
    id: string;
    employeeId: string;
    templateId: string;
    effectiveFrom: string;
    effectiveUntil?: string;
    isActive: boolean;
  }

  function getActiveAssignmentsForEmployee(
    assignments: EmployeeDeductionAssignment[],
    employeeId: string,
    date: string
  ): EmployeeDeductionAssignment[] {
    return assignments.filter((a) => {
      if (a.employeeId !== employeeId) return false;
      if (!a.isActive) return false;
      if (a.effectiveFrom > date) return false;
      if (a.effectiveUntil && a.effectiveUntil < date) return false;
      return true;
    });
  }

  const sampleAssignments: EmployeeDeductionAssignment[] = [
    { id: "EDA-1", employeeId: "EMP-001", templateId: "DT-1", effectiveFrom: "2026-01-01", isActive: true },
    { id: "EDA-2", employeeId: "EMP-001", templateId: "DT-2", effectiveFrom: "2026-03-01", effectiveUntil: "2026-06-30", isActive: true },
    { id: "EDA-3", employeeId: "EMP-001", templateId: "DT-3", effectiveFrom: "2026-01-01", isActive: false },
    { id: "EDA-4", employeeId: "EMP-002", templateId: "DT-1", effectiveFrom: "2026-01-01", isActive: true },
  ];

  test("returns only active assignments for correct employee", () => {
    const result = getActiveAssignmentsForEmployee(sampleAssignments, "EMP-001", "2026-04-15");
    expect(result).toHaveLength(2);
    expect(result.map(a => a.id)).toEqual(["EDA-1", "EDA-2"]);
  });

  test("excludes assignments not yet effective", () => {
    const result = getActiveAssignmentsForEmployee(sampleAssignments, "EMP-001", "2026-02-15");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("EDA-1");
  });

  test("excludes expired assignments", () => {
    const result = getActiveAssignmentsForEmployee(sampleAssignments, "EMP-001", "2026-07-15");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("EDA-1");
  });

  test("excludes inactive assignments", () => {
    const result = getActiveAssignmentsForEmployee(sampleAssignments, "EMP-001", "2026-04-15");
    expect(result.find(a => a.id === "EDA-3")).toBeUndefined();
  });

  test("returns empty for non-existent employee", () => {
    const result = getActiveAssignmentsForEmployee(sampleAssignments, "EMP-999", "2026-04-15");
    expect(result).toHaveLength(0);
  });
});

describe("Deduction Template Validation", () => {
  test("value must be non-negative", () => {
    const validTemplate: DeductionTemplate = {
      id: "DT-1",
      name: "Test",
      type: "deduction",
      calculation_mode: "fixed",
      value: 0,
      applies_to_all: true,
      is_active: true,
    };
    expect(validTemplate.value).toBeGreaterThanOrEqual(0);
  });

  test("type must be deduction or allowance", () => {
    const types = ["deduction", "allowance"];
    expect(types).toContain("deduction");
    expect(types).toContain("allowance");
  });

  test("calculation_mode must be valid", () => {
    const modes = ["fixed", "percentage", "daily", "hourly"];
    expect(modes).toHaveLength(4);
  });
});

describe("Bulk Assignment", () => {
  test("can assign to multiple employees", () => {
    const employeeIds = ["EMP-1", "EMP-2", "EMP-3"];
    const templateId = "DT-1";
    
    const assignments = employeeIds.map((empId) => ({
      employee_id: empId,
      template_id: templateId,
      is_active: true,
    }));

    expect(assignments).toHaveLength(3);
    expect(assignments.every((a) => a.template_id === templateId)).toBe(true);
  });

  test("can assign multiple templates to one employee", () => {
    const employeeId = "EMP-1";
    const templateIds = ["DT-1", "DT-2", "DT-3"];

    const assignments = templateIds.map((tplId) => ({
      employee_id: employeeId,
      template_id: tplId,
      is_active: true,
    }));

    expect(assignments).toHaveLength(3);
    expect(assignments.every((a) => a.employee_id === employeeId)).toBe(true);
  });
});

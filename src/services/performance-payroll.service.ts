/**
 * Performance Payroll Integration Service
 * Bridges performance management adjustments with payroll processing
 */

import { createClient } from "@/services/supabase-server";
import type { PerformanceSalaryAdjustment } from "@/types";

type ApplyAdjustmentResult =
  | {
      adjustmentId: string;
      employeeId: string;
      status: "success";
      previousSalary: number | null | undefined;
      newSalary: number;
    }
  | {
      adjustmentId: string;
      status: "failed";
      error: string;
    };

/**
 * Retrieves all approved salary adjustments that haven't been applied yet
 */
export async function getApprovedAdjustmentsForPayroll() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("performance_salary_adjustments")
    .select(
      `
      *,
      employee:employees(id, name, email, salary),
      review:performance_reviews(id),
      band:performance_salary_bands(*)
    `
    )
    .eq("status", "approved")
    .is("applied_in_payroll_run_id", null)
    .order("approved_at", { ascending: true });

  if (error) throw error;
  return data as PerformanceSalaryAdjustment[];
}

/**
 * Applies approved salary adjustments to a payroll run
 * Updates employee salary and marks adjustments as applied
 */
export async function applyAdjustmentsToPayrollRun(
  payrollRunId: string,
  adjustmentIds: string[]
) {
  const supabase = await createClient();
  const results: ApplyAdjustmentResult[] = [];

  for (const adjustmentId of adjustmentIds) {
    try {
      // Get adjustment details
      const { data: adjustment, error: fetchError } = await supabase
        .from("performance_salary_adjustments")
        .select("*")
        .eq("id", adjustmentId)
        .single();

      if (fetchError) throw fetchError;
      if (!adjustment) throw new Error("Adjustment not found");

      // Get current employee salary
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("salary")
        .eq("id", adjustment.employee_id)
        .single();

      if (empError) throw empError;

      const newSalary =
        (employee?.salary || 0) + (adjustment.finance_approved_amount || 0);

      // Update employee salary
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          salary: newSalary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adjustment.employee_id);

      if (updateError) throw updateError;

      // Mark adjustment as applied
      const { error: applyError } = await supabase
        .from("performance_salary_adjustments")
        .update({
          status: "applied",
          applied_in_payroll_run_id: payrollRunId,
          applied_at: new Date().toISOString(),
        })
        .eq("id", adjustmentId);

      if (applyError) throw applyError;

      // Create audit log
      await supabase.from("performance_audit_logs").insert({
        id: `PAL-${Date.now()}-${Math.random()}`,
        company_id: adjustment.company_id,
        entity_type: "adjustment",
        entity_id: adjustmentId,
        action: "applied_to_payroll",
        old_status: "approved",
        new_status: "applied",
        changed_by: "system",
        details: {
          payroll_run_id: payrollRunId,
          previous_salary: employee?.salary,
          new_salary: newSalary,
          adjustment_amount: adjustment.finance_approved_amount,
        },
      });

      results.push({
        adjustmentId,
        employeeId: adjustment.employee_id,
        status: "success",
        previousSalary: employee?.salary,
        newSalary,
      });
    } catch (error) {
      console.error(`Failed to apply adjustment ${adjustmentId}:`, error);
      results.push({
        adjustmentId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Gets the impact summary for a set of adjustments before applying
 */
export async function getAdjustmentImpactSummary(
  adjustmentIds: string[]
) {
  const supabase = await createClient();

  const { data: adjustments, error } = await supabase
    .from("performance_salary_adjustments")
    .select(
      `
      *,
      employee:employees(id, name, salary)
    `
    )
    .in("id", adjustmentIds);

  if (error) throw error;

  const totalIncrease = adjustments?.reduce(
    (sum, a) => sum + (a.finance_approved_amount || 0),
    0
  ) || 0;

  const employeeCount = adjustments?.length || 0;

  const averageIncrease =
    employeeCount > 0 ? totalIncrease / employeeCount : 0;

  return {
    totalIncrease,
    employeeCount,
    averageIncrease,
    adjustments: adjustments?.map((a) => ({
      adjustmentId: a.id,
      employeeId: a.employee_id,
      employeeName: a.employee?.name,
      currentSalary: a.employee?.salary,
      adjustmentAmount: a.finance_approved_amount,
      newSalary: (a.employee?.salary || 0) + (a.finance_approved_amount || 0),
    })) || [],
  };
}

/**
 * Filters adjustments for a specific payroll run
 * Only returns adjustments that match the payroll run's period
 */
export async function filterAdjustmentsForPayrollRun(
  payrollRunId: string,
  adjustments: PerformanceSalaryAdjustment[]
) {
  const supabase = await createClient();

  // Get payroll run details
  const { data: payrollRun, error: runError } = await supabase
    .from("payroll_runs")
    .select("period_start, period_end")
    .eq("id", payrollRunId)
    .single();

  if (runError) throw runError;

  // Filter adjustments approved within the payroll period or earlier
  return adjustments.filter(
    (adj) =>
      adj.approved_at &&
      new Date(adj.approved_at) <=
        new Date(payrollRun?.period_end || new Date())
  );
}

/**
 * Validates adjustments before applying to payroll
 */
export async function validateAdjustmentsForPayroll(
  adjustmentIds: string[]
) {
  const supabase = await createClient();

  const { data: adjustments, error } = await supabase
    .from("performance_salary_adjustments")
    .select("*")
    .in("id", adjustmentIds);

  if (error) throw error;

  const issues: string[] = [];

  adjustments?.forEach((adj) => {
    if (adj.status !== "approved") {
      issues.push(
        `Adjustment ${adj.id} is not approved (status: ${adj.status})`
      );
    }
    if (adj.applied_in_payroll_run_id) {
      issues.push(`Adjustment ${adj.id} has already been applied`);
    }
    if (!adj.finance_approved_amount) {
      issues.push(`Adjustment ${adj.id} has no approved amount`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}

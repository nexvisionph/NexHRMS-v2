"use server";

/**
 * Payroll Service Layer (Server Actions)
 *
 * Provides secure server-side operations for payroll management.
 * Handles payslips, payroll runs, adjustments, and final pay.
 */

import { createServerSupabaseClient } from "./supabase-server";
import type {
  Payslip, PayrollRun, PayrollAdjustment, FinalPayComputation,
  PayScheduleConfig, ServiceResult
} from "@/types";
import { keysToCamel, keysToSnake } from "@/lib/db-utils";

// ─── Payslips ────────────────────────────────────────────────────

export async function getPayslips(employeeId?: string): Promise<ServiceResult<Payslip[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("payslips").select("*").order("issued_at", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as Payslip) };
}

export async function getPayslipById(id: string): Promise<ServiceResult<Payslip | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("payslips").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return { ok: true, data: null };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as Payslip };
}

export async function createPayslip(payslip: Omit<Payslip, "id">): Promise<ServiceResult<Payslip>> {
  const supabase = await createServerSupabaseClient();
  const id = `PS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const row = { ...keysToSnake(payslip as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("payslips").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as Payslip };
}

export async function updatePayslip(id: string, patch: Partial<Payslip>): Promise<ServiceResult<Payslip>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("payslips").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as Payslip };
}

export async function confirmPayslip(id: string): Promise<ServiceResult<Payslip>> {
  // Simplified flow: confirm is now a no-op, payslips go directly from draft to published
  return updatePayslip(id, { status: "draft" });
}

export async function publishPayslip(id: string): Promise<ServiceResult<Payslip>> {
  return updatePayslip(id, { status: "published", publishedAt: new Date().toISOString() });
}

export async function recordPayment(
  id: string, 
  method: "bank_transfer" | "gcash" | "cash" | "check", 
  bankRef: string,
  cashAmount?: number,
  paymentProofUrl?: string
): Promise<ServiceResult<Payslip>> {
  return updatePayslip(id, {
    paidAt: new Date().toISOString(),
    paymentMethod: method,
    bankReferenceId: bankRef,
    cashAmount: method === "cash" ? cashAmount : undefined,
    paymentProofUrl,
  });
}

export async function signPayslip(id: string, signatureDataUrl: string): Promise<ServiceResult<Payslip>> {
  return updatePayslip(id, { status: "signed", signedAt: new Date().toISOString(), signatureDataUrl });
}

export async function acknowledgePayslip(id: string, acknowledgedBy: string): Promise<ServiceResult<Payslip>> {
  return updatePayslip(id, {
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy,
  });
}

// ─── Payroll Runs ────────────────────────────────────────────────

export async function getPayrollRuns(): Promise<ServiceResult<PayrollRun[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as PayrollRun) };
}

export async function createPayrollRun(run: Omit<PayrollRun, "id" | "createdAt">): Promise<ServiceResult<PayrollRun>> {
  const supabase = await createServerSupabaseClient();
  const id = `RUN-${Date.now()}`;
  const row = { ...keysToSnake(run as Record<string, unknown>), id, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from("payroll_runs").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayrollRun };
}

export async function updatePayrollRun(id: string, patch: Partial<PayrollRun>): Promise<ServiceResult<PayrollRun>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as Record<string, unknown>);
  const { data, error } = await supabase.from("payroll_runs").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayrollRun };
}

export async function lockPayrollRun(id: string, _lockedBy: string): Promise<ServiceResult<PayrollRun>> {
  return updatePayrollRun(id, { status: "locked", locked: true, lockedAt: new Date().toISOString() });
}

export async function publishPayrollRun(id: string): Promise<ServiceResult<PayrollRun>> {
  // In simplified flow, publishing is part of locking. This is now a no-op.
  return updatePayrollRun(id, { publishedAt: new Date().toISOString() });
}

export async function markPayrollRunPaid(id: string): Promise<ServiceResult<PayrollRun>> {
  return updatePayrollRun(id, { status: "completed", paidAt: new Date().toISOString() });
}

// ─── Payroll Adjustments ─────────────────────────────────────────

export async function getPayrollAdjustments(): Promise<ServiceResult<PayrollAdjustment[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("payroll_adjustments").select("*").order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as PayrollAdjustment) };
}

export async function createAdjustment(adj: Omit<PayrollAdjustment, "id" | "createdAt">): Promise<ServiceResult<PayrollAdjustment>> {
  const supabase = await createServerSupabaseClient();
  const id = `ADJ-${Date.now()}`;
  const row = { ...keysToSnake(adj as Record<string, unknown>), id, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from("payroll_adjustments").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayrollAdjustment };
}

export async function approveAdjustment(id: string, approvedBy: string): Promise<ServiceResult<PayrollAdjustment>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("payroll_adjustments")
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayrollAdjustment };
}

export async function applyAdjustment(id: string, appliedRunId: string): Promise<ServiceResult<PayrollAdjustment>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("payroll_adjustments")
    .update({ status: "applied", applied_run_id: appliedRunId })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayrollAdjustment };
}

// ─── Final Pay ───────────────────────────────────────────────────

export async function getFinalPayComputations(employeeId?: string): Promise<ServiceResult<FinalPayComputation[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("final_pay").select("*");
  if (employeeId) query = query.eq("employee_id", employeeId);
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as FinalPayComputation) };
}

export async function createFinalPay(fp: Omit<FinalPayComputation, "id" | "createdAt">): Promise<ServiceResult<FinalPayComputation>> {
  const supabase = await createServerSupabaseClient();
  const id = `FP-${Date.now()}`;
  const row = { ...keysToSnake(fp as Record<string, unknown>), id, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from("final_pay").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as FinalPayComputation };
}

export async function updateFinalPay(id: string, patch: Partial<FinalPayComputation>): Promise<ServiceResult<FinalPayComputation>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as Record<string, unknown>);
  const { data, error } = await supabase.from("final_pay").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as FinalPayComputation };
}

// ─── Pay Schedule Config ─────────────────────────────────────────

export async function getPayScheduleConfig(): Promise<ServiceResult<PayScheduleConfig | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("pay_schedule_config").select("*").single();
  if (error) {
    if (error.code === "PGRST116") return { ok: true, data: null };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayScheduleConfig };
}

export async function updatePayScheduleConfig(config: Partial<PayScheduleConfig>): Promise<ServiceResult<PayScheduleConfig>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(config as Record<string, unknown>);
  // Use upsert since there's only one config row
  const { data, error } = await supabase
    .from("pay_schedule_config")
    .upsert({ id: "default", ...row }, { onConflict: "id" })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as PayScheduleConfig };
}

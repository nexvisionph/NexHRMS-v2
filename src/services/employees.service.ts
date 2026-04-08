"use server";

/**
 * Employee Service Layer (Server Actions)
 *
 * Provides secure server-side operations for employee management.
 * Uses Supabase client with user session for RLS enforcement.
 */

import { createServerSupabaseClient, createAdminSupabaseClient } from "./supabase-server";
import type { Employee, ServiceResult, SalaryChangeRequest, SalaryHistoryEntry } from "@/types";
import { keysToCamel, keysToSnake, roleToDbFormat, roleFromDb } from "@/lib/db-utils";

// ─── Helpers ─────────────────────────────────────────────────────

function employeeFromDb(row: Record<string, unknown>): Employee {
  const camel = keysToCamel(row) as Record<string, unknown>;
  if (typeof camel.role === "string") {
    camel.role = roleFromDb(camel.role as string);
  }
  // workDays might be JSON string or array
  if (typeof camel.workDays === "string") {
    try { camel.workDays = JSON.parse(camel.workDays as string); } catch { /* keep */ }
  }
  return camel as unknown as Employee;
}

function employeeToDb(emp: Partial<Employee>): Record<string, unknown> {
  const row = keysToSnake(emp as Record<string, unknown>);
  if (typeof row.role === "string") {
    row.role = roleToDbFormat(row.role as string);
  }
  return row;
}

// ─── Employee CRUD ───────────────────────────────────────────────

export async function getEmployees(): Promise<ServiceResult<Employee[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("employees").select("*");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => employeeFromDb(r as Record<string, unknown>)) };
}

export async function getEmployeeById(id: string): Promise<ServiceResult<Employee | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
  if (error) {
    if (error.code === "PGRST116") return { ok: true, data: null }; // Not found
    return { ok: false, error: error.message };
  }
  return { ok: true, data: employeeFromDb(data as Record<string, unknown>) };
}

export async function createEmployee(emp: Omit<Employee, "id" | "createdAt" | "updatedAt">): Promise<ServiceResult<Employee>> {
  const supabase = await createServerSupabaseClient();
  const id = `EMP-${Date.now()}`;
  const row = { ...employeeToDb(emp), id };
  const { data, error } = await supabase.from("employees").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: employeeFromDb(data as Record<string, unknown>) };
}

export async function updateEmployee(id: string, patch: Partial<Employee>): Promise<ServiceResult<Employee>> {
  const supabase = await createServerSupabaseClient();
  const row = employeeToDb(patch);
  const { data, error } = await supabase.from("employees").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };

  // Sync email/name/role to profiles table if employee has a linked profile
  const employee = employeeFromDb(data as Record<string, unknown>);
  const profileId = (data as { profile_id?: string }).profile_id;
  if (profileId && (patch.email || patch.name || patch.role)) {
    const adminSupabase = await createAdminSupabaseClient();
    const profilePatch: Record<string, unknown> = {};
    if (patch.email) profilePatch.email = patch.email;
    if (patch.name) profilePatch.name = patch.name;
    if (patch.role) profilePatch.role = roleToDbFormat(patch.role);
    await adminSupabase.from("profiles").update(profilePatch).eq("id", profileId);
  }

  return { ok: true, data: employee };
}

export async function deleteEmployee(id: string): Promise<ServiceResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ─── Salary Management ───────────────────────────────────────────

export async function getSalaryChangeRequests(): Promise<ServiceResult<SalaryChangeRequest[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("salary_change_requests").select("*");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as SalaryChangeRequest) };
}

export async function createSalaryChangeRequest(req: Omit<SalaryChangeRequest, "id">): Promise<ServiceResult<SalaryChangeRequest>> {
  const supabase = await createServerSupabaseClient();
  const id = `SCR-${Date.now()}`;
  const row = { ...keysToSnake(req as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("salary_change_requests").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as SalaryChangeRequest };
}

export async function updateSalaryChangeRequest(id: string, patch: Partial<SalaryChangeRequest>): Promise<ServiceResult<SalaryChangeRequest>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("salary_change_requests").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as SalaryChangeRequest };
}

export async function getSalaryHistory(employeeId: string): Promise<ServiceResult<SalaryHistoryEntry[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("salary_history")
    .select("*")
    .eq("employee_id", employeeId)
    .order("effective_date", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as SalaryHistoryEntry) };
}

export async function addSalaryHistoryEntry(entry: Omit<SalaryHistoryEntry, "id">): Promise<ServiceResult<SalaryHistoryEntry>> {
  const supabase = await createServerSupabaseClient();
  const id = `SH-${Date.now()}`;
  const row = { ...keysToSnake(entry as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("salary_history").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as SalaryHistoryEntry };
}

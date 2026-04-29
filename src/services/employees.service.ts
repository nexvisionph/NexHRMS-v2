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

type AdminSupabaseClient = Awaited<ReturnType<typeof createAdminSupabaseClient>>;

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

async function deleteRowsByEmployeeId(
  supabase: AdminSupabaseClient,
  table: string,
  employeeId: string,
  column = "employee_id"
): Promise<string | null> {
  const { error } = await supabase.from(table).delete().eq(column, employeeId);
  return error ? `${table}: ${error.message}` : null;
}

async function deleteRowsByIds(
  supabase: AdminSupabaseClient,
  table: string,
  column: string,
  ids: string[]
): Promise<string | null> {
  if (ids.length === 0) return null;
  const { error } = await supabase.from(table).delete().in(column, ids);
  return error ? `${table}: ${error.message}` : null;
}

async function purgeEmployeeDependencies(supabase: AdminSupabaseClient, employeeId: string): Promise<string | null> {
  const { data: attendanceEvents, error: attendanceEventsError } = await supabase
    .from("attendance_events")
    .select("id")
    .eq("employee_id", employeeId);
  if (attendanceEventsError) return `attendance_events: ${attendanceEventsError.message}`;
  const attendanceEventIds = ((attendanceEvents ?? []) as Array<{ id: string }>).map((row) => row.id);

  const { data: loanRows, error: loansError } = await supabase
    .from("loans")
    .select("id")
    .eq("employee_id", employeeId);
  if (loansError) return `loans: ${loansError.message}`;
  const loanIds = ((loanRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  const { data: payslipRows, error: payslipsError } = await supabase
    .from("payslips")
    .select("id")
    .eq("employee_id", employeeId);
  if (payslipsError) return `payslips: ${payslipsError.message}`;
  const payslipIds = ((payslipRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  const deletePlan: Array<Promise<string | null>> = [
    deleteRowsByEmployeeId(supabase, "attendance_exceptions", employeeId),
    deleteRowsByEmployeeId(supabase, "attendance_logs", employeeId),
    deleteRowsByEmployeeId(supabase, "break_records", employeeId),
    deleteRowsByEmployeeId(supabase, "overtime_requests", employeeId),
    deleteRowsByEmployeeId(supabase, "location_pings", employeeId),
    deleteRowsByEmployeeId(supabase, "employee_shifts", employeeId),
    deleteRowsByEmployeeId(supabase, "penalty_records", employeeId),
    deleteRowsByEmployeeId(supabase, "manual_checkins", employeeId),
    deleteRowsByEmployeeId(supabase, "manual_checkins", employeeId, "performed_by"),
    deleteRowsByEmployeeId(supabase, "site_survey_photos", employeeId),
    deleteRowsByEmployeeId(supabase, "timesheets", employeeId),
    deleteRowsByEmployeeId(supabase, "leave_requests", employeeId),
    deleteRowsByEmployeeId(supabase, "leave_balances", employeeId),
    deleteRowsByEmployeeId(supabase, "notification_logs", employeeId),
    deleteRowsByEmployeeId(supabase, "employee_documents", employeeId),
    deleteRowsByEmployeeId(supabase, "qr_tokens", employeeId),
    deleteRowsByEmployeeId(supabase, "face_enrollments", employeeId),
    deleteRowsByEmployeeId(supabase, "project_assignments", employeeId),
    deleteRowsByEmployeeId(supabase, "task_comments", employeeId),
    deleteRowsByEmployeeId(supabase, "task_completion_reports", employeeId),
    deleteRowsByEmployeeId(supabase, "channel_messages", employeeId),
    deleteRowsByEmployeeId(supabase, "salary_history", employeeId),
    deleteRowsByEmployeeId(supabase, "salary_change_requests", employeeId),
    deleteRowsByEmployeeId(supabase, "final_pay_computations", employeeId),
    deleteRowsByEmployeeId(supabase, "deduction_overrides", employeeId),
    deleteRowsByEmployeeId(supabase, "employee_deduction_assignments", employeeId),
    deleteRowsByEmployeeId(supabase, "payroll_adjustments", employeeId),
    deleteRowsByIds(supabase, "loan_deductions", "loan_id", loanIds),
    deleteRowsByIds(supabase, "loan_balance_history", "loan_id", loanIds),
    deleteRowsByIds(supabase, "loan_repayment_schedule", "loan_id", loanIds),
    deleteRowsByIds(supabase, "payslip_line_items", "payslip_id", payslipIds),
    deleteRowsByIds(supabase, "payroll_run_payslips", "payslip_id", payslipIds),
    deleteRowsByIds(supabase, "payroll_adjustments", "reference_payslip_id", payslipIds),
  ];

  for (const task of deletePlan) {
    const error = await task;
    if (error) return error;
  }

  if (attendanceEventIds.length > 0) {
    const error = await deleteRowsByIds(supabase, "attendance_evidence", "event_id", attendanceEventIds);
    if (error) return error;
    const exceptionEventError = await deleteRowsByIds(supabase, "attendance_exceptions", "event_id", attendanceEventIds);
    if (exceptionEventError) return exceptionEventError;
    const eventError = await deleteRowsByIds(supabase, "attendance_events", "id", attendanceEventIds);
    if (eventError) return eventError;
  }

  if (loanIds.length > 0) {
    const loanError = await deleteRowsByIds(supabase, "loans", "id", loanIds);
    if (loanError) return loanError;
  }

  if (payslipIds.length > 0) {
    const payslipError = await deleteRowsByIds(supabase, "payslips", "id", payslipIds);
    if (payslipError) return payslipError;
  }

  return null;
}

export async function deleteEmployeeById(id: string): Promise<ServiceResult<void>> {
  const supabase = await createAdminSupabaseClient();
  const dependencyError = await purgeEmployeeDependencies(supabase, id);
  if (dependencyError) return { ok: false, error: dependencyError };

  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function deleteEmployeeByProfileId(profileId: string, email?: string): Promise<ServiceResult<void>> {
  const supabase = await createAdminSupabaseClient();
  const { data: employeeByProfile, error: employeeLookupError } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (employeeLookupError) return { ok: false, error: employeeLookupError.message };

  let employeeId = (employeeByProfile as { id?: string } | null)?.id;

  if (!employeeId && email) {
    const { data: employeeByEmail, error: employeeEmailError } = await supabase
      .from("employees")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (employeeEmailError) return { ok: false, error: employeeEmailError.message };
    employeeId = (employeeByEmail as { id?: string } | null)?.id;
  }

  if (!employeeId) return { ok: true, data: undefined };

  return deleteEmployeeById(employeeId);
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

  // Sync fields to profiles table if employee has a linked profile
  const employee = employeeFromDb(data as Record<string, unknown>);
  const profileId = (data as { profile_id?: string }).profile_id;
  const syncFields = ['email', 'name', 'role', 'phone', 'birthday', 'address', 'emergencyContact'] as const;
  const hasFieldToSync = syncFields.some(f => patch[f] !== undefined);
  
  if (profileId && hasFieldToSync) {
    const adminSupabase = await createAdminSupabaseClient();
    const profilePatch: Record<string, unknown> = {};
    if (patch.email !== undefined) profilePatch.email = patch.email;
    if (patch.name !== undefined) profilePatch.name = patch.name;
    if (patch.role !== undefined) profilePatch.role = roleToDbFormat(patch.role);
    if (patch.phone !== undefined) profilePatch.phone = patch.phone || null;
    if (patch.birthday !== undefined) profilePatch.birthday = patch.birthday || null;
    if (patch.address !== undefined) profilePatch.address = patch.address || null;
    if (patch.emergencyContact !== undefined) profilePatch.emergency_contact = patch.emergencyContact || null;
    await adminSupabase.from("profiles").update(profilePatch).eq("id", profileId);
  }

  return { ok: true, data: employee };
}

export async function deleteEmployee(id: string): Promise<ServiceResult<void>> {
  return deleteEmployeeById(id);
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

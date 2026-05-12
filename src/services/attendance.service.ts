"use server";

/**
 * Attendance Service Layer (Server Actions)
 *
 * Provides secure server-side operations for attendance tracking.
 * Handles events (append-only ledger), daily logs, evidence, exceptions, shifts, and overtime.
 */

import { createServerSupabaseClient } from "./supabase-server";
import type {
  AttendanceEvent, AttendanceEvidence, AttendanceException, AttendanceLog,
  ShiftTemplate, OvertimeRequest, Holiday, ServiceResult
} from "@/types";
import { keysToCamel, keysToSnake } from "@/lib/db-utils";
import { attendanceLogRowToTs, attendanceLogTsToRow } from "@/lib/db-mappers";

// ─── Attendance Events (Append-Only Ledger) ──────────────────────

export async function getAttendanceEvents(employeeId?: string): Promise<ServiceResult<AttendanceEvent[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("attendance_events").select("*").order("timestamp_utc", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as AttendanceEvent) };
}

export async function appendAttendanceEvent(event: Omit<AttendanceEvent, "id" | "createdAt">): Promise<ServiceResult<AttendanceEvent>> {
  const supabase = await createServerSupabaseClient();
  const id = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const row = { ...keysToSnake(event as unknown as Record<string, unknown>), id, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from("attendance_events").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceEvent };
}

// ─── Attendance Evidence ─────────────────────────────────────────

export async function addAttendanceEvidence(evidence: Omit<AttendanceEvidence, "id">): Promise<ServiceResult<AttendanceEvidence>> {
  const supabase = await createServerSupabaseClient();
  const id = `EVI-${Date.now()}`;
  const row = { ...keysToSnake(evidence as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("attendance_evidence").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceEvidence };
}

export async function getEvidenceForEvent(eventId: string): Promise<ServiceResult<AttendanceEvidence | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("attendance_evidence").select("*").eq("event_id", eventId).single();
  if (error) {
    if (error.code === "PGRST116") return { ok: true, data: null };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceEvidence };
}

// ─── Attendance Exceptions ───────────────────────────────────────

export async function getAttendanceExceptions(employeeId?: string): Promise<ServiceResult<AttendanceException[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("attendance_exceptions").select("*").order("created_at", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as AttendanceException) };
}

export async function createException(exc: Omit<AttendanceException, "id" | "createdAt">): Promise<ServiceResult<AttendanceException>> {
  const supabase = await createServerSupabaseClient();
  const id = `EXC-${Date.now()}`;
  const row = { ...keysToSnake(exc as unknown as Record<string, unknown>), id, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from("attendance_exceptions").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceException };
}

export async function resolveException(id: string, resolvedBy: string, notes?: string): Promise<ServiceResult<AttendanceException>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("attendance_exceptions")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy, notes })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceException };
}

export async function updateException(id: string, updates: { flag?: string; notes?: string; resolvedAt?: string | null; resolvedBy?: string | null }): Promise<ServiceResult<AttendanceException>> {
  const supabase = await createServerSupabaseClient();
  const row: Record<string, unknown> = {};
  if (updates.flag !== undefined) row.flag = updates.flag;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.resolvedAt !== undefined) row.resolved_at = updates.resolvedAt;
  if (updates.resolvedBy !== undefined) row.resolved_by = updates.resolvedBy;
  const { data, error } = await supabase
    .from("attendance_exceptions")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as AttendanceException };
}

export async function deleteException(id: string): Promise<ServiceResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("attendance_exceptions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ─── Attendance Logs (Daily Summary) ─────────────────────────────

export async function getAttendanceLogs(employeeId?: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<AttendanceLog[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("attendance_logs").select("*");
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);
  query = query.order("date", { ascending: false });
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => attendanceLogRowToTs(r as Record<string, unknown>) as unknown as AttendanceLog) };
}

export async function upsertAttendanceLog(log: AttendanceLog): Promise<ServiceResult<AttendanceLog>> {
  const supabase = await createServerSupabaseClient();
  const row = attendanceLogTsToRow(log as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("attendance_logs").upsert(row, { onConflict: "id" }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: attendanceLogRowToTs(data as Record<string, unknown>) as unknown as AttendanceLog };
}

// ─── Shift Templates ─────────────────────────────────────────────

export async function getShiftTemplates(): Promise<ServiceResult<ShiftTemplate[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("shift_templates").select("*");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as ShiftTemplate) };
}

export async function createShiftTemplate(shift: Omit<ShiftTemplate, "id" | "createdAt" | "updatedAt">): Promise<ServiceResult<ShiftTemplate>> {
  const supabase = await createServerSupabaseClient();
  const id = `SHIFT-${Date.now()}`;
  const row = { ...keysToSnake(shift as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("shift_templates").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as ShiftTemplate };
}

export async function updateShiftTemplate(id: string, patch: Partial<ShiftTemplate>): Promise<ServiceResult<ShiftTemplate>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("shift_templates").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as ShiftTemplate };
}

export async function deleteShiftTemplate(id: string): Promise<ServiceResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("shift_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// ─── Overtime Requests ───────────────────────────────────────────

export async function getOvertimeRequests(employeeId?: string): Promise<ServiceResult<OvertimeRequest[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("overtime_requests").select("*").order("requested_at", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as OvertimeRequest) };
}

export async function createOvertimeRequest(req: Omit<OvertimeRequest, "id" | "requestedAt">): Promise<ServiceResult<OvertimeRequest>> {
  const supabase = await createServerSupabaseClient();
  const id = `OT-${Date.now()}`;
  const row = { ...keysToSnake(req as unknown as Record<string, unknown>), id, requested_at: new Date().toISOString() };
  const { data, error } = await supabase.from("overtime_requests").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as OvertimeRequest };
}

export async function approveOvertimeRequest(id: string, reviewedBy: string): Promise<ServiceResult<OvertimeRequest>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("overtime_requests")
    .update({ status: "approved", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as OvertimeRequest };
}

export async function rejectOvertimeRequest(id: string, reviewedBy: string, reason?: string): Promise<ServiceResult<OvertimeRequest>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("overtime_requests")
    .update({ status: "rejected", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), rejection_reason: reason })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as OvertimeRequest };
}

// ─── Holidays ────────────────────────────────────────────────────

export async function getHolidays(year?: number): Promise<ServiceResult<Holiday[]>> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("holidays").select("*");
  if (year) query = query.eq("year", year);
  query = query.order("date", { ascending: true });
  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(r => keysToCamel(r as Record<string, unknown>) as unknown as Holiday) };
}

export async function createHoliday(holiday: Omit<Holiday, "id">): Promise<ServiceResult<Holiday>> {
  const supabase = await createServerSupabaseClient();
  const id = `HOL-${Date.now()}`;
  const row = { ...keysToSnake(holiday as unknown as Record<string, unknown>), id };
  const { data, error } = await supabase.from("holidays").insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as Holiday };
}

export async function updateHoliday(id: string, patch: Partial<Holiday>): Promise<ServiceResult<Holiday>> {
  const supabase = await createServerSupabaseClient();
  const row = keysToSnake(patch as unknown as Record<string, unknown>);
  const { data, error } = await supabase.from("holidays").update(row).eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: keysToCamel(data as Record<string, unknown>) as unknown as Holiday };
}

export async function deleteHoliday(id: string): Promise<ServiceResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

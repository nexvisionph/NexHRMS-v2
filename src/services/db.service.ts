"use client";

/**
 * Supabase data service layer.
 * Provides typed read/write operations for each domain.
 * All functions use the browser Supabase client (user-scoped RLS).
 *
 * Convention:  DB snake_case → TypeScript camelCase via mapping functions.
 * Convention:  Functions are async, return { data, error } pattern.
 */

import { createClient } from "./supabase-browser";
import { keysToCamel, keysToSnake, roleFromDb, roleToDbFormat } from "@/lib/db-utils";
import type {
  Employee, LeaveRequest, LeaveBalance, LeavePolicy,
  AttendanceLog, AttendanceEvent, AttendanceEvidence, AttendanceException,
  Holiday, ShiftTemplate, OvertimeRequest,
  Payslip, PayrollRun, PayrollAdjustment, FinalPayComputation, PayScheduleConfig,
  Loan, LoanDeduction, LoanRepaymentSchedule,
  Project, AuditLogEntry, CalendarEvent,
  SalaryChangeRequest, SalaryHistoryEntry,
  PenaltyRecord,
  Announcement, TextChannel, ChannelMessage,
  TaskGroup, Task, TaskCompletionReport, TaskComment,
  Timesheet, AttendanceRuleSet,
  NotificationLog, NotificationRule,
  LocationPing, SiteSurveyPhoto, BreakRecord,
} from "@/types";

// Re-export for convenience
export { createClient };

const isDemoMode = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  : true; // SSR defaults to demo

// ─── Helper ─────────────────────────────────────────────────────

function supabase() {
  return createClient();
}

/** Generic fetch-all from a table, with camelCase conversion */
async function fetchAll<T>(table: string, options?: {
  select?: string;
  filter?: Record<string, string>;
  order?: { column: string; ascending?: boolean };
}): Promise<T[]> {
  let query = supabase().from(table).select(options?.select ?? "*");
  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      query = query.eq(key, value);
    }
  }
  if (options?.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
  }
  const { data, error } = await query;
  if (error) {
    console.error(`[db] fetchAll ${table}:`, error.message);
    return [];
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => keysToCamel(row) as T);
}

/** Generic upsert (insert or update) */
async function upsertRow(table: string, row: Record<string, unknown>) {
  const dbRow = keysToSnake(row);
  const { error } = await supabase().from(table).upsert(dbRow, { onConflict: "id" });
  if (error) console.error(`[db] upsert ${table}:`, error.message);
  return !error;
}

/** Generic insert */
async function insertRow(table: string, row: Record<string, unknown>) {
  const dbRow = keysToSnake(row);
  const { error } = await supabase().from(table).insert(dbRow);
  if (error) {
    // 23505 = unique_violation: record already exists.
    // This can occur when the write-through subscriber fires after hydration and
    // re-attempts to insert records that were just fetched from the DB.
    if (error.code === "23505") return true;
    console.error(`[db] insert ${table}:`, error.message);
  }
  return !error;
}

/** Generic update by id */
async function updateRow(table: string, id: string, patch: Record<string, unknown>) {
  const dbPatch = keysToSnake(patch);
  const { error } = await supabase().from(table).update(dbPatch).eq("id", id);
  if (error) console.error(`[db] update ${table}:`, error.message);
  return !error;
}

/** Generic delete by id */
async function deleteRow(table: string, id: string) {
  const { error } = await supabase().from(table).delete().eq("id", id);
  if (error) console.error(`[db] delete ${table}:`, error.message);
  return !error;
}

// ─── Employees ──────────────────────────────────────────────────

function employeeFromDb(row: Record<string, unknown>): Employee {
  const camel = keysToCamel(row) as Record<string, unknown>;
  // Normalize role from DB (title-case) to frontend (lowercase)
  if (typeof camel.role === "string") {
    camel.role = roleFromDb(camel.role as string);
  }
  // workDays might come as a PostgreSQL array
  if (typeof camel.workDays === "string") {
    try { camel.workDays = JSON.parse(camel.workDays as string); } catch { /* keep as-is */ }
  }
  return camel as unknown as Employee;
}

function employeeToDb(emp: Partial<Employee>): Record<string, unknown> {
  const row = keysToSnake(emp as Record<string, unknown>);
  // Convert role to DB format (title-case for pre-migration-017)
  if (typeof row.role === "string") {
    row.role = roleToDbFormat(row.role as string);
  }
  return row;
}

export const employeesDb = {
  async fetchAll(): Promise<Employee[]> {
    const { data, error } = await supabase().from("employees").select("*");
    if (error) { console.error("[db] employees.fetchAll:", error.message); return []; }
    return ((data ?? []) as Record<string, unknown>[]).map((r) => employeeFromDb(r));
  },

  async fetchById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase().from("employees").select("*").eq("id", id).single();
    if (error || !data) return null;
    return employeeFromDb(data as Record<string, unknown>);
  },

  async upsert(emp: Partial<Employee> & { id: string }): Promise<boolean> {
    const row = employeeToDb(emp);
    const { error } = await supabase().from("employees").upsert(row, { onConflict: "id" });
    if (error) { console.error("[db] employees.upsert:", error.message); return false; }
    return true;
  },

  async update(id: string, patch: Partial<Employee>): Promise<boolean> {
    const row = employeeToDb(patch);
    const { error } = await supabase().from("employees").update(row).eq("id", id);
    if (error) { console.error("[db] employees.update:", error.message); return false; }
    return true;
  },

  async remove(id: string): Promise<boolean> {
    return deleteRow("employees", id);
  },
};

// ─── Salary ─────────────────────────────────────────────────────

export const salaryDb = {
  fetchRequests: () => fetchAll<SalaryChangeRequest>("salary_change_requests"),
  fetchHistory: () => fetchAll<SalaryHistoryEntry>("salary_history"),

  async upsertRequest(req: SalaryChangeRequest): Promise<boolean> {
    return upsertRow("salary_change_requests", req as unknown as Record<string, unknown>);
  },

  async insertHistory(entry: SalaryHistoryEntry): Promise<boolean> {
    return insertRow("salary_history", entry as unknown as Record<string, unknown>);
  },
};

// ─── Leave ──────────────────────────────────────────────────────

export const leaveDb = {
  fetchRequests: () => fetchAll<LeaveRequest>("leave_requests"),
  fetchBalances: () => fetchAll<LeaveBalance>("leave_balances"),
  fetchPolicies: () => fetchAll<LeavePolicy>("leave_policies"),

  async upsertRequest(req: LeaveRequest): Promise<boolean> {
    return upsertRow("leave_requests", req as unknown as Record<string, unknown>);
  },

  async upsertBalance(bal: LeaveBalance): Promise<boolean> {
    return upsertRow("leave_balances", bal as unknown as Record<string, unknown>);
  },

  async upsertPolicy(pol: LeavePolicy): Promise<boolean> {
    return upsertRow("leave_policies", pol as unknown as Record<string, unknown>);
  },

  async deletePolicy(id: string): Promise<boolean> {
    return deleteRow("leave_policies", id);
  },
};

// ─── Attendance ─────────────────────────────────────────────────

export const attendanceDb = {
  fetchLogs: () => fetchAll<AttendanceLog>("attendance_logs"),
  fetchEvents: () => fetchAll<AttendanceEvent>("attendance_events", { order: { column: "timestamp_utc", ascending: false } }),

  async upsertLog(log: AttendanceLog): Promise<boolean> {
    // Flatten locationSnapshot for DB
    const row: Record<string, unknown> = { ...(log as unknown as Record<string, unknown>) };
    if (log.locationSnapshot) {
      row.locationLat = log.locationSnapshot.lat;
      row.locationLng = log.locationSnapshot.lng;
    }
    delete row.locationSnapshot;
    return upsertRow("attendance_logs", row);
  },

  async insertEvent(event: AttendanceEvent): Promise<boolean> {
    return insertRow("attendance_events", event as unknown as Record<string, unknown>);
  },

  fetchHolidays: () => fetchAll<Holiday>("holidays"),
  fetchShifts: () => fetchAll<ShiftTemplate>("shift_templates"),
  fetchOvertimeRequests: () => fetchAll<OvertimeRequest>("overtime_requests"),

  async upsertHoliday(h: Holiday): Promise<boolean> {
    return upsertRow("holidays", h as unknown as Record<string, unknown>);
  },

  async deleteHoliday(id: string): Promise<boolean> {
    return deleteRow("holidays", id);
  },

  async upsertShift(s: ShiftTemplate): Promise<boolean> {
    const row = s as unknown as Record<string, unknown>;
    // Ensure workDays is a proper array for PostgreSQL
    if (Array.isArray(row.workDays)) row.workDays = [...row.workDays];
    return upsertRow("shift_templates", row);
  },

  async deleteShift(id: string): Promise<boolean> {
    return deleteRow("shift_templates", id);
  },

  // Employee shift assignments (junction table, PK = employee_id)
  async fetchEmployeeShifts(): Promise<Record<string, string>> {
    const { data, error } = await supabase().from("employee_shifts").select("employee_id, shift_id");
    if (error) { console.error("[db] fetchEmployeeShifts:", error.message); return {}; }
    const mapping: Record<string, string> = {};
    for (const row of (data ?? []) as { employee_id: string; shift_id: string }[]) {
      mapping[row.employee_id] = row.shift_id;
    }
    return mapping;
  },

  async upsertEmployeeShift(employeeId: string, shiftId: string): Promise<boolean> {
    const { error } = await supabase()
      .from("employee_shifts")
      .upsert({ employee_id: employeeId, shift_id: shiftId, assigned_at: new Date().toISOString() }, { onConflict: "employee_id" });
    if (error) console.error("[db] upsertEmployeeShift:", error.message);
    return !error;
  },

  async deleteEmployeeShift(employeeId: string): Promise<boolean> {
    const { error } = await supabase().from("employee_shifts").delete().eq("employee_id", employeeId);
    if (error) console.error("[db] deleteEmployeeShift:", error.message);
    return !error;
  },

  // Evidence
  fetchEvidence: () => fetchAll<AttendanceEvidence>("attendance_evidence"),
  async insertEvidence(evidence: AttendanceEvidence): Promise<boolean> {
    return insertRow("attendance_evidence", evidence as unknown as Record<string, unknown>);
  },

  // Exceptions
  fetchExceptions: () => fetchAll<AttendanceException>("attendance_exceptions"),
  async upsertException(exc: AttendanceException): Promise<boolean> {
    return upsertRow("attendance_exceptions", exc as unknown as Record<string, unknown>);
  },

  // Penalties
  fetchPenalties: () => fetchAll<PenaltyRecord>("penalty_records"),
  async upsertPenalty(penalty: PenaltyRecord): Promise<boolean> {
    return upsertRow("penalty_records", penalty as unknown as Record<string, unknown>);
  },

  // Break records
  fetchBreakRecords: () => fetchAll<Record<string, unknown>>("break_records"),
  async upsertBreakRecord(record: Record<string, unknown>): Promise<boolean> {
    return upsertRow("break_records", record);
  },

  async upsertOvertimeRequest(req: OvertimeRequest): Promise<boolean> {
    return upsertRow("overtime_requests", req as unknown as Record<string, unknown>);
  },
};

// ─── Payroll ────────────────────────────────────────────────────

export const payrollDb = {
  fetchPayslips: () => fetchAll<Payslip>("payslips"),

  /** Fetch runs + hydrate payslipIds from junction table (falls back to legacy column). */
  async fetchRuns(): Promise<PayrollRun[]> {
    const runs = await fetchAll<PayrollRun>("payroll_runs");
    // Try to hydrate from junction table
    const { data: junctionRows, error } = await supabase()
      .from("payroll_run_payslips")
      .select("run_id, payslip_id");

    if (!error && junctionRows && junctionRows.length > 0) {
      const byRun = new Map<string, string[]>();
      for (const r of junctionRows as { run_id: string; payslip_id: string }[]) {
        const arr = byRun.get(r.run_id) ?? [];
        arr.push(r.payslip_id);
        byRun.set(r.run_id, arr);
      }
      for (const run of runs) {
        const ids = byRun.get(run.id);
        if (ids) run.payslipIds = ids;
      }
    }
    // If junction table is empty/missing, runs keep their legacy payslipIds from the column
    return runs;
  },

  async upsertPayslip(ps: Payslip): Promise<boolean> {
    return upsertRow("payslips", ps as unknown as Record<string, unknown>);
  },

  async updatePayslip(id: string, patch: Partial<Payslip>): Promise<boolean> {
    return updateRow("payslips", id, patch as unknown as Record<string, unknown>);
  },

  async upsertRun(run: PayrollRun): Promise<boolean> {
    // Separate payslipIds for junction table
    const payslipIds = run.payslipIds ?? [];
    const row: Record<string, unknown> = { ...(run as unknown as Record<string, unknown>) };
    // Keep legacy column in sync during transition
    row.payslipIds = payslipIds;
    const baseOk = await upsertRow("payroll_runs", row);
    if (!baseOk) return false;

    // Sync junction table: delete removed, insert new
    const { data: existing } = await supabase()
      .from("payroll_run_payslips")
      .select("payslip_id")
      .eq("run_id", run.id);

    const existingIds = new Set((existing ?? []).map((r: { payslip_id: string }) => r.payslip_id));
    const targetIds = new Set(payslipIds);

    // Remove payslips no longer in the run
    const toRemove = [...existingIds].filter((id) => !targetIds.has(id));
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase()
        .from("payroll_run_payslips")
        .delete()
        .eq("run_id", run.id)
        .in("payslip_id", toRemove);
      if (delErr) console.error("[db] payroll_run_payslips.delete:", delErr.message);
    }

    // Add new payslips
    const toAdd = [...targetIds].filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const { error: insErr } = await supabase()
        .from("payroll_run_payslips")
        .insert(toAdd.map((pid) => ({ run_id: run.id, payslip_id: pid })));
      if (insErr) console.error("[db] payroll_run_payslips.insert:", insErr.message);
    }

    return true;
  },

  fetchAdjustments: () => fetchAll<PayrollAdjustment>("payroll_adjustments"),

  async upsertAdjustment(adj: PayrollAdjustment): Promise<boolean> {
    return upsertRow("payroll_adjustments", adj as unknown as Record<string, unknown>);
  },

  fetchFinalPay: () => fetchAll<FinalPayComputation>("final_pay_computations"),

  async upsertFinalPay(fp: FinalPayComputation): Promise<boolean> {
    return upsertRow("final_pay_computations", fp as unknown as Record<string, unknown>);
  },

  fetchPaySchedule: async (): Promise<PayScheduleConfig[]> => {
    return fetchAll<PayScheduleConfig>("pay_schedule_config");
  },

  async upsertPaySchedule(config: PayScheduleConfig & { id: string }): Promise<boolean> {
    return upsertRow("pay_schedule_config", config as unknown as Record<string, unknown>);
  },
};

// ─── Loans ──────────────────────────────────────────────────────

export const loansDb = {
  fetchAll: () => fetchAll<Loan>("loans"),

  async upsert(loan: Omit<Loan, "deductions" | "repaymentSchedule" | "balanceHistory"> & { id: string }): Promise<boolean> {
    // Strip embedded arrays — those are in separate tables
    const { ...row } = loan as unknown as Record<string, unknown>;
    delete row.deductions;
    delete row.repaymentSchedule;
    delete row.balanceHistory;
    return upsertRow("loans", row);
  },

  async update(id: string, patch: Partial<Loan>): Promise<boolean> {
    const row: Record<string, unknown> = { ...(patch as unknown as Record<string, unknown>) };
    delete row.deductions;
    delete row.repaymentSchedule;
    delete row.balanceHistory;
    return updateRow("loans", id, row);
  },

  fetchDeductions: (loanId: string) =>
    fetchAll<LoanDeduction>("loan_deductions", { filter: { loan_id: loanId } }),

  async insertDeduction(ded: LoanDeduction): Promise<boolean> {
    return insertRow("loan_deductions", ded as unknown as Record<string, unknown>);
  },
};

// ─── Projects ───────────────────────────────────────────────────

function projectFromDb(row: Record<string, unknown>): Project {
  const camel = keysToCamel(row) as Record<string, unknown>;
  // Reconstruct nested location from flat columns
  camel.location = {
    lat: camel.locationLat as number ?? 0,
    lng: camel.locationLng as number ?? 0,
    radius: camel.locationRadius as number ?? 100,
    ...(camel.locationAddress ? { address: camel.locationAddress as string } : {}),
  };
  delete camel.locationLat;
  delete camel.locationLng;
  delete camel.locationRadius;
  delete camel.locationAddress;
  // assignedEmployeeIds is a text[] in DB
  if (typeof camel.assignedEmployeeIds === "string") {
    try { camel.assignedEmployeeIds = JSON.parse(camel.assignedEmployeeIds as string); } catch { /* keep */ }
  }
  if (!Array.isArray(camel.assignedEmployeeIds)) camel.assignedEmployeeIds = [];
  return camel as unknown as Project;
}

function projectToDb(p: Partial<Project>): Record<string, unknown> {
  // Explicitly map only the columns that exist in the DB base schema (migration 010).
  // The 4 extra columns (location_address, verification_method, require_geofence,
  // geofence_radius_meters) are added by migration 027 — include them only when present
  // so the upsert doesn't break if migration hasn't been applied yet.
  const row: Record<string, unknown> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.description !== undefined) row.description = p.description;
  if (p.status !== undefined) row.status = p.status;
  if (p.createdAt !== undefined) row.created_at = p.createdAt;
  if (p.assignedEmployeeIds !== undefined) row.assigned_employee_ids = p.assignedEmployeeIds;

  // Flatten nested location → flat columns
  if (p.location) {
    row.location_lat = p.location.lat;
    row.location_lng = p.location.lng;
    row.location_radius = p.location.radius;
    // Migration-027 columns — include when values present
    if (p.location.address != null) row.location_address = p.location.address;
  }

  // Migration-027 columns
  if (p.verificationMethod !== undefined) row.verification_method = p.verificationMethod;
  if (p.requireGeofence !== undefined) row.require_geofence = p.requireGeofence;
  if (p.geofenceRadiusMeters !== undefined) row.geofence_radius_meters = p.geofenceRadiusMeters;

  return row;
}

export const projectsDb = {
  async fetchAll(): Promise<Project[]> {
    const { data, error } = await supabase().from("projects").select("*");
    if (error) { console.error("[db] projects.fetchAll:", error.message); return []; }
    const projects = ((data ?? []) as Record<string, unknown>[]).map((r) => projectFromDb(r));

    // Hydrate assignedEmployeeIds from junction table (falls back to legacy column)
    const { data: assignments, error: aErr } = await supabase()
      .from("project_assignments")
      .select("project_id, employee_id");

    if (!aErr && assignments && assignments.length > 0) {
      const byProject = new Map<string, string[]>();
      for (const a of assignments as { project_id: string; employee_id: string }[]) {
        const arr = byProject.get(a.project_id) ?? [];
        arr.push(a.employee_id);
        byProject.set(a.project_id, arr);
      }
      for (const p of projects) {
        const ids = byProject.get(p.id);
        if (ids) p.assignedEmployeeIds = ids;
      }
    }
    // If junction table is empty/missing, projects keep their legacy array

    return projects;
  },

  async upsert(project: Partial<Project> & { id: string }): Promise<boolean> {
    // Separate employee IDs for junction table
    const employeeIds = project.assignedEmployeeIds ?? [];
    const row = projectToDb(project);
    // Keep legacy column in sync during transition
    row.assigned_employee_ids = employeeIds;

    const { error } = await supabase().from("projects").upsert(row, { onConflict: "id" });
    if (error) {
      // If the error is about missing migration-027 columns, retry without them
      if (error.message.includes("schema cache") || error.message.includes("column")) {
        const MIGRATION_027_COLS = ["location_address", "verification_method", "require_geofence", "geofence_radius_meters"];
        const safeRow = Object.fromEntries(
          Object.entries(row).filter(([k]) => !MIGRATION_027_COLS.includes(k))
        );
        const { error: retryErr } = await supabase().from("projects").upsert(safeRow, { onConflict: "id" });
        if (retryErr) { console.error("[db] projects.upsert (retry):", retryErr.message); return false; }
        console.warn("[db] projects.upsert: migration 027 columns missing – saved without extended fields. Run migration 027 to enable all features.");
      } else {
        console.error("[db] projects.upsert:", error.message);
        return false;
      }
    }

    // Sync junction table: replace all assignments for this project
    // The DB trigger `enforce_one_project_per_employee` handles the 1-project constraint.
    const { data: existing } = await supabase()
      .from("project_assignments")
      .select("employee_id")
      .eq("project_id", project.id);

    const existingIds = new Set((existing ?? []).map((r: { employee_id: string }) => r.employee_id));
    const targetIds = new Set(employeeIds);

    const toRemove = [...existingIds].filter((id) => !targetIds.has(id));
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase()
        .from("project_assignments")
        .delete()
        .eq("project_id", project.id)
        .in("employee_id", toRemove);
      if (delErr) console.error("[db] project_assignments.delete:", delErr.message);
    }

    const toAdd = [...targetIds].filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const { error: insErr } = await supabase()
        .from("project_assignments")
        .insert(toAdd.map((eid) => ({ project_id: project.id, employee_id: eid })));
      if (insErr) console.error("[db] project_assignments.insert:", insErr.message);
    }

    return true;
  },

  async remove(id: string): Promise<boolean> {
    return deleteRow("projects", id);
  },
};

// ─── Audit Logs ─────────────────────────────────────────────────

export const auditDb = {
  fetchAll: () => fetchAll<AuditLogEntry>("audit_logs", { order: { column: "timestamp", ascending: false } }),

  async insert(entry: AuditLogEntry): Promise<boolean> {
    return insertRow("audit_logs", entry as unknown as Record<string, unknown>);
  },
};

// ─── Calendar Events ────────────────────────────────────────────

export const eventsDb = {
  fetchAll: () => fetchAll<CalendarEvent>("calendar_events"),

  async upsert(event: CalendarEvent): Promise<boolean> {
    return upsertRow("calendar_events", event as unknown as Record<string, unknown>);
  },

  async remove(id: string): Promise<boolean> {
    return deleteRow("calendar_events", id);
  },
};

// ─── Messaging ──────────────────────────────────────────────────

export const messagingDb = {
  fetchAnnouncements: () => fetchAll<Announcement>("announcements", { order: { column: "sent_at", ascending: false } }),
  fetchChannels: () => fetchAll<TextChannel>("text_channels"),
  fetchMessages: () => fetchAll<ChannelMessage>("channel_messages", { order: { column: "created_at", ascending: true } }),

  async upsertAnnouncement(ann: Announcement): Promise<boolean> {
    return upsertRow("announcements", ann as unknown as Record<string, unknown>);
  },

  async upsertChannel(ch: TextChannel): Promise<boolean> {
    return upsertRow("text_channels", ch as unknown as Record<string, unknown>);
  },

  async deleteChannel(id: string): Promise<boolean> {
    return deleteRow("text_channels", id);
  },

  async insertMessage(msg: ChannelMessage): Promise<boolean> {
    return insertRow("channel_messages", msg as unknown as Record<string, unknown>);
  },

  async upsertMessage(msg: ChannelMessage): Promise<boolean> {
    return upsertRow("channel_messages", msg as unknown as Record<string, unknown>);
  },
};

// ─── Tasks ──────────────────────────────────────────────────────

export const tasksDb = {
  fetchGroups: () => fetchAll<TaskGroup>("task_groups"),
  fetchTasks: () => fetchAll<Task>("tasks"),
  fetchCompletionReports: () => fetchAll<TaskCompletionReport>("task_completion_reports"),
  fetchComments: () => fetchAll<TaskComment>("task_comments", { order: { column: "created_at", ascending: true } }),

  async upsertGroup(g: TaskGroup): Promise<boolean> {
    return upsertRow("task_groups", g as unknown as Record<string, unknown>);
  },

  async deleteGroup(id: string): Promise<boolean> {
    return deleteRow("task_groups", id);
  },

  async upsertTask(t: Task): Promise<boolean> {
    return upsertRow("tasks", t as unknown as Record<string, unknown>);
  },

  async deleteTask(id: string): Promise<boolean> {
    return deleteRow("tasks", id);
  },

  async upsertCompletionReport(r: TaskCompletionReport): Promise<boolean> {
    return upsertRow("task_completion_reports", r as unknown as Record<string, unknown>);
  },

  async insertComment(c: TaskComment): Promise<boolean> {
    return insertRow("task_comments", c as unknown as Record<string, unknown>);
  },
};

// ─── Timesheets ─────────────────────────────────────────────────

export const timesheetsDb = {
  fetchTimesheets: () => fetchAll<Timesheet>("timesheets"),
  fetchRuleSets: () => fetchAll<AttendanceRuleSet>("attendance_rule_sets"),

  async upsertTimesheet(ts: Timesheet): Promise<boolean> {
    return upsertRow("timesheets", ts as unknown as Record<string, unknown>);
  },

  async upsertRuleSet(rs: AttendanceRuleSet): Promise<boolean> {
    return upsertRow("attendance_rule_sets", rs as unknown as Record<string, unknown>);
  },

  async deleteRuleSet(id: string): Promise<boolean> {
    return deleteRow("attendance_rule_sets", id);
  },
};

// ─── Notifications ──────────────────────────────────────────────

export const notificationsDb = {
  fetchLogs: () => fetchAll<NotificationLog>("notification_logs", { order: { column: "sent_at", ascending: false } }),
  fetchRules: () => fetchAll<NotificationRule>("notification_rules"),

  async insertLog(log: NotificationLog): Promise<boolean> {
    return insertRow("notification_logs", log as unknown as Record<string, unknown>);
  },

  async upsertRule(rule: NotificationRule): Promise<boolean> {
    return upsertRow("notification_rules", rule as unknown as Record<string, unknown>);
  },
};

// ─── Location ───────────────────────────────────────────────────

export const locationDb = {
  fetchPings: () => fetchAll<LocationPing>("location_pings", { order: { column: "timestamp", ascending: false } }),
  fetchPhotos: () => fetchAll<SiteSurveyPhoto>("site_survey_photos"),
  fetchBreaks: () => fetchAll<BreakRecord>("break_records"),

  async insertPing(ping: LocationPing): Promise<boolean> {
    return insertRow("location_pings", ping as unknown as Record<string, unknown>);
  },

  async upsertPhoto(photo: SiteSurveyPhoto): Promise<boolean> {
    return upsertRow("site_survey_photos", photo as unknown as Record<string, unknown>);
  },

  async upsertBreak(br: BreakRecord): Promise<boolean> {
    return upsertRow("break_records", br as unknown as Record<string, unknown>);
  },
};

// ─── Loan Deductions & Repayment ────────────────────────────────

export const loanExtrasDb = {
  fetchDeductionsForLoan: (loanId: string) =>
    fetchAll<LoanDeduction>("loan_deductions", { filter: { loan_id: loanId } }),

  fetchAllDeductions: () => fetchAll<LoanDeduction>("loan_deductions"),

  fetchRepaymentSchedule: (loanId: string) =>
    fetchAll<LoanRepaymentSchedule>("loan_repayment_schedule", { filter: { loan_id: loanId }, order: { column: "due_date", ascending: true } }),

  fetchAllRepaymentSchedules: () => fetchAll<LoanRepaymentSchedule>("loan_repayment_schedule"),
};

// ─── Sync Check ─────────────────────────────────────────────────

/** Returns true if we should sync with Supabase (not demo mode, and client available) */
export function shouldSync(): boolean {
  if (isDemoMode) return false;
  if (typeof window === "undefined") return false;
  return true;
}

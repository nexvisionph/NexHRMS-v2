"use client";

/**
 * Supabase ↔ Zustand sync layer.
 *
 * Pattern:
 *   1. On login (or app mount), call `hydrateAllStores()` to pull data FROM Supabase.
 *   2. Subscribe to each store — on state changes, write-through TO Supabase.
 *
 * This keeps all existing store logic intact (business rules, computed values)
 * and simply adds a persistence layer to Supabase underneath.
 */

import {
  shouldSync,
  hasValidSession,
  employeesDb,
  employeeFromDb,
  salaryDb,
  leaveDb,
  attendanceDb,
  payrollDb,
  loansDb,
  projectsDb,
  auditDb,
  eventsDb,
  messagingDb,
  tasksDb,
  timesheetsDb,
  notificationsDb,
  locationDb,
  loanExtrasDb,
  departmentsDb,
  jobTitlesDb,
  createClient,
} from "./db.service";
import { keysToCamel } from "@/lib/db-utils";
import { useEmployeesStore } from "@/store/employees.store";
import { useLeaveStore } from "@/store/leave.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { useProjectsStore } from "@/store/projects.store";
import { useAuditStore } from "@/store/audit.store";
import { useEventsStore } from "@/store/events.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { useNotificationsStore, DEFAULT_EMPLOYEE_PREFS } from "@/store/notifications.store";
import type { EmployeeNotifPrefs } from "@/store/notifications.store";
import { useLocationStore } from "@/store/location.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { useJobTitlesStore } from "@/store/job-titles.store";

let _hydrated = false;
let _subscriptions: (() => void)[] = [];
let _realtimeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

/**
 * When true, all write-through subscription callbacks are a no-op.
 * Used by `handleResetAll` to prevent seed data from being pushed to Supabase
 * during a bulk store reset. Now that all stores are DB-first, the flag is
 * still toggled by `pauseWriteThrough` / `resumeWriteThrough` for any future
 * subscribers and to keep the public API stable for callers.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _writePaused = false;

/**
 * Pause all write-through subscriptions. Call before bulk store resets to
 * prevent seed/local data from overwriting real Supabase rows.
 */
export function pauseWriteThrough(): void {
  _writePaused = true;
}

/**
 * Resume write-through subscriptions after a bulk reset + rehydration.
 */
export function resumeWriteThrough(): void {
  _writePaused = false;
}

/**
 * Pull all data from Supabase and replace Zustand store state.
 * Call this once after successful login or on app mount.
 */
export async function hydrateAllStores(opts?: { skipSessionCheck?: boolean }): Promise<void> {
  return hydrateAllStoresInternal(opts);
}

/**
 * Force a full re-hydration from Supabase, bypassing the `_hydrated` guard.
 * Use after operations (like attendance reset) that modify the DB outside the
 * write-through flow so the local store is guaranteed to match the DB state.
 * 
 * Throttled: will not re-run if called within 30 seconds of the last successful hydration.
 * Pass `{ force: true }` to bypass the throttle (e.g., after explicit user action like delete).
 */
let _lastHydratedAt = 0;
const HYDRATE_THROTTLE_MS = 30_000; // 30 seconds

export async function forceRehydrate(opts?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!opts?.force && now - _lastHydratedAt < HYDRATE_THROTTLE_MS) {
    return; // Skip — recently hydrated
  }
  _hydrated = false;
  await hydrateAllStoresInternal();
  _lastHydratedAt = Date.now();
}

async function hydrateAllStoresInternal(opts?: { skipSessionCheck?: boolean }): Promise<void> {
  if (!shouldSync()) return;
  if (_hydrated) return;

  // Check for valid session before attempting to fetch data.
  // This prevents 406 errors when the refresh token is invalid.
  if (!opts?.skipSessionCheck) {
    const hasSession = await hasValidSession();
    if (!hasSession) {
      console.info("[sync] No valid session — skipping hydration");
      return;
    }
  }

  try {
    // Fetch all core data in two sequential batches of ~20 to stay well under
    // Supabase's per-origin concurrent-request limit (~6 HTTP/1.1 connections
    // or ~100 HTTP/2 streams). Firing all 40+ at once can cause the browser to
    // drop some requests, producing CORS-style "Failed to fetch" errors.

    // ── Batch 1: HR + Attendance + Payroll ───────────────────────
    const [
      employees,
      salaryRequests,
      salaryHistory,
      leaveRequests,
      leaveBalances,
      leavePolicies,
      attendanceLogs,
      attendanceEvents,
      holidays,
      shifts,
      overtimeRequests,
      attendanceEvidence,
      attendanceExceptions,
      penalties,
      payslips,
      payrollRuns,
      payrollAdjustments,
      finalPayComputations,
      payScheduleRows,
      deductionOverridesRows,
      globalDefaultsRows,
      signatureConfigRow,
      loans,
    ] = await Promise.all([
      employeesDb.fetchAll(),
      salaryDb.fetchRequests(),
      salaryDb.fetchHistory(),
      leaveDb.fetchRequests(),
      leaveDb.fetchBalances(),
      leaveDb.fetchPolicies(),
      attendanceDb.fetchLogs(),
      attendanceDb.fetchEvents(),
      attendanceDb.fetchHolidays(),
      attendanceDb.fetchShifts(),
      attendanceDb.fetchOvertimeRequests(),
      attendanceDb.fetchEvidence(),
      attendanceDb.fetchExceptions(),
      attendanceDb.fetchPenalties(),
      payrollDb.fetchPayslips(),
      payrollDb.fetchRuns(),
      payrollDb.fetchAdjustments(),
      payrollDb.fetchFinalPay(),
      payrollDb.fetchPaySchedule(),
      payrollDb.fetchDeductionOverrides(),
      payrollDb.fetchGlobalDefaults(),
      payrollDb.fetchSignatureConfig(),
      loansDb.fetchAll(),
    ]);

    // ── Batch 2: Projects + Comms + Tasks + Misc ────────────────
    const [
      projects,
      auditLogs,
      calendarEvents,
      announcements,
      textChannels,
      channelMessages,
      taskGroups,
      tasks,
      completionReports,
      taskComments,
      taskTagsList,
      timesheets,
      ruleSets,
      notificationLogs,
      notificationRules,
      locationPings,
      sitePhotos,
      breakRecords,
      allLoanDeductions,
      allRepaymentSchedules,
      departmentsFromDb,
      jobTitlesFromDb,
    ] = await Promise.all([
      projectsDb.fetchAll(),
      auditDb.fetchAll(),
      eventsDb.fetchAll(),
      messagingDb.fetchAnnouncements(),
      messagingDb.fetchChannels(),
      messagingDb.fetchMessages(),
      tasksDb.fetchGroups(),
      tasksDb.fetchTasks(),
      tasksDb.fetchCompletionReports(),
      tasksDb.fetchComments(),
      tasksDb.fetchTags(),
      timesheetsDb.fetchTimesheets(),
      timesheetsDb.fetchRuleSets(),
      notificationsDb.fetchLogs(),
      notificationsDb.fetchRules(),
      locationDb.fetchPings(),
      locationDb.fetchPhotos(),
      locationDb.fetchBreaks(),
      loanExtrasDb.fetchAllDeductions(),
      loanExtrasDb.fetchAllRepaymentSchedules(),
      departmentsDb.fetchAll(),
      jobTitlesDb.fetchAll(),
    ]);

    // Fetch employee-shift assignments separately (returns a mapping, not an array)
    const employeeShiftsMap = await attendanceDb.fetchEmployeeShifts();

    // Hydrate employees store. Always replace from Supabase so DB-side deletes
    // clear local state instead of leaving stale rows around.
    const deletedEmployeeIds = useEmployeesStore.getState().deletedEmployeeIds ?? [];
    const deletedEmployeeIdSet = new Set(deletedEmployeeIds);
    for (const employee of employees) {
      if (deletedEmployeeIdSet.has(employee.id)) {
        employeesDb.remove(employee.id).catch((error) => {
          console.warn("[sync] Failed to purge tombstoned employee:", employee.id, error);
        });
      }
    }
    useEmployeesStore.setState({
      employees: employees.filter((employee) => !deletedEmployeeIdSet.has(employee.id)),
      salaryRequests,
      salaryHistory,
    });

    // Hydrate leave store
    if (leavePolicies.length > 0 || leaveRequests.length > 0 || leaveBalances.length > 0) {
      useLeaveStore.setState({
        ...(leavePolicies.length > 0 ? { policies: leavePolicies } : {}),
        ...(leaveRequests.length > 0 ? { requests: leaveRequests } : {}),
        ...(leaveBalances.length > 0 ? { balances: leaveBalances } : {}),
      });
    }

    // Hydrate attendance store.
    // logs and events are always set (even when empty) so a DB-side reset clears local state on refresh.
    useAttendanceStore.setState({
      logs: attendanceLogs,
      events: attendanceEvents,
      ...(holidays.length > 0 ? { holidays } : {}),
      ...(shifts.length > 0 ? { shiftTemplates: shifts } : {}),
      ...(overtimeRequests.length > 0 ? { overtimeRequests } : {}),
      ...(attendanceEvidence.length > 0 ? { evidence: attendanceEvidence } : {}),
      ...(attendanceExceptions.length > 0 ? { exceptions: attendanceExceptions } : {}),
      ...(penalties.length > 0 ? { penalties } : {}),
      ...(Object.keys(employeeShiftsMap).length > 0 ? { employeeShifts: employeeShiftsMap } : {}),
    });

    // Hydrate payroll store — always set from Supabase to ensure resets propagate
    // across sessions (e.g., admin resets, employee reloads → sees empty).
    usePayrollStore.setState({
      payslips: payslips.length > 0 ? payslips : [],
      runs: payrollRuns.length > 0 ? payrollRuns : [],
      adjustments: payrollAdjustments.length > 0 ? payrollAdjustments : [],
      finalPayComputations: finalPayComputations.length > 0 ? finalPayComputations : [],
      ...(payScheduleRows.length > 0 ? { paySchedule: payScheduleRows[0] } : {}),
      deductionOverrides: deductionOverridesRows.length > 0 ? deductionOverridesRows : [],
      globalDefaults: globalDefaultsRows.length > 0 ? globalDefaultsRows : [
        { deductionType: "sss", enabled: true, mode: "auto" },
        { deductionType: "philhealth", enabled: true, mode: "auto" },
        { deductionType: "pagibig", enabled: true, mode: "auto" },
        { deductionType: "bir", enabled: true, mode: "auto" },
      ],
      ...(signatureConfigRow ? { signatureConfig: signatureConfigRow } : {}),
    });

    // Hydrate loans store — attach deductions & repayment schedules
    if (loans.length > 0) {
      const hydratedLoans = loans.map((loan) => ({
        ...loan,
        deductions: allLoanDeductions.filter((d) => d.loanId === loan.id),
        repaymentSchedule: allRepaymentSchedules.filter((r) => r.loanId === loan.id),
        balanceHistory: loan.balanceHistory ?? [],
      }));
      useLoansStore.setState({ loans: hydratedLoans });
    }

    // Hydrate projects store
    if (projects.length > 0) {
      useProjectsStore.setState({ projects });
    }

    // Hydrate audit store
    if (auditLogs.length > 0) {
      useAuditStore.setState({ logs: auditLogs });
    }

    // Hydrate events store
    if (calendarEvents.length > 0) {
      useEventsStore.setState({ events: calendarEvents });
    }

    // Hydrate messaging store
    if (announcements.length > 0 || textChannels.length > 0 || channelMessages.length > 0) {
      useMessagingStore.setState({
        ...(announcements.length > 0 ? { announcements } : {}),
        ...(textChannels.length > 0 ? { channels: textChannels } : {}),
        ...(channelMessages.length > 0 ? { messages: channelMessages } : {}),
      });
    }

    // Hydrate tasks store — always set groups and tasks from DB so stale
    // seed/localStorage data never hides real assignments.  Completion
    // reports, comments, and tags are only replaced when DB has rows.
    useTasksStore.setState({
      groups: taskGroups,
      tasks,
      ...(completionReports.length > 0 ? { completionReports } : {}),
      ...(taskComments.length > 0 ? { comments: taskComments } : {}),
      ...(taskTagsList.length > 0 ? { taskTags: taskTagsList } : {}),
    });

    // Hydrate timesheet store
    if (timesheets.length > 0 || ruleSets.length > 0) {
      useTimesheetStore.setState({
        ...(timesheets.length > 0 ? { timesheets } : {}),
        ...(ruleSets.length > 0 ? { ruleSets } : {}),
      });
    }

    // Hydrate notifications store — always set logs from DB so stale
    // localStorage data from a previous user session is cleared on login.
    useNotificationsStore.setState({
      logs: notificationLogs,
      ...(notificationRules.length > 0 ? { rules: notificationRules } : {}),
    });

    // Hydrate per-employee notification preferences from DB employee records.
    // Each employee row may have a notification_preferences jsonb column.
    if (employees.length > 0) {
      const dbPrefs: Record<string, EmployeeNotifPrefs> = {};
      for (const emp of employees) {
        if (emp.notificationPreferences && typeof emp.notificationPreferences === "object" && Object.keys(emp.notificationPreferences).length > 0) {
          dbPrefs[emp.id] = { ...DEFAULT_EMPLOYEE_PREFS, ...emp.notificationPreferences } as EmployeeNotifPrefs;
        }
      }
      if (Object.keys(dbPrefs).length > 0) {
        const currentPrefs = useNotificationsStore.getState().employeePrefs;
        useNotificationsStore.setState({
          employeePrefs: { ...currentPrefs, ...dbPrefs },
        });
      }
    }

    // Hydrate location store
    if (locationPings.length > 0 || sitePhotos.length > 0 || breakRecords.length > 0) {
      useLocationStore.setState({
        ...(locationPings.length > 0 ? { pings: locationPings } : {}),
        ...(sitePhotos.length > 0 ? { photos: sitePhotos } : {}),
        ...(breakRecords.length > 0 ? { breaks: breakRecords } : {}),
      });
    }

    // Hydrate departments store
    if (departmentsFromDb.length > 0) {
      useDepartmentsStore.setState({ departments: departmentsFromDb });
    }

    // Hydrate job-titles store
    if (jobTitlesFromDb.length > 0) {
      useJobTitlesStore.setState({ jobTitles: jobTitlesFromDb });
    }

    _hydrated = true;
    console.log("[sync] Stores hydrated from Supabase");
  } catch (err) {
    console.error("[sync] Failed to hydrate stores:", err);
  }
}

/**
 * Set up write-through subscriptions: on Zustand state changes, persist to Supabase.
 * Uses a debounced approach to avoid flooding the DB.
 */
export function startWriteThrough(): void {
  if (!shouldSync()) return;

  // Clean up previous subscriptions
  stopWriteThrough();

  // All store write-throughs have been migrated to DB-first action services.
  // This function is kept as a no-op entry point for now so callers don't break;
  // it will be fully removed during final cleanup once Store 16 (auth) is migrated.

  // ─── Employees write-through — REMOVED (DB-first via employees-actions.service.ts) ───

  // ─── Leave write-through — REMOVED (DB-first via leave-actions.service.ts) ───

  // ─── Attendance write-through — REMOVED (DB-first via attendance-actions.service.ts) ───

  // ─── Payroll write-through — REMOVED (DB-first via payroll.store.ts + payroll-actions.service.ts) ───

  // ─── Loans write-through — REMOVED (DB-first via loans-actions.service.ts) ───

  // ─── Projects write-through — REMOVED (DB-first via projects.store.ts) ───

  // ─── Audit write-through — REMOVED (DB-first via audit.store.ts) ───
  // ─── Events write-through — REMOVED (DB-first via events.store.ts) ───

  // ─── Messaging write-through — REMOVED (DB-first via messaging-actions.service.ts) ───

  // ─── Tasks write-through — REMOVED (DB-first via tasks-actions.service.ts) ───

  // ─── Timesheets write-through — REMOVED (DB-first via timesheet-actions.service.ts) ───

  // ─── Notifications write-through — REMOVED (DB-first via notifications.store.ts) ───

  // ─── Location write-through — REMOVED (DB-first via location-actions.service.ts) ───

  console.log("[sync] Write-through subscriptions active");
}

/** Teardown all write-through subscriptions */
export function stopWriteThrough(): void {
  for (const unsub of _subscriptions) {
    unsub();
  }
  _subscriptions = [];
  _hydrated = false;
}

/**
 * Subscribe to Supabase Realtime postgres_changes for critical tables.
 * Updates Zustand stores when other sessions make changes in the DB.
 * Prevents write-back loops by only applying updates that differ from current state.
 */
let _realtimeRetries = 0;
const MAX_RETRIES = 3;

export function startRealtime(): void {
  if (!shouldSync()) return;

  // Don't attempt realtime if Supabase credentials are not configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[realtime] Skipped — Supabase credentials not configured");
    return;
  }

  stopRealtime();

  // Helper: wrap handler in try-catch so one handler error can't kill the channel
  const safe = <T>(fn: (payload: T) => void) => (payload: T) => {
    try { fn(payload); } catch (err) { console.error("[realtime] Handler error:", err); }
  };

  const supabase = createClient();
  const channel = supabase
    .channel("soren-realtime")
    // ── attendance_logs ──────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "attendance_logs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const log = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => {
          if (s.logs.find((l) => l.id === log.id)) return s;
          return { logs: [...s.logs, log as unknown as typeof s.logs[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "attendance_logs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const log = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => ({
          logs: s.logs.find((l) => l.id === log.id)
            ? s.logs.map((l) =>
              l.id === log.id
                ? (JSON.stringify(l) !== JSON.stringify(log) ? { ...l, ...log } as typeof l : l)
                : l
            )
            : [...s.logs, log as unknown as typeof s.logs[0]],
        }));
      })
    )
    // ── attendance_events (append-only) ─────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "attendance_events" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const evt = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => {
          if (s.events.find((e) => e.id === evt.id)) return s;
          return { events: [...s.events, evt as unknown as typeof s.events[0]] };
        });
      })
    )
    // ── leave_requests ───────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leave_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => {
          if (s.requests.find((r) => r.id === req.id)) return s;
          return { requests: [...s.requests, req as unknown as typeof s.requests[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "leave_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => ({
          requests: s.requests.map((r) =>
            r.id === req.id
              ? (JSON.stringify(r) !== JSON.stringify(req) ? { ...r, ...req } as typeof r : r)
              : r
          ),
        }));
      })
    )
    // ── overtime_requests ────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "overtime_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => {
          if (s.overtimeRequests.find((r) => r.id === req.id)) return s;
          return { overtimeRequests: [...s.overtimeRequests, req as unknown as typeof s.overtimeRequests[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "overtime_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => ({
          overtimeRequests: s.overtimeRequests.map((r) =>
            r.id === req.id
              ? (JSON.stringify(r) !== JSON.stringify(req) ? { ...r, ...req } as typeof r : r)
              : r
          ),
        }));
      })
    )
    // ── employees ────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "employees" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const emp = employeeFromDb(row);
        useEmployeesStore.setState((s) => {
          if (s.deletedEmployeeIds?.includes(emp.id)) return s;
          if (s.employees.find((e) => e.id === emp.id)) return s;
          return { employees: [...s.employees, emp] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "employees" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const emp = employeeFromDb(row);
        useEmployeesStore.setState((s) => ({
          employees: s.deletedEmployeeIds?.includes(emp.id)
            ? s.employees.filter((e) => e.id !== emp.id)
            : s.employees.map((e) =>
              e.id === emp.id
                ? (JSON.stringify(e) !== JSON.stringify(emp) ? { ...e, ...emp } : e)
                : e
            ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "employees" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useEmployeesStore.setState((s) => ({
          employees: s.employees.filter((e) => e.id !== id),
        }));
      })
    )
    // ── payslips ─────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "payslips" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const slip = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => {
          if (s.payslips.find((p) => p.id === slip.id)) return s;
          return { payslips: [...s.payslips, slip as unknown as typeof s.payslips[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "payslips" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const slip = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => ({
          payslips: s.payslips.map((p) =>
            p.id === slip.id
              ? (JSON.stringify(p) !== JSON.stringify(slip) ? { ...p, ...slip } as typeof p : p)
              : p
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "payslips" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        if (row?.id) {
          usePayrollStore.setState((s) => ({
            payslips: s.payslips.filter((p) => p.id !== row.id),
          }));
        }
      })
    )
    // ── payroll_runs ─────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "payroll_runs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const run = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => {
          if (s.runs.find((r) => r.id === run.id)) return s;
          return { runs: [...s.runs, run as unknown as typeof s.runs[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "payroll_runs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const run = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => ({
          runs: s.runs.map((r) =>
            r.id === run.id
              ? (JSON.stringify(r) !== JSON.stringify(run) ? { ...r, ...run } as typeof r : r)
              : r
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "payroll_runs" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        if (row?.id) {
          usePayrollStore.setState((s) => ({
            runs: s.runs.filter((r) => r.id !== row.id),
          }));
        }
      })
    )
    // ── payroll_adjustments ─────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "payroll_adjustments" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const adj = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => {
          if (s.adjustments.find((a) => a.id === adj.id)) return s;
          return { adjustments: [...s.adjustments, adj as unknown as typeof s.adjustments[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "payroll_adjustments" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const adj = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => ({
          adjustments: s.adjustments.map((a) =>
            a.id === adj.id
              ? (JSON.stringify(a) !== JSON.stringify(adj) ? { ...a, ...adj } as typeof a : a)
              : a
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "payroll_adjustments" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        if (row?.id) {
          usePayrollStore.setState((s) => ({
            adjustments: s.adjustments.filter((a) => a.id !== row.id),
          }));
        }
      })
    )
    // ── final_pay_computations ──────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "final_pay_computations" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const fp = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => {
          if (s.finalPayComputations.find((f) => f.id === fp.id)) return s;
          return { finalPayComputations: [...s.finalPayComputations, fp as unknown as typeof s.finalPayComputations[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "final_pay_computations" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const fp = keysToCamel(row) as Record<string, unknown>;
        usePayrollStore.setState((s) => ({
          finalPayComputations: s.finalPayComputations.map((f) =>
            f.id === fp.id
              ? (JSON.stringify(f) !== JSON.stringify(fp) ? { ...f, ...fp } as typeof f : f)
              : f
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "final_pay_computations" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        if (row?.id) {
          usePayrollStore.setState((s) => ({
            finalPayComputations: s.finalPayComputations.filter((f) => f.id !== row.id),
          }));
        }
      })
    )
    // ── loans ────────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "loans" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const loan = keysToCamel(row) as Record<string, unknown>;
        useLoansStore.setState((s) => {
          if (s.loans.find((l) => l.id === loan.id)) return s;
          return { loans: [...s.loans, { ...loan, deductions: [], balanceHistory: [], repaymentSchedule: [] } as unknown as typeof s.loans[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "loans" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const loan = keysToCamel(row) as Record<string, unknown>;
        useLoansStore.setState((s) => ({
          loans: s.loans.map((l) =>
            l.id === loan.id
              ? (JSON.stringify({ ...l, deductions: undefined, balanceHistory: undefined, repaymentSchedule: undefined }) !==
                 JSON.stringify(loan)
                ? { ...l, ...loan } as typeof l
                : l)
              : l
          ),
        }));
      })
    )
    // ── salary_change_requests ───────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "salary_change_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useEmployeesStore.setState((s) => {
          if (s.salaryRequests.find((r) => r.id === req.id)) return s;
          return { salaryRequests: [...s.salaryRequests, req as unknown as typeof s.salaryRequests[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "salary_change_requests" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const req = keysToCamel(row) as Record<string, unknown>;
        useEmployeesStore.setState((s) => ({
          salaryRequests: s.salaryRequests.map((r) =>
            r.id === req.id
              ? (JSON.stringify(r) !== JSON.stringify(req) ? { ...r, ...req } as typeof r : r)
              : r
          ),
        }));
      })
    )
    // ── leave_balances ───────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leave_balances" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const bal = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => {
          if (s.balances.find((b) => b.id === bal.id)) return s;
          return { balances: [...s.balances, bal as unknown as typeof s.balances[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "leave_balances" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const bal = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => ({
          balances: s.balances.map((b) =>
            b.id === bal.id
              ? (JSON.stringify(b) !== JSON.stringify(bal) ? { ...b, ...bal } as typeof b : b)
              : b
          ),
        }));
      })
    )
    // ── announcements ────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "announcements" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ann = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => {
          if (s.announcements.find((a) => a.id === ann.id)) return s;
          return { announcements: [...s.announcements, ann as unknown as typeof s.announcements[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "announcements" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ann = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => ({
          announcements: s.announcements.map((a) =>
            a.id === ann.id
              ? (JSON.stringify(a) !== JSON.stringify(ann) ? { ...a, ...ann } as typeof a : a)
              : a
          ),
        }));
      })
    )
    // ── text_channels ────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "text_channels" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ch = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => {
          if (s.channels.find((c) => c.id === ch.id)) return s;
          return { channels: [...s.channels, ch as unknown as typeof s.channels[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "text_channels" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ch = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => ({
          channels: s.channels.map((c) =>
            c.id === ch.id
              ? (JSON.stringify(c) !== JSON.stringify(ch) ? { ...c, ...ch } as typeof c : c)
              : c
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "text_channels" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useMessagingStore.setState((s) => ({
          channels: s.channels.filter((c) => c.id !== id),
          messages: s.messages.filter((m) => m.channelId !== id),
        }));
      })
    )
    // ── channel_messages ─────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "channel_messages" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const msg = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => {
          if (s.messages.find((m) => m.id === msg.id)) return s;
          return { messages: [...s.messages, msg as unknown as typeof s.messages[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "channel_messages" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const msg = keysToCamel(row) as Record<string, unknown>;
        useMessagingStore.setState((s) => ({
          messages: s.messages.map((m) =>
            m.id === msg.id
              ? (JSON.stringify(m) !== JSON.stringify(msg) ? { ...m, ...msg } as typeof m : m)
              : m
          ),
        }));
      })
    )
    // ── tasks ────────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tasks" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const task = keysToCamel(row) as Record<string, unknown>;
        useTasksStore.setState((s) => {
          if (s.tasks.find((t) => t.id === task.id)) return s;
          return { tasks: [...s.tasks, task as unknown as typeof s.tasks[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tasks" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const task = keysToCamel(row) as Record<string, unknown>;
        useTasksStore.setState((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === task.id
              ? (JSON.stringify(t) !== JSON.stringify(task) ? { ...t, ...task } as typeof t : t)
              : t
          ),
        }));
      })
    )
    // ── holidays ─────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "holidays" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const hol = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => {
          if (s.holidays.find((h) => h.id === hol.id)) return s;
          return { holidays: [...s.holidays, hol as unknown as typeof s.holidays[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "holidays" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const hol = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => ({
          holidays: s.holidays.map((h) =>
            h.id === hol.id
              ? (JSON.stringify(h) !== JSON.stringify(hol) ? { ...h, ...hol } as typeof h : h)
              : h
          ),
        }));
      })
    )
    // ── shift_templates ──────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "shift_templates" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const shift = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => {
          if (s.shiftTemplates.find((st) => st.id === shift.id)) return s;
          return { shiftTemplates: [...s.shiftTemplates, shift as unknown as typeof s.shiftTemplates[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "shift_templates" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const shift = keysToCamel(row) as Record<string, unknown>;
        useAttendanceStore.setState((s) => ({
          shiftTemplates: s.shiftTemplates.map((st) =>
            st.id === shift.id
              ? (JSON.stringify(st) !== JSON.stringify(shift) ? { ...st, ...shift } as typeof st : st)
              : st
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "shift_templates" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useAttendanceStore.setState((s) => ({
          shiftTemplates: s.shiftTemplates.filter((st) => st.id !== id),
        }));
      })
    )
    // ── employee_shifts (assignment junction table) ──────────
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "employee_shifts" },
      safe(({ eventType, new: newRow, old: oldRow }: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        if (eventType === "DELETE" && oldRow) {
          const empId = (oldRow.employee_id as string);
          if (!empId) return;
          useAttendanceStore.setState((s) => {
            const next = { ...s.employeeShifts };
            delete next[empId];
            return { employeeShifts: next };
          });
        } else if (newRow) {
          const empId = newRow.employee_id as string;
          const shiftId = newRow.shift_id as string;
          if (!empId || !shiftId) return;
          useAttendanceStore.setState((s) => {
            if (s.employeeShifts[empId] === shiftId) return s;
            return { employeeShifts: { ...s.employeeShifts, [empId]: shiftId } };
          });
        }
      })
    )
    // ── calendar_events ─────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "calendar_events" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const evt = keysToCamel(row) as Record<string, unknown>;
        useEventsStore.setState((s) => {
          if (s.events.find((e) => e.id === evt.id)) return s;
          return { events: [...s.events, evt as unknown as typeof s.events[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "calendar_events" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const evt = keysToCamel(row) as Record<string, unknown>;
        useEventsStore.setState((s) => ({
          events: s.events.map((e) =>
            e.id === evt.id
              ? (JSON.stringify(e) !== JSON.stringify(evt) ? { ...e, ...evt } as typeof e : e)
              : e
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "calendar_events" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useEventsStore.setState((s) => ({
          events: s.events.filter((e) => e.id !== id),
        }));
      })
    )
    // ── leave_policies ──────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leave_policies" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const pol = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => {
          if (s.policies.find((p) => p.id === pol.id)) return s;
          return { policies: [...s.policies, pol as unknown as typeof s.policies[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "leave_policies" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const pol = keysToCamel(row) as Record<string, unknown>;
        useLeaveStore.setState((s) => ({
          policies: s.policies.map((p) =>
            p.id === pol.id
              ? (JSON.stringify(p) !== JSON.stringify(pol) ? { ...p, ...pol } as typeof p : p)
              : p
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "leave_policies" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useLeaveStore.setState((s) => ({
          policies: s.policies.filter((p) => p.id !== id),
        }));
      })
    )
    // ── projects ────────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "projects" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const proj = keysToCamel(row) as Record<string, unknown>;
        useProjectsStore.setState((s) => {
          if (s.projects.find((p) => p.id === proj.id)) return s;
          return { projects: [...s.projects, proj as unknown as typeof s.projects[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "projects" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const proj = keysToCamel(row) as Record<string, unknown>;
        useProjectsStore.setState((s) => ({
          projects: s.projects.map((p) =>
            p.id === proj.id
              ? (JSON.stringify(p) !== JSON.stringify(proj) ? { ...p, ...proj } as typeof p : p)
              : p
          ),
        }));
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "projects" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useProjectsStore.setState((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
        }));
      })
    )
    // ── timesheets ──────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "timesheets" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ts = keysToCamel(row) as Record<string, unknown>;
        useTimesheetStore.setState((s) => {
          if (s.timesheets.find((t) => t.id === ts.id)) return s;
          return { timesheets: [...s.timesheets, ts as unknown as typeof s.timesheets[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "timesheets" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const ts = keysToCamel(row) as Record<string, unknown>;
        useTimesheetStore.setState((s) => ({
          timesheets: s.timesheets.map((t) =>
            t.id === ts.id
              ? (JSON.stringify(t) !== JSON.stringify(ts) ? { ...t, ...ts } as typeof t : t)
              : t
          ),
        }));
      })
    )
    // ── notification_rules ──────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notification_rules" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const rule = keysToCamel(row) as Record<string, unknown>;
        useNotificationsStore.setState((s) => {
          if (s.rules.find((r) => r.id === rule.id)) return s;
          return { rules: [...s.rules, rule as unknown as typeof s.rules[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notification_rules" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const rule = keysToCamel(row) as Record<string, unknown>;
        useNotificationsStore.setState((s) => ({
          rules: s.rules.map((r) =>
            r.id === rule.id
              ? (JSON.stringify(r) !== JSON.stringify(rule) ? { ...r, ...rule } as typeof r : r)
              : r
          ),
        }));
      })
    )
    // ── notification_logs (realtime) ────────────────────────
    // When another user's write-through inserts a log destined for us,
    // this listener ensures our in-app notification tab updates immediately
    // without requiring a page refresh.
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notification_logs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const log = keysToCamel(row) as Record<string, unknown>;
        useNotificationsStore.setState((s) => {
          if (s.logs.find((l) => l.id === log.id)) return s;
          return { logs: [log as unknown as typeof s.logs[0], ...s.logs].slice(0, 500) };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notification_logs" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const log = keysToCamel(row) as Record<string, unknown>;
        useNotificationsStore.setState((s) => ({
          logs: s.logs.map((l) =>
            l.id === log.id
              ? (JSON.stringify(l) !== JSON.stringify(log) ? { ...l, ...log } as typeof l : l)
              : l
          ),
        }));
      })
    )
    .subscribe((status: string, err?: unknown) => {
      if (status === "SUBSCRIBED") {
        _realtimeRetries = 0;
        console.log("[realtime] Connected — watching 26 tables");
      }
      if (status === "CHANNEL_ERROR") {
        const errMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : JSON.stringify(err) ?? "");
        if (!errMsg) {
          // Empty error usually means misconfigured credentials — don't retry
          console.warn("[realtime] Channel error (check Supabase URL/key configuration)");
          return;
        }
        // "mismatch between server and client bindings" = tables missing from
        // supabase_realtime publication. This is a config issue — retrying won't help.
        if (errMsg.includes("mismatch")) {
          console.warn(
            "[realtime] Server/client binding mismatch — run migration 040 to add missing tables to supabase_realtime publication"
          );
          return;
        }
        // JWT expired — refresh the session first, then reconnect.
        // This is normal behaviour when a browser tab is idle and the access token expires.
        if (errMsg.includes("InvalidJWTToken") || errMsg.includes("Token has expired") || errMsg.includes("expired")) {
          console.info("[realtime] JWT expired — refreshing session before reconnect");
          const client = createClient();
          client.auth.refreshSession().then(({ error: refreshErr }: { error: Error | null }) => {
            if (refreshErr) {
              console.info("[realtime] Session refresh failed — user may need to log in again");
              // Don't spam retries — the auth listener will redirect when needed
              return;
            }
            // Reconnect after a short delay to let the new token propagate
            setTimeout(() => startRealtime(), 1000);
          });
          return;
        }
        console.warn("[realtime] Channel error", errMsg);
        // Auto-retry with backoff (only for transient errors)
        if (_realtimeRetries < MAX_RETRIES) {
          _realtimeRetries++;
          const delay = _realtimeRetries * 2000;
          console.log(`[realtime] Retrying in ${delay}ms (attempt ${_realtimeRetries}/${MAX_RETRIES})...`);
          setTimeout(() => startRealtime(), delay);
        }
      }
      if (status === "TIMED_OUT") {
        console.warn("[realtime] Connection timed out, retrying...");
        setTimeout(() => startRealtime(), 3000);
      }
    });

  _realtimeChannel = channel;
}

/** Teardown Supabase Realtime subscriptions */
export function stopRealtime(): void {
  if (_realtimeChannel) {
    createClient().removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

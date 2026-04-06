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
  employeesDb,
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
import { useNotificationsStore } from "@/store/notifications.store";
import { useLocationStore } from "@/store/location.store";
import { useAuthStore } from "@/store/auth.store";

let _hydrated = false;
let _subscriptions: (() => void)[] = [];
let _realtimeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

/**
 * Pull all data from Supabase and replace Zustand store state.
 * Call this once after successful login or on app mount.
 */
export async function hydrateAllStores(): Promise<void> {
  return hydrateAllStoresInternal();
}

/**
 * Force a full re-hydration from Supabase, bypassing the `_hydrated` guard.
 * Use after operations (like attendance reset) that modify the DB outside the
 * write-through flow so the local store is guaranteed to match the DB state.
 */
export async function forceRehydrate(): Promise<void> {
  _hydrated = false;
  await hydrateAllStoresInternal();
}

async function hydrateAllStoresInternal(): Promise<void> {
  if (!shouldSync()) return;
  if (_hydrated) return;

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
    ]);

    // Fetch employee-shift assignments separately (returns a mapping, not an array)
    const employeeShiftsMap = await attendanceDb.fetchEmployeeShifts();

    // Hydrate employees store
    if (employees.length > 0) {
      useEmployeesStore.setState({
        employees,
        salaryRequests,
        salaryHistory,
      });
    }

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

    // Hydrate payroll store
    if (payslips.length > 0 || payrollRuns.length > 0 || payrollAdjustments.length > 0 || finalPayComputations.length > 0) {
      usePayrollStore.setState({
        ...(payslips.length > 0 ? { payslips } : {}),
        ...(payrollRuns.length > 0 ? { runs: payrollRuns } : {}),
        ...(payrollAdjustments.length > 0 ? { adjustments: payrollAdjustments } : {}),
        ...(finalPayComputations.length > 0 ? { finalPayComputations } : {}),
        ...(payScheduleRows.length > 0 ? { paySchedule: payScheduleRows[0] } : {}),
        ...(deductionOverridesRows.length > 0 ? { deductionOverrides: deductionOverridesRows } : {}),
        ...(globalDefaultsRows.length > 0 ? { globalDefaults: globalDefaultsRows } : {}),
        ...(signatureConfigRow ? { signatureConfig: signatureConfigRow } : {}),
      });
    }

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

    // Hydrate tasks store
    if (taskGroups.length > 0 || tasks.length > 0 || completionReports.length > 0 || taskComments.length > 0 || taskTagsList.length > 0) {
      useTasksStore.setState({
        ...(taskGroups.length > 0 ? { groups: taskGroups } : {}),
        ...(tasks.length > 0 ? { tasks } : {}),
        ...(completionReports.length > 0 ? { completionReports } : {}),
        ...(taskComments.length > 0 ? { comments: taskComments } : {}),
        ...(taskTagsList.length > 0 ? { taskTags: taskTagsList } : {}),
      });
    }

    // Hydrate timesheet store
    if (timesheets.length > 0 || ruleSets.length > 0) {
      useTimesheetStore.setState({
        ...(timesheets.length > 0 ? { timesheets } : {}),
        ...(ruleSets.length > 0 ? { ruleSets } : {}),
      });
    }

    // Hydrate notifications store
    if (notificationLogs.length > 0 || notificationRules.length > 0) {
      useNotificationsStore.setState({
        ...(notificationLogs.length > 0 ? { logs: notificationLogs } : {}),
        ...(notificationRules.length > 0 ? { rules: notificationRules } : {}),
      });
    }

    // Hydrate location store
    if (locationPings.length > 0 || sitePhotos.length > 0 || breakRecords.length > 0) {
      useLocationStore.setState({
        ...(locationPings.length > 0 ? { pings: locationPings } : {}),
        ...(sitePhotos.length > 0 ? { photos: sitePhotos } : {}),
        ...(breakRecords.length > 0 ? { breaks: breakRecords } : {}),
      });
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

  // Determine write scope — only admin/hr manage HR data (employees meta, leave balances, attendance logs)
  const role = useAuthStore.getState().currentUser?.role ?? "";
  const isAdminOrHr = ["admin", "hr"].includes(role);

  // ─── Employees write-through ──────────────────────────────
  _subscriptions.push(
    useEmployeesStore.subscribe(
      (state, prevState) => {
        // Detect changed employees — only admin/hr can write employee records
        if (isAdminOrHr) {
          for (const emp of state.employees) {
            const prev = prevState.employees.find((e) => e.id === emp.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(emp)) {
              employeesDb.upsert(emp);
            }
          }
          // Detect deletions
          for (const prev of prevState.employees) {
            if (!state.employees.find((e) => e.id === prev.id)) {
              employeesDb.remove(prev.id);
            }
          }
        }
        // Salary requests
        for (const req of state.salaryRequests) {
          const prev = prevState.salaryRequests.find((r) => r.id === req.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(req)) {
            salaryDb.upsertRequest(req);
          }
        }
        // Salary history
        for (const entry of state.salaryHistory) {
          if (!prevState.salaryHistory.find((h) => h.id === entry.id)) {
            salaryDb.insertHistory(entry);
          }
        }
      }
    )
  );

  // ─── Leave write-through ──────────────────────────────────
  _subscriptions.push(
    useLeaveStore.subscribe(
      (state, prevState) => {
        // Leave requests: any authenticated user can submit/update their own
        for (const req of state.requests) {
          const prev = prevState.requests.find((r) => r.id === req.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(req)) {
            leaveDb.upsertRequest(req);
          }
        }
        // Leave balances and policies: admin/hr only
        if (isAdminOrHr) {
          for (const bal of state.balances) {
            const prev = prevState.balances.find((b) => b.id === bal.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(bal)) {
              leaveDb.upsertBalance(bal);
            }
          }
          for (const pol of state.policies) {
            const prev = prevState.policies.find((p) => p.id === pol.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(pol)) {
              leaveDb.upsertPolicy(pol);
            }
          }
          for (const prev of prevState.policies) {
            if (!state.policies.find((p) => p.id === prev.id)) {
              leaveDb.deletePolicy(prev.id);
            }
          }
        }
      }
    )
  );

  // ─── Attendance write-through ─────────────────────────────
  _subscriptions.push(
    useAttendanceStore.subscribe(
      (state, prevState) => {
        // Logs: admin/hr sync all logs; employees sync only their own log entries
        const currentUserState = useAuthStore.getState().currentUser;
        const currentEmployees = useEmployeesStore.getState().employees;
        const myEmployeeId = currentEmployees.find(
          (e) => e.profileId === currentUserState?.id || e.email === currentUserState?.email || e.name === currentUserState?.name
        )?.id;

        for (const log of state.logs) {
          const prev = prevState.logs.find((l) => l.id === log.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(log)) {
            // Admin/HR sync all; employees only sync their own
            if (isAdminOrHr || log.employeeId === myEmployeeId) {
              attendanceDb.upsertLog(log);
            }
          }
        }
        // Events (append-only): all roles — employees clock in/out
        for (const evt of state.events) {
          if (!prevState.events.find((e) => e.id === evt.id)) {
            attendanceDb.insertEvent(evt);
          }
        }
        // Holidays, shifts, exceptions, penalties, shifts: admin/hr only
        if (isAdminOrHr) {
          for (const h of state.holidays) {
            const prev = prevState.holidays.find((ph) => ph.id === h.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(h)) {
              attendanceDb.upsertHoliday(h);
            }
          }
          for (const prev of prevState.holidays) {
            if (!state.holidays.find((h) => h.id === prev.id)) {
              attendanceDb.deleteHoliday(prev.id);
            }
          }
          for (const s of state.shiftTemplates) {
            const prev = prevState.shiftTemplates.find((ps) => ps.id === s.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(s)) {
              attendanceDb.upsertShift(s);
            }
          }
          for (const prev of prevState.shiftTemplates) {
            if (!state.shiftTemplates.find((s) => s.id === prev.id)) {
              attendanceDb.deleteShift(prev.id);
            }
          }
        }
        // Overtime requests: all roles — employees submit their own
        for (const req of state.overtimeRequests) {
          const prev = prevState.overtimeRequests.find((r) => r.id === req.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(req)) {
            attendanceDb.upsertOvertimeRequest(req);
          }
        }
        // Evidence (append-only): all roles
        for (const ev of state.evidence) {
          if (!prevState.evidence.find((e) => e.id === ev.id)) {
            attendanceDb.insertEvidence(ev);
          }
        }
        // Exceptions and penalties: admin/hr only
        if (isAdminOrHr) {
          for (const exc of state.exceptions) {
            const prev = prevState.exceptions.find((e) => e.id === exc.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(exc)) {
              attendanceDb.upsertException(exc);
            }
          }
          for (const pen of state.penalties) {
            const prev = prevState.penalties.find((p) => p.id === pen.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(pen)) {
              attendanceDb.upsertPenalty(pen);
            }
          }
        }
        // Employee-shift assignments: admin/hr only
        if (isAdminOrHr) {
          for (const [empId, shiftId] of Object.entries(state.employeeShifts)) {
            if (prevState.employeeShifts[empId] !== shiftId) {
              attendanceDb.upsertEmployeeShift(empId, shiftId);
            }
          }
          for (const empId of Object.keys(prevState.employeeShifts)) {
            if (!(empId in state.employeeShifts)) {
              attendanceDb.deleteEmployeeShift(empId);
            }
          }
        }
      }
    )
  );

  // ─── Payroll write-through ────────────────────────────────
  _subscriptions.push(
    usePayrollStore.subscribe(
      (state, prevState) => {
        // Only roles with payroll write access may push mutations through the browser
        // client. Employees, supervisors, and auditors are read-only on payslips —
        // their mutations go through API routes (admin client) to bypass RLS.
        const payrollRole = useAuthStore.getState().currentUser?.role ?? "";
        const canWritePayroll = ["admin", "hr", "finance", "payroll_admin"].includes(payrollRole);
        if (!canWritePayroll) return;

        // Build set of real employee IDs to guard FK integrity.
        // Seed/demo payslips use placeholder IDs (EMP001 etc.) that may not
        // exist in Supabase — skip those to avoid FK constraint violations.
        const validEmployeeIds = new Set(
          useEmployeesStore.getState().employees.map((e) => e.id)
        );

        for (const ps of state.payslips) {
          if (!validEmployeeIds.has(ps.employeeId)) continue; // skip seed data
          const prev = prevState.payslips.find((p) => p.id === ps.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(ps)) {
            payrollDb.upsertPayslip(ps);
          }
        }
        for (const run of state.runs) {
          const prev = prevState.runs.find((r) => r.id === run.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(run)) {
            payrollDb.upsertRun(run);
          }
        }
        for (const adj of state.adjustments) {
          if (!validEmployeeIds.has(adj.employeeId)) continue;
          const prev = prevState.adjustments.find((a) => a.id === adj.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(adj)) {
            payrollDb.upsertAdjustment(adj);
          }
        }
        for (const fp of state.finalPayComputations) {
          if (!validEmployeeIds.has(fp.employeeId)) continue;
          const prev = prevState.finalPayComputations.find((f) => f.id === fp.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(fp)) {
            payrollDb.upsertFinalPay(fp);
          }
        }
        if (JSON.stringify(state.paySchedule) !== JSON.stringify(prevState.paySchedule)) {
          payrollDb.upsertPaySchedule({ id: "default", ...state.paySchedule });
        }

        // ─── Deduction Overrides write-through ─────────────────
        // Upsert new or changed overrides
        for (const ov of state.deductionOverrides) {
          const prev = prevState.deductionOverrides.find(
            (d) => d.employeeId === ov.employeeId && d.deductionType === ov.deductionType
          );
          if (!prev || JSON.stringify(prev) !== JSON.stringify(ov)) {
            payrollDb.upsertDeductionOverride(ov);
          }
        }
        // Delete removed overrides
        for (const prev of prevState.deductionOverrides) {
          const stillExists = state.deductionOverrides.find(
            (d) => d.employeeId === prev.employeeId && d.deductionType === prev.deductionType
          );
          if (!stillExists) {
            payrollDb.deleteDeductionOverride(prev.employeeId, prev.deductionType);
          }
        }

        // ─── Global Defaults write-through ─────────────────────
        for (const gd of state.globalDefaults) {
          const prev = prevState.globalDefaults.find((d) => d.deductionType === gd.deductionType);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(gd)) {
            payrollDb.upsertGlobalDefault(gd as unknown as Record<string, unknown>);
          }
        }

        // ─── Signature Config write-through ────────────────────
        if (JSON.stringify(state.signatureConfig) !== JSON.stringify(prevState.signatureConfig)) {
          payrollDb.upsertSignatureConfig(state.signatureConfig);
        }
      }
    )
  );

  // ─── Loans write-through ──────────────────────────────────
  _subscriptions.push(
    useLoansStore.subscribe(
      (state, prevState) => {
        for (const loan of state.loans) {
          const prev = prevState.loans.find((l) => l.id === loan.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(loan)) {
            // Separate the embedded arrays from the loan row (repaymentSchedule / balanceHistory are child sub-tables, not loan columns)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { deductions, repaymentSchedule: _repaymentSchedule, balanceHistory: _balanceHistory, ...loanRow } = loan;
            loansDb.upsert(loanRow as typeof loanRow & { id: string });
            // Sync new deductions
            if (deductions) {
              const prevDeds = prev?.deductions ?? [];
              for (const ded of deductions) {
                if (!prevDeds.find((d) => d.id === ded.id)) {
                  // Ensure the referenced payslip exists in the DB first (FK guard).
                  // The payroll write-through is fire-and-forget, so we explicitly
                  // upsert the payslip before inserting the loan deduction to avoid
                  // a race condition that would violate fk_ld_payslip.
                  const referencedPayslip = usePayrollStore
                    .getState()
                    .payslips.find((p) => p.id === ded.payslipId);
                  if (referencedPayslip) {
                    payrollDb.upsertPayslip(referencedPayslip).then(() => {
                      loansDb.insertDeduction(ded);
                    });
                  } else {
                    loansDb.insertDeduction(ded);
                  }
                }
              }
            }
          }
        }
      }
    )
  );

  // ─── Projects write-through ───────────────────────────────
  _subscriptions.push(
    useProjectsStore.subscribe(
      (state, prevState) => {
        for (const proj of state.projects) {
          const prev = prevState.projects.find((p) => p.id === proj.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(proj)) {
            projectsDb.upsert(proj);
          }
        }
        for (const prev of prevState.projects) {
          if (!state.projects.find((p) => p.id === prev.id)) {
            projectsDb.remove(prev.id);
          }
        }
      }
    )
  );

  // ─── Audit write-through ──────────────────────────────────
  _subscriptions.push(
    useAuditStore.subscribe(
      (state, prevState) => {
        for (const entry of state.logs) {
          if (!prevState.logs.find((l) => l.id === entry.id)) {
            auditDb.insert(entry);
          }
        }
      }
    )
  );

  // ─── Events write-through ─────────────────────────────────
  _subscriptions.push(
    useEventsStore.subscribe(
      (state, prevState) => {
        for (const evt of state.events) {
          const prev = prevState.events.find((e) => e.id === evt.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(evt)) {
            eventsDb.upsert(evt);
          }
        }
        for (const prev of prevState.events) {
          if (!state.events.find((e) => e.id === prev.id)) {
            eventsDb.remove(prev.id);
          }
        }
      }
    )
  );

  // ─── Messaging write-through ──────────────────────────────
  _subscriptions.push(
    useMessagingStore.subscribe(
      (state, prevState) => {
        // Use an async IIFE so channels are fully committed to Supabase before
        // any message insert runs. This prevents the FK constraint violation
        // (channel_messages_channel_id_fkey) that occurs when a seed-only channel
        // has never been persisted to Supabase and a user sends their first message.
        (async () => {
          // Announcements (no FK dependency, can run in parallel)
          const announcementOps = state.announcements
            .filter((ann) => {
              const prev = prevState.announcements.find((a) => a.id === ann.id);
              return !prev || JSON.stringify(prev) !== JSON.stringify(ann);
            })
            .map((ann) => messagingDb.upsertAnnouncement(ann));

          // Channels — await all upserts before touching messages
          for (const ch of state.channels) {
            const prev = prevState.channels.find((c) => c.id === ch.id);
            if (!prev || JSON.stringify(prev) !== JSON.stringify(ch)) {
              await messagingDb.upsertChannel(ch);
            }
          }
          for (const prev of prevState.channels) {
            if (!state.channels.find((c) => c.id === prev.id)) {
              messagingDb.deleteChannel(prev.id);
            }
          }

          // Messages — for each new message, guarantee its parent channel exists
          // in Supabase first (handles seed-only channels that were never synced)
          for (const msg of state.messages) {
            const prev = prevState.messages.find((m) => m.id === msg.id);
            if (!prev) {
              // Ensure the parent channel is persisted before the message
              const parentChannel = state.channels.find((c) => c.id === msg.channelId);
              if (parentChannel) {
                await messagingDb.upsertChannel(parentChannel);
              }
              await messagingDb.insertMessage(msg);
            } else if (JSON.stringify(prev) !== JSON.stringify(msg)) {
              await messagingDb.upsertMessage(msg);
            }
          }

          await Promise.all(announcementOps);
        })();
      }
    )
  );

  // ─── Tasks write-through ──────────────────────────────────
  _subscriptions.push(
    useTasksStore.subscribe(
      (state, prevState) => {
        // Task groups
        for (const g of state.groups) {
          const prev = prevState.groups.find((pg) => pg.id === g.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(g)) {
            tasksDb.upsertGroup(g);
          }
        }
        for (const prev of prevState.groups) {
          if (!state.groups.find((g) => g.id === prev.id)) {
            tasksDb.deleteGroup(prev.id);
          }
        }
        // Tasks
        for (const t of state.tasks) {
          const prev = prevState.tasks.find((pt) => pt.id === t.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(t)) {
            tasksDb.upsertTask(t);
          }
        }
        for (const prev of prevState.tasks) {
          if (!state.tasks.find((t) => t.id === prev.id)) {
            tasksDb.deleteTask(prev.id);
          }
        }
        // Completion reports
        for (const r of state.completionReports) {
          const prev = prevState.completionReports.find((pr) => pr.id === r.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) {
            tasksDb.upsertCompletionReport(r);
          }
        }
        // Comments (append-only)
        for (const c of state.comments) {
          if (!prevState.comments.find((pc) => pc.id === c.id)) {
            tasksDb.insertComment(c);
          }
        }
        // Task tags
        for (const tag of state.taskTags) {
          const prev = prevState.taskTags.find((pt) => pt.id === tag.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(tag)) {
            tasksDb.upsertTag(tag);
          }
        }
        for (const prev of prevState.taskTags) {
          if (!state.taskTags.find((t) => t.id === prev.id)) {
            tasksDb.deleteTag(prev.id);
          }
        }
      }
    )
  );

  // ─── Timesheets write-through ─────────────────────────────
  _subscriptions.push(
    useTimesheetStore.subscribe(
      (state, prevState) => {
        for (const ts of state.timesheets) {
          const prev = prevState.timesheets.find((pt) => pt.id === ts.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(ts)) {
            timesheetsDb.upsertTimesheet(ts);
          }
        }
        for (const rs of state.ruleSets) {
          const prev = prevState.ruleSets.find((pr) => pr.id === rs.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(rs)) {
            timesheetsDb.upsertRuleSet(rs);
          }
        }
        for (const prev of prevState.ruleSets) {
          if (!state.ruleSets.find((rs) => rs.id === prev.id)) {
            timesheetsDb.deleteRuleSet(prev.id);
          }
        }
      }
    )
  );

  // ─── Notifications write-through ──────────────────────────
  _subscriptions.push(
    useNotificationsStore.subscribe(
      (state, prevState) => {
        // Logs (append-only)
        for (const log of state.logs) {
          if (!prevState.logs.find((pl) => pl.id === log.id)) {
            notificationsDb.insertLog(log);
          }
        }
        // Rules
        for (const rule of state.rules) {
          const prev = prevState.rules.find((pr) => pr.id === rule.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(rule)) {
            notificationsDb.upsertRule(rule);
          }
        }
      }
    )
  );

  // ─── Location write-through ───────────────────────────────
  _subscriptions.push(
    useLocationStore.subscribe(
      (state, prevState) => {
        // Pings (append-only)
        for (const ping of state.pings) {
          if (!prevState.pings.find((pp) => pp.id === ping.id)) {
            locationDb.insertPing(ping);
          }
        }
        // Photos
        for (const photo of state.photos) {
          if (!prevState.photos.find((pp) => pp.id === photo.id)) {
            locationDb.upsertPhoto(photo);
          }
        }
        // Breaks
        for (const br of state.breaks) {
          const prev = prevState.breaks.find((pb) => pb.id === br.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(br)) {
            locationDb.upsertBreak(br);
          }
        }
      }
    )
  );

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
          logs: s.logs.map((l) =>
            l.id === log.id
              ? (JSON.stringify(l) !== JSON.stringify(log) ? { ...l, ...log } as typeof l : l)
              : l
          ),
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
        const emp = keysToCamel(row) as Record<string, unknown>;
        useEmployeesStore.setState((s) => {
          if (s.employees.find((e) => e.id === emp.id)) return s;
          return { employees: [...s.employees, emp as unknown as typeof s.employees[0]] };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "employees" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const emp = keysToCamel(row) as Record<string, unknown>;
        useEmployeesStore.setState((s) => ({
          employees: s.employees.map((e) =>
            e.id === emp.id
              ? (JSON.stringify(e) !== JSON.stringify(emp) ? { ...e, ...emp } as typeof e : e)
              : e
          ),
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
    .subscribe((status: string, err?: unknown) => {
      if (status === "SUBSCRIBED") {
        _realtimeRetries = 0;
        console.log("[realtime] Connected — watching 28 tables");
      }
      if (status === "CHANNEL_ERROR") {
        const errMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : "");
        if (!errMsg) {
          // Empty error usually means misconfigured credentials — don't retry
          console.warn("[realtime] Channel error (check Supabase URL/key configuration)");
          return;
        }
        console.error("[realtime] Channel error", errMsg);
        // Auto-retry with backoff
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

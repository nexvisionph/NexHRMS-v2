"use client";

/**
 * Supabase Realtime Service
 *
 * Subscribes to postgres_changes events for multi-tab/multi-user sync.
 * When another session modifies data in Supabase, the realtime channel
 * patches the local Zustand stores so the UI stays current.
 *
 * Extracted from sync.service.ts during Phase 5 migration.
 */

import {
  shouldSync,
  employeeFromDb,
  createClient,
} from "./db.service";
import { keysToCamel } from "@/lib/db-utils";
import { useEmployeesStore } from "@/store/employees.store";
import { useLeaveStore } from "@/store/leave.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { useProjectsStore } from "@/store/projects.store";
import { useEventsStore } from "@/store/events.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useDisciplinaryStore } from "@/store/disciplinary.store";

let _realtimeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

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
    // ── disciplinary_cases ───────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "disciplinary_cases" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const disciplinaryCase = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.cases.find((c) => c.id === disciplinaryCase.id);
          if (!existing) return { cases: [disciplinaryCase as unknown as typeof s.cases[0], ...s.cases] };
          if (JSON.stringify(existing) === JSON.stringify(disciplinaryCase)) return s;
          return {
            cases: s.cases.map((c) =>
              c.id === disciplinaryCase.id ? { ...c, ...disciplinaryCase } as typeof c : c
            ),
          };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "disciplinary_cases" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const disciplinaryCase = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.cases.find((c) => c.id === disciplinaryCase.id);
          if (!existing) return { cases: [disciplinaryCase as unknown as typeof s.cases[0], ...s.cases] };
          if (JSON.stringify(existing) === JSON.stringify(disciplinaryCase)) return s;
          return {
            cases: s.cases.map((c) =>
              c.id === disciplinaryCase.id ? { ...c, ...disciplinaryCase } as typeof c : c
            ),
          };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "disciplinary_cases" },
      safe(({ old: row }: { old: Record<string, unknown> }) => {
        const id = row?.id as string;
        if (!id) return;
        useDisciplinaryStore.setState((s) => ({
          cases: s.cases.filter((c) => c.id !== id),
          ntes: s.ntes.filter((n) => n.caseId !== id),
          nods: s.nods.filter((n) => n.caseId !== id),
        }));
      })
    )
    // ── nte_records ──────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "nte_records" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const nte = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.ntes.find((n) => n.id === nte.id);
          if (!existing) return { ntes: [nte as unknown as typeof s.ntes[0], ...s.ntes] };
          if (JSON.stringify(existing) === JSON.stringify(nte)) return s;
          return {
            ntes: s.ntes.map((n) => n.id === nte.id ? { ...n, ...nte } as typeof n : n),
          };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "nte_records" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const nte = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.ntes.find((n) => n.id === nte.id);
          if (!existing) return { ntes: [nte as unknown as typeof s.ntes[0], ...s.ntes] };
          if (JSON.stringify(existing) === JSON.stringify(nte)) return s;
          return {
            ntes: s.ntes.map((n) => n.id === nte.id ? { ...n, ...nte } as typeof n : n),
          };
        });
      })
    )
    // ── nod_records ──────────────────────────────────────────
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "nod_records" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const nod = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.nods.find((n) => n.id === nod.id);
          if (!existing) return { nods: [nod as unknown as typeof s.nods[0], ...s.nods] };
          if (JSON.stringify(existing) === JSON.stringify(nod)) return s;
          return {
            nods: s.nods.map((n) => n.id === nod.id ? { ...n, ...nod } as typeof n : n),
          };
        });
      })
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "nod_records" },
      safe(({ new: row }: { new: Record<string, unknown> }) => {
        const nod = keysToCamel(row) as Record<string, unknown>;
        useDisciplinaryStore.setState((s) => {
          const existing = s.nods.find((n) => n.id === nod.id);
          if (!existing) return { nods: [nod as unknown as typeof s.nods[0], ...s.nods] };
          if (JSON.stringify(existing) === JSON.stringify(nod)) return s;
          return {
            nods: s.nods.map((n) => n.id === nod.id ? { ...n, ...nod } as typeof n : n),
          };
        });
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
        console.log("[realtime] Connected — watching 29 tables");
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


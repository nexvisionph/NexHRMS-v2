"use client";

/**
 * TanStack Query hook for Attendance data.
 *
 * Covers all 9 entity types:
 *   1. Attendance logs
 *   2. Attendance events (append-only ledger)
 *   3. Holidays
 *   4. Shift templates
 *   5. Overtime requests
 *   6. Attendance exceptions
 *   7. Penalty records
 *   8. Attendance evidence
 *   9. Employee-shift assignments map
 *
 * Query keys are exported for external cache access (e.g. realtime patches).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import type {
    AttendanceLog, AttendanceEvent, AttendanceEvidence,
    AttendanceException, OvertimeRequest, ShiftTemplate, PenaltyRecord,
    Holiday, AttendanceMethod, AttendanceFlag,
} from "@/types";
import { attendanceDb } from "@/services/db.service";

// ─── Query Keys ──────────────────────────────────────────────

export const ATTENDANCE_LOGS_KEY = ["attendance-logs"] as const;
export const ATTENDANCE_EVENTS_KEY = ["attendance-events"] as const;
export const HOLIDAYS_KEY = ["holidays"] as const;
export const SHIFTS_KEY = ["shift-templates"] as const;
export const OVERTIME_REQUESTS_KEY = ["overtime-requests"] as const;
export const ATTENDANCE_EXCEPTIONS_KEY = ["attendance-exceptions"] as const;
export const PENALTIES_KEY = ["penalty-records"] as const;
export const ATTENDANCE_EVIDENCE_KEY = ["attendance-evidence"] as const;
export const EMPLOYEE_SHIFTS_KEY = ["employee-shifts"] as const;

/** Umbrella key for batch invalidation */
export const ATTENDANCE_QUERY_KEY = ["attendance"] as const;

// ─── Individual Query Hooks ──────────────────────────────────

export function useAttendanceLogsQuery() {
    return useQuery({
        queryKey: ATTENDANCE_LOGS_KEY,
        queryFn: () => attendanceDb.fetchLogs(),
        staleTime: 60 * 1000,
    });
}

export function useAttendanceEventsQuery() {
    return useQuery({
        queryKey: ATTENDANCE_EVENTS_KEY,
        queryFn: () => attendanceDb.fetchEvents(),
        staleTime: 60 * 1000,
    });
}

export function useHolidaysQuery() {
    return useQuery({
        queryKey: HOLIDAYS_KEY,
        queryFn: () => attendanceDb.fetchHolidays(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useShiftsQuery() {
    return useQuery({
        queryKey: SHIFTS_KEY,
        queryFn: () => attendanceDb.fetchShifts(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useOvertimeRequestsQuery() {
    return useQuery({
        queryKey: OVERTIME_REQUESTS_KEY,
        queryFn: () => attendanceDb.fetchOvertimeRequests(),
        staleTime: 60 * 1000,
    });
}

export function useAttendanceExceptionsQuery() {
    return useQuery({
        queryKey: ATTENDANCE_EXCEPTIONS_KEY,
        queryFn: () => attendanceDb.fetchExceptions(),
        staleTime: 60 * 1000,
    });
}

export function usePenaltiesQuery() {
    return useQuery({
        queryKey: PENALTIES_KEY,
        queryFn: () => attendanceDb.fetchPenalties(),
        staleTime: 2 * 60 * 1000,
    });
}

export function useAttendanceEvidenceQuery() {
    return useQuery({
        queryKey: ATTENDANCE_EVIDENCE_KEY,
        queryFn: () => attendanceDb.fetchEvidence(),
        staleTime: 2 * 60 * 1000,
    });
}

export function useEmployeeShiftsQuery() {
    return useQuery({
        queryKey: EMPLOYEE_SHIFTS_KEY,
        queryFn: () => attendanceDb.fetchEmployeeShifts(),
        staleTime: 5 * 60 * 1000,
    });
}

// ─── Mutations ───────────────────────────────────────────────

// -- Logs

export function useUpsertLogMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (log: AttendanceLog) => {
            const ok = await attendanceDb.upsertLog(log);
            if (!ok) throw new Error("Failed to upsert attendance log");
            return log;
        },
        onSuccess: (log) => {
            queryClient.setQueryData<AttendanceLog[]>(ATTENDANCE_LOGS_KEY, (prev) => {
                const existing = (prev ?? []).find((l) => l.id === log.id);
                if (existing) return (prev ?? []).map((l) => l.id === log.id ? log : l);
                return [...(prev ?? []), log];
            });
        },
    });
}

export function useBatchUpsertLogsMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (logs: AttendanceLog[]) => {
            const ok = await attendanceDb.batchUpsertLogs(logs);
            if (!ok) throw new Error("Failed to batch upsert logs");
            return logs;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ATTENDANCE_LOGS_KEY });
        },
    });
}

// -- Events

export function useInsertEventMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (event: AttendanceEvent) => {
            const ok = await attendanceDb.insertEvent(event);
            if (!ok) throw new Error("Failed to insert attendance event");
            return event;
        },
        onSuccess: (event) => {
            queryClient.setQueryData<AttendanceEvent[]>(ATTENDANCE_EVENTS_KEY, (prev) => {
                if ((prev ?? []).find((e) => e.id === event.id)) return prev ?? [];
                return [event, ...(prev ?? [])];
            });
        },
    });
}

// -- Holidays

export function useUpsertHolidayMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (holiday: Holiday) => {
            const ok = await attendanceDb.upsertHoliday(holiday);
            if (!ok) throw new Error("Failed to upsert holiday");
            return holiday;
        },
        onSuccess: (holiday) => {
            queryClient.setQueryData<Holiday[]>(HOLIDAYS_KEY, (prev) => {
                const existing = (prev ?? []).find((h) => h.id === holiday.id);
                if (existing) return (prev ?? []).map((h) => h.id === holiday.id ? holiday : h);
                return [...(prev ?? []), holiday];
            });
        },
    });
}

export function useDeleteHolidayMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const ok = await attendanceDb.deleteHoliday(id);
            if (!ok) throw new Error("Failed to delete holiday");
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData<Holiday[]>(HOLIDAYS_KEY, (prev) =>
                (prev ?? []).filter((h) => h.id !== id)
            );
        },
    });
}

// -- Shifts

export function useUpsertShiftMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (shift: ShiftTemplate) => {
            const ok = await attendanceDb.upsertShift(shift);
            if (!ok) throw new Error("Failed to upsert shift");
            return shift;
        },
        onSuccess: (shift) => {
            queryClient.setQueryData<ShiftTemplate[]>(SHIFTS_KEY, (prev) => {
                const existing = (prev ?? []).find((s) => s.id === shift.id);
                if (existing) return (prev ?? []).map((s) => s.id === shift.id ? shift : s);
                return [...(prev ?? []), shift];
            });
        },
    });
}

export function useDeleteShiftMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const ok = await attendanceDb.deleteShift(id);
            if (!ok) throw new Error("Failed to delete shift");
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData<ShiftTemplate[]>(SHIFTS_KEY, (prev) =>
                (prev ?? []).filter((s) => s.id !== id)
            );
        },
    });
}

// -- Employee Shift Assignments

export function useAssignShiftMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ employeeId, shiftId }: { employeeId: string; shiftId: string }) => {
            const ok = await attendanceDb.upsertEmployeeShift(employeeId, shiftId);
            if (!ok) throw new Error("Failed to assign shift");
            return { employeeId, shiftId };
        },
        onSuccess: ({ employeeId, shiftId }) => {
            queryClient.setQueryData<Record<string, string>>(EMPLOYEE_SHIFTS_KEY, (prev) => ({
                ...(prev ?? {}),
                [employeeId]: shiftId,
            }));
        },
    });
}

export function useUnassignShiftMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (employeeId: string) => {
            const ok = await attendanceDb.deleteEmployeeShift(employeeId);
            if (!ok) throw new Error("Failed to unassign shift");
            return employeeId;
        },
        onSuccess: (employeeId) => {
            queryClient.setQueryData<Record<string, string>>(EMPLOYEE_SHIFTS_KEY, (prev) => {
                const next = { ...(prev ?? {}) };
                delete next[employeeId];
                return next;
            });
        },
    });
}

// -- Overtime Requests

export function useUpsertOvertimeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (req: OvertimeRequest) => {
            const ok = await attendanceDb.upsertOvertimeRequest(req);
            if (!ok) throw new Error("Failed to upsert overtime request");
            return req;
        },
        onSuccess: (req) => {
            queryClient.setQueryData<OvertimeRequest[]>(OVERTIME_REQUESTS_KEY, (prev) => {
                const existing = (prev ?? []).find((r) => r.id === req.id);
                if (existing) return (prev ?? []).map((r) => r.id === req.id ? req : r);
                return [...(prev ?? []), req];
            });
        },
    });
}

// -- Exceptions

export function useUpsertExceptionMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (exc: AttendanceException) => {
            const ok = await attendanceDb.upsertException(exc);
            if (!ok) throw new Error("Failed to upsert exception");
            return exc;
        },
        onSuccess: (exc) => {
            queryClient.setQueryData<AttendanceException[]>(ATTENDANCE_EXCEPTIONS_KEY, (prev) => {
                const existing = (prev ?? []).find((e) => e.id === exc.id);
                if (existing) return (prev ?? []).map((e) => e.id === exc.id ? exc : e);
                return [...(prev ?? []), exc];
            });
        },
    });
}

// -- Penalties

export function useUpsertPenaltyMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (penalty: PenaltyRecord) => {
            const ok = await attendanceDb.upsertPenalty(penalty);
            if (!ok) throw new Error("Failed to upsert penalty");
            return penalty;
        },
        onSuccess: (penalty) => {
            queryClient.setQueryData<PenaltyRecord[]>(PENALTIES_KEY, (prev) => {
                const existing = (prev ?? []).find((p) => p.id === penalty.id);
                if (existing) return (prev ?? []).map((p) => p.id === penalty.id ? penalty : p);
                return [...(prev ?? []), penalty];
            });
        },
    });
}

// -- Evidence

export function useInsertEvidenceMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (evidence: AttendanceEvidence) => {
            const ok = await attendanceDb.insertEvidence(evidence);
            if (!ok) throw new Error("Failed to insert evidence");
            return evidence;
        },
        onSuccess: (evidence) => {
            queryClient.setQueryData<AttendanceEvidence[]>(ATTENDANCE_EVIDENCE_KEY, (prev) => {
                if ((prev ?? []).find((e) => e.id === evidence.id)) return prev ?? [];
                return [...(prev ?? []), evidence];
            });
        },
    });
}

// ─── Composite Hook (matches original store state shape) ─────

export interface AttendanceHookState {
    // Data
    logs: AttendanceLog[];
    events: AttendanceEvent[];
    evidence: AttendanceEvidence[];
    exceptions: AttendanceException[];
    overtimeRequests: OvertimeRequest[];
    shiftTemplates: ShiftTemplate[];
    employeeShifts: Record<string, string>;
    holidays: Holiday[];
    penalties: PenaltyRecord[];
    // Loading
    isLoading: boolean;
}

/**
 * Unified hook that merges all attendance queries into a single state object.
 * Matches the data shape of the original useAttendanceStore for compatibility.
 */
export function useAttendanceData(): AttendanceHookState {
    const { data: logs = [], isLoading: logsLoading } = useAttendanceLogsQuery();
    const { data: events = [], isLoading: eventsLoading } = useAttendanceEventsQuery();
    const { data: evidence = [] } = useAttendanceEvidenceQuery();
    const { data: exceptions = [] } = useAttendanceExceptionsQuery();
    const { data: overtimeRequests = [], isLoading: otLoading } = useOvertimeRequestsQuery();
    const { data: shiftTemplates = [] } = useShiftsQuery();
    const { data: employeeShifts = {} } = useEmployeeShiftsQuery();
    const { data: holidays = [] } = useHolidaysQuery();
    const { data: penalties = [] } = usePenaltiesQuery();

    const isLoading = logsLoading || eventsLoading || otLoading;

    return useMemo(() => ({
        logs,
        events,
        evidence,
        exceptions,
        overtimeRequests,
        shiftTemplates,
        employeeShifts,
        holidays,
        penalties,
        isLoading,
    }), [logs, events, evidence, exceptions, overtimeRequests, shiftTemplates, employeeShifts, holidays, penalties, isLoading]);
}

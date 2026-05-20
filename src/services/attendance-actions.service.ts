"use client";
/**
 * Attendance Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 17 of ZUSTAND_MIGRATION_CHECKLIST.md
 *
 * Note: This is the largest store, so service surface mirrors store API.
 * Computation helpers (calculateHours, lateMinutes derivation) are kept
 * inside the store; this layer focuses on the persistence boundary.
 */

import { attendanceDb } from "./db.service";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAuditStore } from "@/store/audit.store";
import type {
    AttendanceLog,
    AttendanceEvent,
    AttendanceEvidence,
    AttendanceException,
    OvertimeRequest,
    ShiftTemplate,
    PenaltyRecord,
    Holiday,
    AttendanceMethod,
    AttendanceFlag,
} from "@/types";
import { nanoid } from "nanoid";

function nowIso() {
    return new Date().toISOString();
}

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function formatTimeWithSeconds(date: Date): string {
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    if (
        isNaN(h) || isNaN(m) || isNaN(s) ||
        h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59
    ) {
        return "00:00:00";
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeToSeconds(time: string): number {
    const [h = 0, m = 0, s = 0] = time.split(":").map(Number);
    return h * 3600 + m * 60 + s;
}

function calculateHours(checkIn: string, checkOut: string): number {
    const inTotal = timeToSeconds(checkIn);
    const outTotal = timeToSeconds(checkOut);
    const diff = outTotal >= inTotal ? outTotal - inTotal : 24 * 3600 - inTotal + outTotal;
    if (diff <= 0) return 0;
    return Math.round((diff / 3600) * 100) / 100;
}

// ─── Events (append-only ledger) ─────────────────────────────────

/**
 * Append an attendance event — DB-first.
 */
export async function appendEvent(
    data: Omit<AttendanceEvent, "id" | "createdAt"> & { id?: string }
): Promise<{ ok: boolean; id?: string }> {
    const id = data.id ?? `EVT-${nanoid(8)}`;
    const event: AttendanceEvent = {
        ...data,
        id,
        createdAt: nowIso(),
    };

    const ok = await attendanceDb.insertEvent(event);
    if (!ok) return { ok: false };

    useAttendanceStore.setState((s) => ({ events: [...s.events, event] }));
    return { ok: true, id };
}

/**
 * Record evidence for an event — DB-first.
 */
export async function recordEvidence(
    data: Omit<AttendanceEvidence, "id">
): Promise<boolean> {
    const evidence: AttendanceEvidence = { ...data, id: `EVI-${nanoid(8)}` };

    const ok = await attendanceDb.insertEvidence(evidence);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        evidence: [...s.evidence, evidence],
    }));
    return true;
}

// ─── Check-in / Check-out ────────────────────────────────────────

/**
 * Check in an employee — DB-first. Writes both the IN event and the
 * derived attendance log entry to Supabase before updating local cache.
 */
export async function checkIn(
    employeeId: string,
    projectId?: string,
    method?: AttendanceMethod
): Promise<{ ok: boolean; error?: string }> {
    const now = new Date();
    const today = todayStr();
    const timeStr = formatTimeWithSeconds(now);
    const checkInMethod: AttendanceMethod = method || "web_face";

    const state = useAttendanceStore.getState();
    const existing = state.logs.find(
        (l) => l.employeeId === employeeId && l.date === today
    );
    if (existing && existing.checkIn) {
        return { ok: false, error: "Already checked in today" };
    }

    // Derive lateMinutes from assigned shift
    const assignedShiftId = state.employeeShifts[employeeId];
    const assignedShift = assignedShiftId
        ? state.shiftTemplates.find((s) => s.id === assignedShiftId)
        : undefined;
    const graceMinutes = assignedShift?.gracePeriod ?? 10;
    const [shiftStartHour, shiftStartMin] = assignedShift
        ? assignedShift.startTime.split(":").map(Number)
        : [8, 0];
    const totalMinIn = now.getHours() * 60 + now.getMinutes();
    const shiftStartTotal = shiftStartHour * 60 + shiftStartMin;
    let rawLate = totalMinIn - shiftStartTotal;
    if (rawLate < -720) rawLate += 1440;
    const lateMinutes = rawLate > graceMinutes ? rawLate : 0;

    // Build event + log
    const eventId = `EVT-${nanoid(8)}`;
    const event: AttendanceEvent = {
        id: eventId,
        employeeId,
        eventType: "IN" as const,
        timestampUTC: now.toISOString(),
        projectId,
        createdAt: now.toISOString(),
    };

    const log: AttendanceLog = existing
        ? {
              ...existing,
              checkIn: timeStr,
              status: "present",
              lateMinutes,
              projectId,
              checkInMethod,
              updatedAt: now.toISOString(),
          }
        : {
              id: `ATT-${today}-${employeeId}`,
              employeeId,
              projectId,
              date: today,
              checkIn: timeStr,
              status: "present",
              lateMinutes,
              checkInMethod,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
          };

    // DB-first: write event then log
    const eventOk = await attendanceDb.insertEvent(event);
    if (!eventOk) return { ok: false, error: "Failed to record event" };
    const logOk = await attendanceDb.upsertLog(log);
    if (!logOk) return { ok: false, error: "Failed to update attendance log" };

    useAttendanceStore.setState((s) => ({
        events: [...s.events, event],
        logs: existing
            ? s.logs.map((l) => (l.id === existing.id ? log : l))
            : [...s.logs, log],
    }));
    return { ok: true };
}

/**
 * Check out an employee — DB-first. Same-method enforcement preserved.
 */
export async function checkOut(
    employeeId: string,
    projectId?: string,
    method?: AttendanceMethod
): Promise<{ ok: boolean; error?: string }> {
    const now = new Date();
    const today = todayStr();
    const timeStr = formatTimeWithSeconds(now);
    const checkOutMethod: AttendanceMethod = method || "web_face";

    const state = useAttendanceStore.getState();
    const todayLog = state.logs.find(
        (l) => l.employeeId === employeeId && l.date === today
    );
    if (!todayLog?.checkIn) {
        return { ok: false, error: "Cannot check out without checking in first" };
    }
    // Enforce same-method rule (manual override exempt)
    if (
        todayLog.checkInMethod &&
        checkOutMethod !== "manual" &&
        todayLog.checkInMethod !== checkOutMethod
    ) {
        const labels: Record<AttendanceMethod, string> = {
            biometric: "biometric device",
            web_face: "web face recognition",
            qr: "QR code",
            manual: "admin manual entry",
            self_checkin: "self check-in",
        };
        return {
            ok: false,
            error: `You checked in via ${labels[todayLog.checkInMethod]}. Please use the same method to check out.`,
        };
    }

    const event: AttendanceEvent = {
        id: `EVT-${nanoid(8)}`,
        employeeId,
        eventType: "OUT" as const,
        timestampUTC: now.toISOString(),
        projectId,
        createdAt: now.toISOString(),
    };
    const updatedLog: AttendanceLog = {
        ...todayLog,
        checkOut: timeStr,
        checkOutMethod,
        hours: calculateHours(todayLog.checkIn, timeStr),
        updatedAt: now.toISOString(),
    };

    const eventOk = await attendanceDb.insertEvent(event);
    if (!eventOk) return { ok: false, error: "Failed to record event" };
    const logOk = await attendanceDb.upsertLog(updatedLog);
    if (!logOk) return { ok: false, error: "Failed to update attendance log" };

    useAttendanceStore.setState((s) => ({
        events: [...s.events, event],
        logs: s.logs.map((l) => (l.id === todayLog.id ? updatedLog : l)),
    }));
    return { ok: true };
}

/**
 * Mark an employee absent for a given date — DB-first.
 */
export async function markAbsent(
    employeeId: string,
    date: string
): Promise<boolean> {
    const state = useAttendanceStore.getState();
    const existing = state.logs.find(
        (l) => l.employeeId === employeeId && l.date === date
    );
    const ts = nowIso();

    const log: AttendanceLog = existing
        ? {
              ...existing,
              status: "absent",
              checkIn: undefined,
              checkOut: undefined,
              hours: undefined,
              updatedAt: ts,
          }
        : {
              id: `ATT-${date}-${employeeId}`,
              employeeId,
              date,
              status: "absent",
              createdAt: ts,
              updatedAt: ts,
          };

    const ok = await attendanceDb.upsertLog(log);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        logs: existing
            ? s.logs.map((l) => (l.id === existing.id ? log : l))
            : [...s.logs, log],
    }));

    // Best-effort notifications + audit (preserved from legacy store)
    try {
        const allEmployees = useEmployeesStore.getState().employees;
        const notifStore = useNotificationsStore.getState();
        const adminHr = allEmployees.filter(
            (e) => e.role === "admin" || e.role === "hr"
        );
        const emp = allEmployees.find((e) => e.id === employeeId);
        const empName = emp?.name || employeeId;

        for (const admin of adminHr) {
            notifStore.dispatch(
                "absence",
                { name: empName, date },
                admin.id,
                admin.email,
                undefined,
                "/attendance"
            );
        }
        if (emp) {
            notifStore.addLog({
                employeeId: emp.id,
                type: "absence",
                channel: "in_app",
                subject: `Marked Absent: ${date}`,
                body: `You have been marked absent for ${date}.`,
                link: "/attendance",
            });
        }
        useAuditStore.getState().log({
            entityType: "attendance",
            entityId: employeeId,
            action: "mark_absent",
            performedBy: "SYSTEM",
            reason: `Marked absent for ${date}`,
            afterSnapshot: { date, status: "absent", employeeName: empName },
        });
    } catch {
        /* best-effort */
    }

    return true;
}

/**
 * Bulk upsert attendance logs (CSV import / batch corrections) — DB-first.
 */
export async function bulkUpsertLogs(
    rows: Array<
        Pick<AttendanceLog, "employeeId" | "date" | "status"> &
            Partial<
                Pick<
                    AttendanceLog,
                    "checkIn" | "checkOut" | "hours" | "lateMinutes"
                >
            >
    >
): Promise<{ ok: boolean; inserted: number; failed: number }> {
    const state = useAttendanceStore.getState();
    const ts = nowIso();
    const builtLogs: AttendanceLog[] = rows.map((row) => {
        const existing = state.logs.find(
            (l) => l.employeeId === row.employeeId && l.date === row.date
        );
        const base: AttendanceLog = existing
            ? { ...existing, ...row, updatedAt: ts }
            : {
                  id: `ATT-${row.date}-${row.employeeId}`,
                  ...row,
                  createdAt: ts,
                  updatedAt: ts,
              };
        if (base.checkIn && base.checkOut) {
            base.hours = calculateHours(base.checkIn, base.checkOut);
        }
        return base;
    });

    let failed = 0;
    const successLogs: AttendanceLog[] = [];
    for (const log of builtLogs) {
        const ok = await attendanceDb.upsertLog(log);
        if (ok) successLogs.push(log);
        else failed++;
    }

    if (successLogs.length > 0) {
        useAttendanceStore.setState((s) => {
            const next = [...s.logs];
            for (const log of successLogs) {
                const idx = next.findIndex(
                    (l) => l.employeeId === log.employeeId && l.date === log.date
                );
                if (idx >= 0) next[idx] = log;
                else next.push(log);
            }
            return { logs: next };
        });
    }
    return { ok: failed === 0, inserted: successLogs.length, failed };
}

/**
 * Reset today's attendance log for one employee (testing/simulation). DB-first.
 *
 * Note: this is a local-only reset by default (matches legacy behaviour).
 * The store's resetTodayLog already calls fetch() to clear the DB row.
 */
export async function resetTodayLog(employeeId: string): Promise<boolean> {
    const today = todayStr();
    const logId = `ATT-${today}-${employeeId}`;

    // Best-effort DB cleanup via existing API route; local cache cleared either way.
    try {
        await fetch(
            `/api/attendance/logs/${encodeURIComponent(logId)}`,
            { method: "DELETE" }
        );
    } catch {
        /* network error — local reset still proceeds */
    }

    useAttendanceStore.setState((s) => ({
        logs: s.logs.filter(
            (l) => !(l.employeeId === employeeId && l.date === today)
        ),
        events: s.events.filter((e) => {
            if (e.employeeId !== employeeId) return true;
            const ts: string =
                e.timestampUTC ??
                ((e as unknown as Record<string, string>).timestampUtc ?? "");
            return !ts.startsWith(today);
        }),
    }));
    return true;
}

// ─── Exceptions ──────────────────────────────────────────────────

/**
 * Resolve an exception — DB-first.
 */
export async function resolveException(
    id: string,
    resolvedBy: string,
    notes?: string
): Promise<boolean> {
    const exc = useAttendanceStore
        .getState()
        .exceptions.find((e) => e.id === id);
    if (!exc) return false;

    const updated: AttendanceException = {
        ...exc,
        resolvedAt: nowIso(),
        resolvedBy,
        notes: notes || exc.notes,
    };
    const ok = await attendanceDb.upsertException(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        exceptions: s.exceptions.map((e) => (e.id === id ? updated : e)),
    }));
    return true;
}

/**
 * Update an exception's flag/notes — DB-first.
 */
export async function updateException(
    id: string,
    updates: { flag?: AttendanceFlag; notes?: string }
): Promise<boolean> {
    const exc = useAttendanceStore
        .getState()
        .exceptions.find((e) => e.id === id);
    if (!exc) return false;

    const updated: AttendanceException = { ...exc, ...updates };
    const ok = await attendanceDb.upsertException(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        exceptions: s.exceptions.map((e) => (e.id === id ? updated : e)),
    }));
    return true;
}

// ─── Overtime Requests ───────────────────────────────────────────

/**
 * Submit an overtime request — DB-first. Notifies approvers.
 */
export async function submitOvertimeRequest(
    data: Omit<OvertimeRequest, "id" | "status" | "requestedAt">
): Promise<{ ok: boolean; id?: string }> {
    const id = `OT-${nanoid(8)}`;
    const req: OvertimeRequest = {
        ...data,
        id,
        status: "pending" as const,
        requestedAt: nowIso(),
    };

    const ok = await attendanceDb.upsertOvertimeRequest(req);
    if (!ok) return { ok: false };

    useAttendanceStore.setState((s) => ({
        overtimeRequests: [...s.overtimeRequests, req],
    }));

    // Notify approvers (best-effort, mirrors legacy)
    try {
        const employees = useEmployeesStore.getState().employees;
        const requester = employees.find((e) => e.id === data.employeeId);
        const requesterName = requester?.name ?? data.employeeId;
        const approvers = employees.filter(
            (e) =>
                (e.role === "admin" ||
                    e.role === "supervisor" ||
                    e.role === "hr") &&
                e.status === "active" &&
                e.id !== data.employeeId
        );
        approvers.forEach((approver) => {
            useNotificationsStore.getState().dispatch(
                "overtime_submitted",
                { name: requesterName, date: data.date ?? "" },
                approver.id,
                approver.email ?? undefined,
                undefined,
                "/attendance"
            );
        });
    } catch {
        /* best-effort */
    }
    return { ok: true, id };
}

/**
 * Approve an overtime request — DB-first. Adds approved hours to the day's log.
 */
export async function approveOvertime(
    requestId: string,
    approverId: string
): Promise<boolean> {
    const state = useAttendanceStore.getState();
    const req = state.overtimeRequests.find((r) => r.id === requestId);
    if (!req) return false;

    const updated: OvertimeRequest = {
        ...req,
        status: "approved",
        reviewedBy: approverId,
        reviewedAt: nowIso(),
    };
    const ok = await attendanceDb.upsertOvertimeRequest(updated);
    if (!ok) return false;

    // Append approved hours to the matching attendance log
    let logUpdate: AttendanceLog | null = null;
    if (req.date) {
        const log = state.logs.find(
            (l) => l.employeeId === req.employeeId && l.date === req.date
        );
        if (log) {
            logUpdate = {
                ...log,
                approvedOTHours: (log.approvedOTHours ?? 0) + req.hoursRequested,
                updatedAt: nowIso(),
            };
            await attendanceDb.upsertLog(logUpdate);
        }
    }

    useAttendanceStore.setState((s) => ({
        overtimeRequests: s.overtimeRequests.map((r) =>
            r.id === requestId ? updated : r
        ),
        logs: logUpdate
            ? s.logs.map((l) => (l.id === logUpdate!.id ? logUpdate! : l))
            : s.logs,
    }));

    // Best-effort notify
    try {
        useNotificationsStore.getState().addLog({
            employeeId: req.employeeId,
            type: "overtime_submitted",
            channel: "in_app",
            subject: "Overtime Approved",
            body: `Your overtime request for ${req.date} (${req.hoursRequested}h) has been approved.`,
            link: "/attendance",
        });
    } catch {
        /* best-effort */
    }
    return true;
}

/**
 * Reject an overtime request — DB-first.
 */
export async function rejectOvertime(
    requestId: string,
    approverId: string,
    reason: string
): Promise<boolean> {
    const req = useAttendanceStore
        .getState()
        .overtimeRequests.find((r) => r.id === requestId);
    if (!req) return false;

    const updated: OvertimeRequest = {
        ...req,
        status: "rejected",
        reviewedBy: approverId,
        reviewedAt: nowIso(),
        rejectionReason: reason,
    };
    const ok = await attendanceDb.upsertOvertimeRequest(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        overtimeRequests: s.overtimeRequests.map((r) =>
            r.id === requestId ? updated : r
        ),
    }));

    try {
        useNotificationsStore.getState().addLog({
            employeeId: req.employeeId,
            type: "overtime_submitted",
            channel: "in_app",
            subject: "Overtime Rejected",
            body: `Your overtime request for ${req.date} (${req.hoursRequested}h) was rejected${reason ? `: ${reason}` : "."}`,
            link: "/attendance",
        });
    } catch {
        /* best-effort */
    }
    return true;
}

// ─── Shifts ──────────────────────────────────────────────────────

/**
 * Create a shift template — DB-first.
 */
export async function createShift(
    shift: Omit<ShiftTemplate, "id">
): Promise<{ ok: boolean; id?: string }> {
    const id = `SHIFT-${nanoid(8)}`;
    const ts = nowIso();
    const full: ShiftTemplate = {
        ...shift,
        id,
        createdAt: ts,
        updatedAt: ts,
    };

    const ok = await attendanceDb.upsertShift(full);
    if (!ok) return { ok: false };

    useAttendanceStore.setState((s) => ({
        shiftTemplates: [...s.shiftTemplates, full],
    }));
    return { ok: true, id };
}

/**
 * Update a shift template — DB-first.
 */
export async function updateShift(
    id: string,
    data: Partial<Omit<ShiftTemplate, "id">>
): Promise<boolean> {
    const shift = useAttendanceStore
        .getState()
        .shiftTemplates.find((t) => t.id === id);
    if (!shift) return false;

    const updated: ShiftTemplate = { ...shift, ...data, updatedAt: nowIso() };
    const ok = await attendanceDb.upsertShift(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        shiftTemplates: s.shiftTemplates.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Delete a shift template — DB-first.
 */
export async function deleteShift(id: string): Promise<boolean> {
    const ok = await attendanceDb.deleteShift(id);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        shiftTemplates: s.shiftTemplates.filter((t) => t.id !== id),
        employeeShifts: Object.fromEntries(
            Object.entries(s.employeeShifts).filter(([, sid]) => sid !== id)
        ),
    }));
    return true;
}

/**
 * Assign a shift to an employee — DB-first.
 */
export async function assignShift(
    employeeId: string,
    shiftId: string
): Promise<boolean> {
    const ok = await attendanceDb.upsertEmployeeShift(employeeId, shiftId);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        employeeShifts: { ...s.employeeShifts, [employeeId]: shiftId },
    }));
    return true;
}

/**
 * Remove an employee's shift assignment — DB-first.
 */
export async function unassignShift(employeeId: string): Promise<boolean> {
    const ok = await attendanceDb.deleteEmployeeShift(employeeId);
    if (!ok) return false;

    useAttendanceStore.setState((s) => {
        const next = { ...s.employeeShifts };
        delete next[employeeId];
        return { employeeShifts: next };
    });
    return true;
}

// ─── Holidays ────────────────────────────────────────────────────

/**
 * Add a holiday — DB-first.
 */
export async function addHoliday(
    h: Omit<Holiday, "id">
): Promise<{ ok: boolean; id?: string }> {
    const id = `HOL-${nanoid(6)}`;
    const holiday: Holiday = { ...h, id };

    const ok = await attendanceDb.upsertHoliday(holiday);
    if (!ok) return { ok: false };

    useAttendanceStore.setState((s) => ({
        holidays: [...s.holidays, holiday].sort((a, b) =>
            a.date.localeCompare(b.date)
        ),
    }));
    return { ok: true, id };
}

/**
 * Update a holiday — DB-first.
 */
export async function updateHoliday(
    id: string,
    patch: Partial<Omit<Holiday, "id">>
): Promise<boolean> {
    const holiday = useAttendanceStore
        .getState()
        .holidays.find((h) => h.id === id);
    if (!holiday) return false;

    const updated: Holiday = { ...holiday, ...patch };
    const ok = await attendanceDb.upsertHoliday(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        holidays: s.holidays
            .map((h) => (h.id === id ? updated : h))
            .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    return true;
}

/**
 * Delete a holiday — DB-first.
 */
export async function deleteHoliday(id: string): Promise<boolean> {
    const ok = await attendanceDb.deleteHoliday(id);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        holidays: s.holidays.filter((h) => h.id !== id),
    }));
    return true;
}

// ─── Penalties ───────────────────────────────────────────────────

/**
 * Apply an anti-cheat penalty — DB-first.
 */
export async function applyPenalty(
    data: Omit<PenaltyRecord, "id" | "resolved">
): Promise<{ ok: boolean; id?: string }> {
    const id = `PEN-${nanoid(8)}`;
    const penalty: PenaltyRecord = { ...data, id, resolved: false };

    const ok = await attendanceDb.upsertPenalty(penalty);
    if (!ok) return { ok: false };

    useAttendanceStore.setState((s) => ({
        penalties: [...s.penalties, penalty],
    }));
    return { ok: true, id };
}

/**
 * Clear an active penalty for an employee — DB-first.
 */
export async function clearPenalty(employeeId: string): Promise<boolean> {
    const active = useAttendanceStore
        .getState()
        .penalties.find((p) => p.employeeId === employeeId && !p.resolved);
    if (!active) return true;

    const updated: PenaltyRecord = { ...active, resolved: true };
    const ok = await attendanceDb.upsertPenalty(updated);
    if (!ok) return false;

    useAttendanceStore.setState((s) => ({
        penalties: s.penalties.map((p) =>
            p.id === active.id ? updated : p
        ),
    }));
    return true;
}

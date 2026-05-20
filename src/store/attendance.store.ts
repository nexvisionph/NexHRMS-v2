"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
    AttendanceLog, AttendanceFlag, AttendanceEvent, AttendanceEvidence,
    AttendanceException, OvertimeRequest, ShiftTemplate, PenaltyRecord,
    Holiday, AttendanceMethod,
} from "@/types";
import { SEED_ATTENDANCE } from "@/data/seed";
import { DEFAULT_HOLIDAYS } from "@/lib/constants";
import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuditStore } from "@/store/audit.store";

interface AttendanceState {
    // ─── Append-only event ledger (§2A) ───────────────
    events: AttendanceEvent[];
    evidence: AttendanceEvidence[];
    exceptions: AttendanceException[];
    // ─── Computed daily view (backward-compatible) ────
    logs: AttendanceLog[];
    overtimeRequests: OvertimeRequest[];
    shiftTemplates: ShiftTemplate[];
    employeeShifts: Record<string, string>;

    // ─── Event ledger (append-only — no edit/delete) ──
    appendEvent: (data: Omit<AttendanceEvent, "id" | "createdAt"> & { id?: string }) => string;
    recordEvidence: (data: Omit<AttendanceEvidence, "id">) => void;
    getEventsForEmployee: (employeeId: string) => AttendanceEvent[];
    getEventsForDate: (date: string) => AttendanceEvent[];
    getEvidenceForEvent: (eventId: string) => AttendanceEvidence | undefined;

    // ─── Auto-generated exceptions ────────────────────
    autoGenerateExceptions: (date: string, employeeIds: string[]) => void;
    /** Auto-mark absent for employees who didn't check in after their shift ends (skips holidays) */
    autoMarkAbsentAfterShift: (date: string, employees: Array<{ id: string; workDays?: string[]; shiftId?: string }>) => number;
    resolveException: (exceptionId: string, resolvedBy: string, notes?: string) => void;
    updateException: (exceptionId: string, updates: { flag?: AttendanceFlag; notes?: string }) => void;
    deleteException: (exceptionId: string) => void;
    reopenException: (exceptionId: string) => void;
    getExceptions: (filters?: { employeeId?: string; date?: string; resolved?: boolean }) => AttendanceException[];

    // ─── Legacy log operations (derived view) ─────────
    checkIn: (employeeId: string, projectId?: string, method?: AttendanceMethod) => void;
    checkOut: (employeeId: string, projectId?: string, method?: AttendanceMethod) => { ok: boolean; error?: string };
    markAbsent: (employeeId: string, date: string) => void;
    addFlag: (logId: string, flag: AttendanceFlag) => void;
    removeFlag: (logId: string, flag: AttendanceFlag) => void;
    getEmployeeLogs: (employeeId: string) => AttendanceLog[];
    getTodayLog: (employeeId: string) => AttendanceLog | undefined;
    getFlaggedLogs: () => AttendanceLog[];
    updateLog: (id: string, patch: Partial<Pick<AttendanceLog, "checkIn" | "checkOut" | "hours" | "status" | "lateMinutes">>) => void;
    bulkUpsertLogs: (rows: Array<Pick<AttendanceLog, "employeeId" | "date" | "status"> & Partial<Pick<AttendanceLog, "checkIn" | "checkOut" | "hours" | "lateMinutes">>>) => void;

    // ─── Overtime ─────────────────────────────────────
    submitOvertimeRequest: (data: Omit<OvertimeRequest, "id" | "status" | "requestedAt">) => void;
    approveOvertime: (requestId: string, approverId: string) => void;
    rejectOvertime: (requestId: string, approverId: string, reason: string) => void;

    // ─── Shifts ───────────────────────────────────────
    createShift: (shift: Omit<ShiftTemplate, "id">) => void;    updateShift: (id: string, data: Partial<Omit<ShiftTemplate, "id">>) => void;
    deleteShift: (id: string) => void;    assignShift: (employeeId: string, shiftId: string) => void;
    unassignShift: (employeeId: string) => void;

    // ─── Holidays CRUD ────────────────────────────────
    holidays: Holiday[];
    addHoliday: (h: Omit<Holiday, "id">) => void;
    updateHoliday: (id: string, patch: Partial<Omit<Holiday, "id">>) => void;
    deleteHoliday: (id: string) => void;
    resetHolidaysToDefault: () => void;

    // ─── Anti-Cheat Penalties ─────────────────────────
    penalties: PenaltyRecord[];
    applyPenalty: (data: Omit<PenaltyRecord, "id" | "resolved">) => void;
    clearPenalty: (employeeId: string) => void;
    getActivePenalty: (employeeId: string) => PenaltyRecord | undefined;
    cleanExpiredPenalties: () => void;
    /** Clears today's attendance log for one employee — use for simulation/testing. */
    resetTodayLog: (employeeId: string) => void;

    resetToSeed: () => void;
}

const DEFAULT_SHIFTS: ShiftTemplate[] = [
    { id: "SHIFT-DAY", name: "Day Shift", startTime: "08:00", endTime: "17:00", gracePeriod: 10, breakDuration: 60, workDays: [1, 2, 3, 4, 5] },
    { id: "SHIFT-MID", name: "Mid Shift", startTime: "12:00", endTime: "21:00", gracePeriod: 10, breakDuration: 60, workDays: [1, 2, 3, 4, 5] },
    { id: "SHIFT-NIGHT", name: "Night Shift", startTime: "22:00", endTime: "06:00", gracePeriod: 15, breakDuration: 60, workDays: [1, 2, 3, 4, 5] },
];

function formatTimeWithSeconds(date: Date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();
    // Guard against invalid date values
    if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
        return "00:00:00";
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeToSeconds(time: string) {
    const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function calculateHours(checkIn: string, checkOut: string) {
    const inTotal = timeToSeconds(checkIn);
    const outTotal = timeToSeconds(checkOut);
    const diffSeconds = outTotal >= inTotal
        ? outTotal - inTotal
        : 24 * 3600 - inTotal + outTotal;

    if (diffSeconds <= 0) return 0;
    return Math.round((diffSeconds / 3600) * 100) / 100;
}

export const useAttendanceStore = create<AttendanceState>()(
    (set, get) => ({
            events: [],
            evidence: [],
            exceptions: [],
            logs: SEED_ATTENDANCE,
            overtimeRequests: [],
            shiftTemplates: DEFAULT_SHIFTS,
            employeeShifts: {},
            holidays: DEFAULT_HOLIDAYS.map((h, i) => ({ ...h, id: `HOL-${i + 1}` })),

            // ─── Append-only event ledger ─────────────────────────────
            appendEvent: (data) => {
                const eventId = data.id ?? `EVT-${nanoid(8)}`;
                set((s) => ({
                    events: [
                        ...s.events,
                        {
                            ...data,
                            id: eventId,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                }));
                return eventId;
            },

            recordEvidence: (data) =>
                set((s) => ({
                    evidence: [
                        ...s.evidence,
                        { ...data, id: `EVI-${nanoid(8)}` },
                    ],
                })),

            getEventsForEmployee: (employeeId) =>
                get().events.filter((e) => e.employeeId === employeeId),

            getEventsForDate: (date) =>
                get().events.filter((e) => e.timestampUTC.startsWith(date)),

            getEvidenceForEvent: (eventId) =>
                get().evidence.find((e) => e.eventId === eventId),

            // ─── Auto-generate exceptions for a date ──────────────────
            autoGenerateExceptions: (date, employeeIds) =>
                set((s) => {
                    const newExceptions: AttendanceException[] = [];
                    const now = new Date().toISOString();
                    for (const empId of employeeIds) {
                        const dayEvents = s.events.filter(
                            (e) => e.employeeId === empId && e.timestampUTC.startsWith(date)
                        );
                        const ins = dayEvents.filter((e) => e.eventType === "IN");
                        const outs = dayEvents.filter((e) => e.eventType === "OUT");
                        // Missing IN
                        if (ins.length === 0) {
                            const already = s.exceptions.find(
                                (ex) => ex.employeeId === empId && ex.date === date && ex.flag === "missing_in"
                            );
                            if (!already) {
                                newExceptions.push({
                                    id: `EXC-${nanoid(8)}`, eventId: undefined, employeeId: empId,
                                    date, flag: "missing_in", autoGenerated: true, createdAt: now,
                                });
                            }
                        }
                        // Missing OUT
                        if (ins.length > 0 && outs.length === 0) {
                            const already = s.exceptions.find(
                                (ex) => ex.employeeId === empId && ex.date === date && ex.flag === "missing_out"
                            );
                            if (!already) {
                                newExceptions.push({
                                    id: `EXC-${nanoid(8)}`, eventId: ins[0].id, employeeId: empId,
                                    date, flag: "missing_out", autoGenerated: true, createdAt: now,
                                });
                            }
                        }
                        // Duplicate scan
                        if (ins.length > 1) {
                            const already = s.exceptions.find(
                                (ex) => ex.employeeId === empId && ex.date === date && ex.flag === "duplicate_scan"
                            );
                            if (!already) {
                                newExceptions.push({
                                    id: `EXC-${nanoid(8)}`, eventId: ins[1].id, employeeId: empId,
                                    date, flag: "duplicate_scan", autoGenerated: true, createdAt: now,
                                });
                            }
                        }
                        // Out-of-geofence — check evidence
                        for (const evt of dayEvents) {
                            const evi = s.evidence.find((ev) => ev.eventId === evt.id);
                            if (evi && evi.geofencePass === false) {
                                const already = s.exceptions.find(
                                    (ex) => ex.employeeId === empId && ex.date === date && ex.flag === "out_of_geofence" && ex.eventId === evt.id
                                );
                                if (!already) {
                                    newExceptions.push({
                                        id: `EXC-${nanoid(8)}`, eventId: evt.id, employeeId: empId,
                                        date, flag: "out_of_geofence", autoGenerated: true, createdAt: now,
                                    });
                                }
                            }
                            if (evi && evi.mockLocationDetected === true) {
                                const already = s.exceptions.find(
                                    (ex) => ex.employeeId === empId && ex.date === date && ex.flag === "device_mismatch" && ex.eventId === evt.id
                                );
                                if (!already) {
                                    newExceptions.push({
                                        id: `EXC-${nanoid(8)}`, eventId: evt.id, employeeId: empId,
                                        date, flag: "device_mismatch", autoGenerated: true, createdAt: now,
                                    });
                                }
                            }
                        }
                    }
                    if (newExceptions.length === 0) return {};
                    return { exceptions: [...s.exceptions, ...newExceptions] };
                }),

            // ─── Auto-mark absent for employees after shift ends ──────────
            autoMarkAbsentAfterShift: (date, employees) => {
                const state = get();
                const nowISO = new Date().toISOString();
                const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun, 1=Mon, ... 6=Sat
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const dayName = dayNames[dayOfWeek];
                // Skip if date is a holiday (normalize comparison to YYYY-MM-DD)
                if (state.holidays.some((h) => {
                    // Handle both full date (YYYY-MM-DD) and partial (MM-DD) formats
                    if (h.date === date) return true;
                    // If holiday is stored as MM-DD, compare against the month-day portion
                    if (h.date.length === 5 && date.slice(5) === h.date) return true;
                    // If holiday is from a different year, compare month-day
                    if (h.date.length === 10 && h.date.slice(5) === date.slice(5)) return true;
                    return false;
                })) {
                    return 0;
                }
                const toMarkAbsent: string[] = [];
                for (const emp of employees) {
                    // Check if employee's work days include this day (default Mon-Fri)
                    const workDays = emp.workDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
                    if (!workDays.includes(dayName)) continue;
                    // Check if employee already has a log for this date
                    const existingLog = state.logs.find(
                        (l) => l.employeeId === emp.id && l.date === date
                    );
                    // If already marked as present, on_leave, or absent, skip
                    if (existingLog) continue;
                    // Check if employee has any IN event for this date
                    const hasCheckIn = state.events.some(
                        (e) => e.employeeId === emp.id && e.eventType === "IN" && e.timestampUTC.startsWith(date)
                    );
                    if (hasCheckIn) continue;
                    toMarkAbsent.push(emp.id);
                }
                if (toMarkAbsent.length === 0) return 0;
                // Batch mark absent
                set((s) => ({
                    logs: [
                        ...s.logs,
                        ...toMarkAbsent.map((empId) => ({
                            id: `ATT-${date}-${empId}`,
                            employeeId: empId,
                            date,
                            status: "absent" as const,
                            createdAt: nowISO,
                            updatedAt: nowISO,
                        })),
                    ],
                }));

                // ─── Notify admins/HR for each absence + audit log ────
                try {
                    const allEmployees = useEmployeesStore.getState().employees;
                    const notifStore = useNotificationsStore.getState();
                    const adminHrEmployees = allEmployees.filter((e) => e.role === "admin" || e.role === "hr");

                    for (const empId of toMarkAbsent) {
                        const emp = allEmployees.find((e) => e.id === empId);
                        const empName = emp?.name || empId;

                        // Notify each admin/HR
                        for (const admin of adminHrEmployees) {
                            notifStore.dispatch(
                                "absence",
                                { name: empName, date },
                                admin.id,
                                admin.email,
                                undefined,
                                "/attendance"
                            );
                        }

                        // Notify the absent employee too
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

                        // Audit log
                        useAuditStore.getState().log({
                            entityType: "attendance",
                            entityId: empId,
                            action: "bulk_mark_absent",
                            performedBy: "SYSTEM",
                            reason: `Auto-marked absent for ${date}`,
                            afterSnapshot: { date, status: "absent" },
                        });
                    }
                } catch { /* notification/audit is best-effort */ }

                return toMarkAbsent.length;
            },

            resolveException: (exceptionId, resolvedBy, notes) => {
                // Update local state immediately
                set((s) => ({
                    exceptions: s.exceptions.map((ex) =>
                        ex.id === exceptionId
                            ? { ...ex, resolvedAt: new Date().toISOString(), resolvedBy, notes: notes || ex.notes }
                            : ex
                    ),
                }));
                // Sync to DB (fire-and-forget)
                fetch("/api/attendance/exceptions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: exceptionId, action: "resolve", resolvedBy, notes }),
                }).catch((err) => console.warn("[attendance] Exception resolve sync failed:", err));
            },

            updateException: (exceptionId, updates) => {
                // Update local state immediately
                set((s) => ({
                    exceptions: s.exceptions.map((ex) =>
                        ex.id === exceptionId
                            ? { ...ex, ...updates }
                            : ex
                    ),
                }));
                // Sync to DB (fire-and-forget)
                fetch("/api/attendance/exceptions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: exceptionId, action: "update", ...updates }),
                }).catch((err) => console.warn("[attendance] Exception update sync failed:", err));
            },

            deleteException: (exceptionId) => {
                // Remove from local state immediately
                set((s) => ({
                    exceptions: s.exceptions.filter((ex) => ex.id !== exceptionId),
                }));
                // Sync to DB (fire-and-forget)
                fetch("/api/attendance/exceptions", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: exceptionId }),
                }).catch((err) => console.warn("[attendance] Exception delete sync failed:", err));
            },

            reopenException: (exceptionId) => {
                // Update local state immediately (clear resolution)
                set((s) => ({
                    exceptions: s.exceptions.map((ex) =>
                        ex.id === exceptionId
                            ? { ...ex, resolvedAt: undefined, resolvedBy: undefined }
                            : ex
                    ),
                }));
                // Sync to DB (fire-and-forget)
                fetch("/api/attendance/exceptions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: exceptionId, action: "reopen" }),
                }).catch((err) => console.warn("[attendance] Exception reopen sync failed:", err));
            },

            getExceptions: (filters) => {
                let result = get().exceptions;
                if (filters?.employeeId) result = result.filter((e) => e.employeeId === filters.employeeId);
                if (filters?.date) result = result.filter((e) => e.date === filters.date);
                if (filters?.resolved !== undefined) {
                    result = filters.resolved
                        ? result.filter((e) => !!e.resolvedAt)
                        : result.filter((e) => !e.resolvedAt);
                }
                return result;
            },

            // ─── Legacy log operations (also append event) ───────────
            checkIn: (employeeId, projectId, method) => {
                const today = new Date().toISOString().split("T")[0];
                const now = new Date();
                const timeStr = formatTimeWithSeconds(now);
                const checkInMethod: AttendanceMethod = method || "web_face";

                // Append to event ledger
                const eventId = `EVT-${nanoid(8)}`;
                const assignedShiftId = get().employeeShifts[employeeId];
                const assignedShift = assignedShiftId
                    ? get().shiftTemplates.find((s) => s.id === assignedShiftId)
                    : undefined;
                const graceMinutes = assignedShift?.gracePeriod ?? 10;
                const [shiftStartHour, shiftStartMin] = assignedShift
                    ? assignedShift.startTime.split(":").map(Number)
                    : [8, 0];
                const totalMinIn = now.getHours() * 60 + now.getMinutes();
                const shiftStartTotal = shiftStartHour * 60 + shiftStartMin;
                let rawLate = totalMinIn - shiftStartTotal;
                // Overnight normalization: if employee checks in after midnight for a pre-midnight shift
                if (rawLate < -720) rawLate += 1440;
                const lateMinutes = rawLate > graceMinutes ? rawLate : 0;

                set((s) => ({
                    events: [
                        ...s.events,
                        { id: eventId, employeeId, eventType: "IN" as const, timestampUTC: now.toISOString(), projectId, createdAt: now.toISOString() },
                    ],
                }));

                const existing = get().logs.find(
                    (l) => l.employeeId === employeeId && l.date === today
                );
                if (existing && existing.checkIn) {
                    // Already checked in today — don't overwrite
                    return;
                }
                if (existing) {
                    set((s) => ({
                        logs: s.logs.map((l) =>
                            l.id === existing.id ? { ...l, checkIn: timeStr, status: "present" as const, lateMinutes, projectId, checkInMethod, updatedAt: now.toISOString() } : l
                        ),
                    }));
                } else {
                    set((s) => ({
                        logs: [
                            ...s.logs,
                            {
                                id: `ATT-${today}-${employeeId}`,
                                employeeId,
                                projectId,
                                date: today,
                                checkIn: timeStr,
                                status: "present" as const,
                                lateMinutes,
                                checkInMethod,
                                createdAt: now.toISOString(),
                                updatedAt: now.toISOString(),
                            },
                        ],
                    }));
                }
            },

            checkOut: (employeeId, projectId, method) => {
                const today = new Date().toISOString().split("T")[0];
                const now = new Date();
                const timeStr = formatTimeWithSeconds(now);
                const checkOutMethod: AttendanceMethod = method || "web_face";

                // Verify employee has checked in today before allowing check-out
                const todayLog = get().logs.find(
                    (l) => l.employeeId === employeeId && l.date === today
                );
                if (!todayLog?.checkIn) {
                    return { ok: false, error: "Cannot check out without checking in first" };
                }

                // Enforce same-method rule: check-out method must match check-in method
                // Exception: manual (admin override) can always check out
                if (todayLog.checkInMethod && checkOutMethod !== "manual" && todayLog.checkInMethod !== checkOutMethod) {
                    const methodLabels: Record<AttendanceMethod, string> = {
                        biometric: "biometric device",
                        web_face: "web face recognition",
                        qr: "QR code",
                        manual: "admin manual entry",
                        self_checkin: "self check-in",
                    };
                    return {
                        ok: false,
                        error: `You checked in via ${methodLabels[todayLog.checkInMethod]}. Please use the same method to check out.`,
                    };
                }

                // Append OUT event
                set((s) => ({
                    events: [
                        ...s.events,
                        { id: `EVT-${nanoid(8)}`, employeeId, eventType: "OUT" as const, timestampUTC: now.toISOString(), projectId, createdAt: now.toISOString() },
                    ],
                }));

                set((s) => ({
                    logs: s.logs.map((l) => {
                        if (l.employeeId === employeeId && l.date === today && l.checkIn) {
                            return { ...l, checkOut: timeStr, checkOutMethod, hours: calculateHours(l.checkIn, timeStr), updatedAt: now.toISOString() };
                        }
                        return l;
                    }),
                }));

                return { ok: true };
            },

            markAbsent: (employeeId, date) => {
                const existing = get().logs.find(
                    (l) => l.employeeId === employeeId && l.date === date
                );
                const nowISO = new Date().toISOString();
                if (existing) {
                    set((s) => ({
                        logs: s.logs.map((l) =>
                            l.id === existing.id ? { ...l, status: "absent" as const, checkIn: undefined, checkOut: undefined, hours: undefined, updatedAt: nowISO } : l
                        ),
                    }));
                } else {
                    set((s) => ({
                        logs: [
                            ...s.logs,
                            { id: `ATT-${date}-${employeeId}`, employeeId, date, status: "absent" as const, createdAt: nowISO, updatedAt: nowISO },
                        ],
                    }));
                }

                // ─── Notify admins/HR + employee + audit log ──────────
                try {
                    const allEmployees = useEmployeesStore.getState().employees;
                    const notifStore = useNotificationsStore.getState();
                    const adminHrEmployees = allEmployees.filter((e) => e.role === "admin" || e.role === "hr");
                    const emp = allEmployees.find((e) => e.id === employeeId);
                    const empName = emp?.name || employeeId;

                    // Notify each admin/HR
                    for (const admin of adminHrEmployees) {
                        notifStore.dispatch(
                            "absence",
                            { name: empName, date },
                            admin.id,
                            admin.email,
                            undefined,
                            "/attendance"
                        );
                    }

                    // Notify the absent employee
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

                    // Audit log
                    useAuditStore.getState().log({
                        entityType: "attendance",
                        entityId: employeeId,
                        action: "mark_absent",
                        performedBy: "SYSTEM",
                        reason: `Marked absent for ${date}`,
                        afterSnapshot: { date, status: "absent", employeeName: empName },
                    });
                } catch { /* notification/audit is best-effort */ }
            },

            getEmployeeLogs: (employeeId) =>
                get().logs.filter((l) => l.employeeId === employeeId),
            getTodayLog: (employeeId) => {
                const today = new Date().toISOString().split("T")[0];
                return get().logs.find(
                    (l) => l.employeeId === employeeId && l.date === today
                );
            },
            addFlag: (logId, flag) =>
                set((s) => ({
                    logs: s.logs.map((l) =>
                        l.id === logId
                            ? { ...l, flags: [...new Set([...(l.flags ?? []), flag])] }
                            : l
                    ),
                })),
            removeFlag: (logId, flag) =>
                set((s) => ({
                    logs: s.logs.map((l) =>
                        l.id === logId
                            ? { ...l, flags: (l.flags ?? []).filter((f) => f !== flag) }
                            : l
                    ),
                })),
            getFlaggedLogs: () =>
                get().logs.filter((l) => l.flags && l.flags.length > 0),

            updateLog: (id, patch) =>
                set((s) => ({
                    logs: s.logs.map((l) => {
                        if (l.id !== id) return l;
                        const updated = { ...l, ...patch, updatedAt: new Date().toISOString() };
                        // Recalculate hours if both times are present; handle overnight shifts
                        if (updated.checkIn && updated.checkOut) {
                            updated.hours = calculateHours(updated.checkIn, updated.checkOut);
                        }
                        return updated;
                    }),
                })),

            bulkUpsertLogs: (rows) =>
                set((s) => {
                    const logs = [...s.logs];
                    const nowISO = new Date().toISOString();
                    for (const row of rows) {
                        const idx = logs.findIndex(
                            (l) => l.employeeId === row.employeeId && l.date === row.date
                        );
                        const entry: AttendanceLog = idx >= 0
                            ? { ...logs[idx], ...row, updatedAt: nowISO }
                            : { id: `ATT-${row.date}-${row.employeeId}`, ...row, createdAt: nowISO, updatedAt: nowISO };
                        // recalc hours
                        if (entry.checkIn && entry.checkOut) {
                            entry.hours = calculateHours(entry.checkIn, entry.checkOut);
                        }
                        if (idx >= 0) logs[idx] = entry; else logs.push(entry);
                    }
                    return { logs };
                }),

            // ─── Overtime ─────────────────────────────────────────────
            submitOvertimeRequest: (data) => {
                const id = `OT-${nanoid(8)}`;
                set((s) => ({
                    overtimeRequests: [
                        ...s.overtimeRequests,
                        {
                            ...data,
                            id,
                            status: "pending" as const,
                            requestedAt: new Date().toISOString(),
                        },
                    ],
                }));
                // Notify admin and supervisor employees
                const employees = useEmployeesStore.getState().employees;
                const requester = employees.find((e) => e.id === data.employeeId);
                const requesterName = requester?.name ?? data.employeeId;
                const approvers = employees.filter(
                    (e) => (e.role === "admin" || e.role === "supervisor" || e.role === "hr") && e.status === "active" && e.id !== data.employeeId
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
            },
            approveOvertime: (requestId, approverId) => {
                const otReq = get().overtimeRequests.find((r) => r.id === requestId);
                set((s) => ({
                    overtimeRequests: s.overtimeRequests.map((r) =>
                        r.id === requestId
                            ? { ...r, status: "approved" as const, reviewedBy: approverId, reviewedAt: new Date().toISOString() }
                            : r
                    ),
                }));
                // Update the corresponding attendance log with approved OT hours
                if (otReq && otReq.date) {
                    const log = get().logs.find(
                        (l) => l.employeeId === otReq.employeeId && l.date === otReq.date
                    );
                    if (log) {
                        set((s) => ({
                            logs: s.logs.map((l) =>
                                l.id === log.id
                                    ? { ...l, approvedOTHours: (l.approvedOTHours ?? 0) + otReq.hoursRequested, updatedAt: new Date().toISOString() }
                                    : l
                            ),
                        }));
                    }
                }
                // Notify the requesting employee
                if (otReq) {
                    useNotificationsStore.getState().addLog({
                        employeeId: otReq.employeeId,
                        type: "overtime_submitted",
                        channel: "in_app",
                        subject: "Overtime Approved",
                        body: `Your overtime request for ${otReq.date} (${otReq.hoursRequested}h) has been approved.`,
                        link: "/attendance",
                    });
                }
            },
            rejectOvertime: (requestId, approverId, reason) => {
                const otReq = get().overtimeRequests.find((r) => r.id === requestId);
                set((s) => ({
                    overtimeRequests: s.overtimeRequests.map((r) =>
                        r.id === requestId
                            ? { ...r, status: "rejected" as const, reviewedBy: approverId, reviewedAt: new Date().toISOString(), rejectionReason: reason }
                            : r
                    ),
                }));
                // Notify the requesting employee
                if (otReq) {
                    useNotificationsStore.getState().addLog({
                        employeeId: otReq.employeeId,
                        type: "overtime_submitted",
                        channel: "in_app",
                        subject: "Overtime Rejected",
                        body: `Your overtime request for ${otReq.date} (${otReq.hoursRequested}h) was rejected${reason ? `: ${reason}` : "."}`,
                        link: "/attendance",
                    });
                }
            },

            // ─── Shifts ───────────────────────────────────────────────
            createShift: (shift) => {
                const now = new Date().toISOString();
                set((s) => ({
                    shiftTemplates: [
                        ...s.shiftTemplates,
                        { ...shift, id: `SHIFT-${nanoid(8)}`, createdAt: now, updatedAt: now },
                    ],
                }));
            },
            updateShift: (id, data) =>
                set((s) => ({
                    shiftTemplates: s.shiftTemplates.map((t) => (t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t)),
                })),
            deleteShift: (id) =>
                set((s) => ({
                    shiftTemplates: s.shiftTemplates.filter((t) => t.id !== id),
                    employeeShifts: Object.fromEntries(
                        Object.entries(s.employeeShifts).filter(([, sid]) => sid !== id)
                    ),
                })),
            assignShift: (employeeId, shiftId) =>
                set((s) => ({
                    employeeShifts: { ...s.employeeShifts, [employeeId]: shiftId },
                })),
            unassignShift: (employeeId) =>
                set((s) => ({
                    employeeShifts: Object.fromEntries(
                        Object.entries(s.employeeShifts).filter(([id]) => id !== employeeId)
                    ),
                })),

            // ─── Holidays CRUD ────────────────────────────────────────
            addHoliday: (h) =>
                set((s) => ({
                    holidays: [...s.holidays, { ...h, id: `HOL-${nanoid(6)}` }]
                        .sort((a, b) => a.date.localeCompare(b.date)),
                })),
            updateHoliday: (id, patch) =>
                set((s) => ({
                    holidays: s.holidays
                        .map((h) => (h.id === id ? { ...h, ...patch } : h))
                        .sort((a, b) => a.date.localeCompare(b.date)),
                })),
            deleteHoliday: (id) =>
                set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),
            resetHolidaysToDefault: () =>
                set(() => ({ holidays: DEFAULT_HOLIDAYS.map((h, i) => ({ ...h, id: `HOL-${i + 1}` })) })),

            // ─── Anti-Cheat Penalties ──────────────────────────────
            penalties: [],
            applyPenalty: (data) =>
                set((s) => ({
                    penalties: [
                        ...s.penalties,
                        { ...data, id: `PEN-${nanoid(8)}`, resolved: false },
                    ],
                })),
            clearPenalty: (employeeId) =>
                set((s) => ({
                    penalties: s.penalties.map((p) =>
                        p.employeeId === employeeId && !p.resolved
                            ? { ...p, resolved: true }
                            : p
                    ),
                })),
            getActivePenalty: (employeeId) => {
                const now = new Date().toISOString();
                return get().penalties.find(
                    (p) => p.employeeId === employeeId && !p.resolved && p.penaltyUntil > now
                );
            },
            cleanExpiredPenalties: () =>
                set((s) => ({
                    penalties: s.penalties.filter(
                        (p) => !p.resolved && p.penaltyUntil > new Date().toISOString()
                    ),
                })),

            resetTodayLog: (employeeId) => {
                const today = new Date().toISOString().split("T")[0];
                set((s) => ({
                    logs: s.logs.filter(
                        (l) => !(l.employeeId === employeeId && l.date === today)
                    ),
                    events: s.events.filter((e) => {
                        if (e.employeeId !== employeeId) return true;
                        // Handle both `timestampUTC` (local) and `timestampUtc` (stale DB hydration)
                        const ts: string = e.timestampUTC ?? (e as unknown as Record<string, string>).timestampUtc ?? "";
                        return !ts.startsWith(today);
                    }),
                }));
            },

            resetToSeed: () =>
                set(() => ({
                    events: [],
                    evidence: [],
                    exceptions: [],
                    logs: SEED_ATTENDANCE,
                    overtimeRequests: [],
                    shiftTemplates: DEFAULT_SHIFTS,
                    employeeShifts: {},
                    holidays: DEFAULT_HOLIDAYS.map((h, i) => ({ ...h, id: `HOL-${i + 1}` })),
                    penalties: [],
                })),
        })
);

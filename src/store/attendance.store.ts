"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
    AttendanceLog, AttendanceFlag, AttendanceEvent, AttendanceEvidence,
    AttendanceException, OvertimeRequest, ShiftTemplate, PenaltyRecord,
    Holiday,
} from "@/types";
import { SEED_ATTENDANCE } from "@/data/seed";
import { DEFAULT_HOLIDAYS } from "@/lib/constants";

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
    appendEvent: (data: Omit<AttendanceEvent, "id" | "createdAt">) => void;
    recordEvidence: (data: Omit<AttendanceEvidence, "id">) => void;
    getEventsForEmployee: (employeeId: string) => AttendanceEvent[];
    getEventsForDate: (date: string) => AttendanceEvent[];
    getEvidenceForEvent: (eventId: string) => AttendanceEvidence | undefined;

    // ─── Auto-generated exceptions ────────────────────
    autoGenerateExceptions: (date: string, employeeIds: string[]) => void;
    /** Auto-mark absent for employees who didn't check in after their shift ends (skips holidays) */
    autoMarkAbsentAfterShift: (date: string, employees: Array<{ id: string; workDays?: string[]; shiftId?: string }>) => number;
    resolveException: (exceptionId: string, resolvedBy: string, notes?: string) => void;
    getExceptions: (filters?: { employeeId?: string; date?: string; resolved?: boolean }) => AttendanceException[];

    // ─── Legacy log operations (derived view) ─────────
    checkIn: (employeeId: string, projectId?: string) => void;
    checkOut: (employeeId: string, projectId?: string) => void;
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

export const useAttendanceStore = create<AttendanceState>()(
    persist(
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
            appendEvent: (data) =>
                set((s) => ({
                    events: [
                        ...s.events,
                        {
                            ...data,
                            id: `EVT-${nanoid(8)}`,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                })),

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
                            newExceptions.push({
                                id: `EXC-${nanoid(8)}`, eventId: ins[1].id, employeeId: empId,
                                date, flag: "duplicate_scan", autoGenerated: true, createdAt: now,
                            });
                        }
                        // Out-of-geofence — check evidence
                        for (const evt of dayEvents) {
                            const evi = s.evidence.find((ev) => ev.eventId === evt.id);
                            if (evi && evi.geofencePass === false) {
                                newExceptions.push({
                                    id: `EXC-${nanoid(8)}`, eventId: evt.id, employeeId: empId,
                                    date, flag: "out_of_geofence", autoGenerated: true, createdAt: now,
                                });
                            }
                            if (evi && evi.mockLocationDetected === true) {
                                newExceptions.push({
                                    id: `EXC-${nanoid(8)}`, eventId: evt.id, employeeId: empId,
                                    date, flag: "device_mismatch", autoGenerated: true, createdAt: now,
                                });
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
                // Skip if date is a holiday
                if (state.holidays.some((h) => h.date === date)) {
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
                return toMarkAbsent.length;
            },

            resolveException: (exceptionId, resolvedBy, notes) =>
                set((s) => ({
                    exceptions: s.exceptions.map((ex) =>
                        ex.id === exceptionId
                            ? { ...ex, resolvedAt: new Date().toISOString(), resolvedBy, notes: notes || ex.notes }
                            : ex
                    ),
                })),

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
            checkIn: (employeeId, projectId) => {
                const today = new Date().toISOString().split("T")[0];
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

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
                const rawLate = totalMinIn - shiftStartTotal;
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
                            l.id === existing.id ? { ...l, checkIn: timeStr, status: "present" as const, lateMinutes, projectId, updatedAt: now.toISOString() } : l
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
                                createdAt: now.toISOString(),
                                updatedAt: now.toISOString(),
                            },
                        ],
                    }));
                }
            },

            checkOut: (employeeId, projectId) => {
                const today = new Date().toISOString().split("T")[0];
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                // Verify employee has checked in today before allowing check-out
                const todayLog = get().logs.find(
                    (l) => l.employeeId === employeeId && l.date === today
                );
                if (!todayLog?.checkIn) {
                    return; // Cannot check out without checking in first
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
                            const [inH, inM] = l.checkIn.split(":").map(Number);
                            const outTotalMin = now.getHours() * 60 + now.getMinutes();
                            const inTotalMin = inH * 60 + inM;
                            // Handle overnight shifts (checkout next day is < checkin time)
                            const diffMin = outTotalMin >= inTotalMin
                                ? outTotalMin - inTotalMin
                                : 24 * 60 - inTotalMin + outTotalMin;
                            return { ...l, checkOut: timeStr, hours: Math.round((diffMin / 60) * 10) / 10, updatedAt: now.toISOString() };
                        }
                        return l;
                    }),
                }));
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
                            const [inH, inM] = updated.checkIn.split(":").map(Number);
                            const [outH, outM] = updated.checkOut.split(":").map(Number);
                            const inTotal = inH * 60 + inM;
                            const outTotal = outH * 60 + outM;
                            const diffMin = outTotal >= inTotal
                                ? outTotal - inTotal
                                : 24 * 60 - inTotal + outTotal;
                            updated.hours = Math.round((diffMin / 60) * 10) / 10;
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
                            const [inH, inM] = entry.checkIn.split(":").map(Number);
                            const [outH, outM] = entry.checkOut.split(":").map(Number);
                            entry.hours = Math.max(0, Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10);
                        }
                        if (idx >= 0) logs[idx] = entry; else logs.push(entry);
                    }
                    return { logs };
                }),

            // ─── Overtime ─────────────────────────────────────────────
            submitOvertimeRequest: (data) =>
                set((s) => ({
                    overtimeRequests: [
                        ...s.overtimeRequests,
                        {
                            ...data,
                            id: `OT-${nanoid(8)}`,
                            status: "pending" as const,
                            requestedAt: new Date().toISOString(),
                        },
                    ],
                })),
            approveOvertime: (requestId, approverId) =>
                set((s) => ({
                    overtimeRequests: s.overtimeRequests.map((r) =>
                        r.id === requestId
                            ? { ...r, status: "approved" as const, reviewedBy: approverId, reviewedAt: new Date().toISOString() }
                            : r
                    ),
                })),
            rejectOvertime: (requestId, approverId, reason) =>
                set((s) => ({
                    overtimeRequests: s.overtimeRequests.map((r) =>
                        r.id === requestId
                            ? { ...r, status: "rejected" as const, reviewedBy: approverId, reviewedAt: new Date().toISOString(), rejectionReason: reason }
                            : r
                    ),
                })),

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
        }),
        {
            name: "soren-attendance",
            version: 5,
            migrate: (persistedState: unknown, version: number) => {
                const state = (persistedState ?? {}) as Record<string, unknown>;
                if (version < 4) {
                    // v3 → v4: holidays field was added
                    if (!state.holidays) {
                        state.holidays = DEFAULT_HOLIDAYS.map((h, i) => ({ ...h, id: `HOL-${i + 1}` }));
                    }
                }
                if (version < 5) {
                    // v4 → v5: normalize events with timestampUtc → timestampUTC
                    if (Array.isArray(state.events)) {
                        state.events = (state.events as Record<string, unknown>[]).map((e) => {
                            if (e.timestampUtc !== undefined && e.timestampUTC === undefined) {
                                e.timestampUTC = e.timestampUtc;
                                delete e.timestampUtc;
                            }
                            return e;
                        });
                    }
                }
                return state;
            },
            // Deduplicate logs on rehydration (one log per employee+date)
            merge: (persisted, current) => {
                const persistedState = persisted as Partial<AttendanceState> | undefined;
                const currentState = current as AttendanceState;
                if (!persistedState) return currentState;
                
                // Deduplicate logs by employee+date (keep latest based on updatedAt)
                const logs = persistedState.logs ?? currentState.logs;
                const logMap = new Map<string, AttendanceLog>();
                for (const log of logs) {
                    const key = `${log.employeeId}|${log.date}`;
                    const existing = logMap.get(key);
                    if (!existing || (log.updatedAt && existing.updatedAt && log.updatedAt > existing.updatedAt)) {
                        logMap.set(key, log);
                    }
                }
                
                // Deduplicate events by ID
                const events = persistedState.events ?? currentState.events;
                const eventMap = new Map<string, AttendanceEvent>();
                for (const ev of events) {
                    if (!eventMap.has(ev.id)) eventMap.set(ev.id, ev);
                }
                
                return {
                    ...currentState,
                    ...persistedState,
                    logs: Array.from(logMap.values()),
                    events: Array.from(eventMap.values()),
                };
            },
        }
    )
);

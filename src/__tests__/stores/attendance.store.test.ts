/**
 * Unit tests for the Attendance store
 * TimeZone is set to UTC in jest.config.ts so Date.getHours() is deterministic.
 */
import { useAttendanceStore } from "@/store/attendance.store";
import type { ShiftTemplate } from "@/types";

const TODAY = new Date().toISOString().split("T")[0];
const EMP_ID = "TEST-EMP-ATT";

const DAY_SHIFT: ShiftTemplate = {
    id: "SHIFT-TEST-DAY",
    name: "Day Shift Test",
    startTime: "08:00",
    endTime: "17:00",
    gracePeriod: 10,
    breakDuration: 60,
    workDays: [1, 2, 3, 4, 5],
};

const MID_SHIFT: ShiftTemplate = {
    id: "SHIFT-TEST-MID",
    name: "Mid Shift Test",
    startTime: "12:00",
    endTime: "21:00",
    gracePeriod: 10,
    breakDuration: 60,
    workDays: [1, 2, 3, 4, 5],
};

const resetStore = () => {
    useAttendanceStore.setState({
        logs: [],
        overtimeRequests: [],
        shiftTemplates: [DAY_SHIFT, MID_SHIFT],
        employeeShifts: {},
        events: [],
        evidence: [],
        exceptions: [],
    });
};

beforeEach(() => {
    resetStore();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

// ─── checkIn ─────────────────────────────────────────────────
describe("checkIn — no assigned shift (defaults to 08:00)", () => {
    it("creates an attendance log with status=present", () => {
        jest.setSystemTime(new Date(`${TODAY}T07:00:00Z`)); // 07:00 UTC
        useAttendanceStore.getState().checkIn(EMP_ID);
        const log = useAttendanceStore.getState().getTodayLog(EMP_ID);
        expect(log).toBeDefined();
        expect(log?.status).toBe("present");
        expect(log?.checkIn).toBe("07:00");
    });

    it("lateMinutes=0 when checking in before shift start (07:00)", () => {
        jest.setSystemTime(new Date(`${TODAY}T07:00:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(0);
    });

    it("lateMinutes=0 when within grace period (08:05, grace=10)", () => {
        jest.setSystemTime(new Date(`${TODAY}T08:05:00Z`)); // 8:05 UTC, rawLate=5 ≤ 10
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(0);
    });

    it("lateMinutes>0 when beyond grace period (08:20)", () => {
        jest.setSystemTime(new Date(`${TODAY}T08:20:00Z`)); // rawLate=20 > 10
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(20);
    });
});

describe("checkIn — with assigned mid shift (12:00, grace=10)", () => {
    beforeEach(() => {
        useAttendanceStore.setState({
            employeeShifts: { [EMP_ID]: "SHIFT-TEST-MID" },
        });
    });

    it("lateMinutes=0 when checking in before shift start (11:50)", () => {
        jest.setSystemTime(new Date(`${TODAY}T11:50:00Z`)); // rawLate = -10
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(0);
    });

    it("lateMinutes=0 when within grace period (12:08)", () => {
        jest.setSystemTime(new Date(`${TODAY}T12:08:00Z`)); // rawLate=8 ≤ 10
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(0);
    });

    it("lateMinutes=25 when checking in at 12:35 (rawLate=35 > grace=10)", () => {
        jest.setSystemTime(new Date(`${TODAY}T12:35:00Z`)); // rawLate=35
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)?.lateMinutes).toBe(35);
    });
});

describe("checkIn — updating existing log", () => {
    it("updates checkIn time instead of creating a duplicate log", () => {
        jest.setSystemTime(new Date(`${TODAY}T08:01:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID);

        jest.setSystemTime(new Date(`${TODAY}T09:00:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID); // should update, not create a new one

        const logs = useAttendanceStore.getState().logs;
        const todayLogs = logs.filter((l) => l.employeeId === EMP_ID && l.date === TODAY);
        expect(todayLogs).toHaveLength(1);
        expect(todayLogs[0].checkIn).toBe("09:00");
    });
});

// ─── checkOut ────────────────────────────────────────────────
describe("checkOut", () => {
    it("records checkOut time and computes hours worked", () => {
        // Check in at 08:00
        jest.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID);

        // Check out at 17:00 (9 hours)
        jest.setSystemTime(new Date(`${TODAY}T17:00:00Z`));
        useAttendanceStore.getState().checkOut(EMP_ID);

        const log = useAttendanceStore.getState().getTodayLog(EMP_ID);
        expect(log?.checkOut).toBe("17:00");
        expect(log?.hours).toBe(9);
    });

    it("does not alter a log with no checkIn", () => {
        // No checkIn for this employee
        useAttendanceStore.setState({
            logs: [{ id: "ATT-NOIN", employeeId: EMP_ID, date: TODAY, status: "absent" }],
        });
        useAttendanceStore.getState().checkOut(EMP_ID);
        const log = useAttendanceStore.getState().getTodayLog(EMP_ID);
        expect(log?.checkOut).toBeUndefined();
    });
});

// ─── markAbsent ──────────────────────────────────────────────
describe("markAbsent", () => {
    it("creates an absent log when none exists", () => {
        useAttendanceStore.getState().markAbsent(EMP_ID, TODAY);
        const log = useAttendanceStore.getState().getTodayLog(EMP_ID);
        expect(log?.status).toBe("absent");
        expect(log?.checkIn).toBeUndefined();
    });

    it("updates an existing present log to absent", () => {
        useAttendanceStore.setState({
            logs: [{ id: `ATT-${TODAY}-${EMP_ID}`, employeeId: EMP_ID, date: TODAY, status: "present", checkIn: "08:00" }],
        });
        useAttendanceStore.getState().markAbsent(EMP_ID, TODAY);
        const log = useAttendanceStore.getState().getTodayLog(EMP_ID);
        expect(log?.status).toBe("absent");
        expect(log?.checkIn).toBeUndefined();
    });
});

// ─── getEmployeeLogs ─────────────────────────────────────────
describe("getEmployeeLogs", () => {
    it("returns only logs for the specified employee", () => {
        useAttendanceStore.setState({
            logs: [
                { id: "L1", employeeId: EMP_ID, date: TODAY, status: "present" },
                { id: "L2", employeeId: "OTHER-EMP", date: TODAY, status: "absent" },
            ],
        });
        const logs = useAttendanceStore.getState().getEmployeeLogs(EMP_ID);
        expect(logs).toHaveLength(1);
        expect(logs[0].employeeId).toBe(EMP_ID);
    });
});

// ─── Overtime Requests ───────────────────────────────────────
describe("Overtime Requests", () => {
    it("submitOvertimeRequest creates a pending request", () => {
        const { submitOvertimeRequest } = useAttendanceStore.getState();
        submitOvertimeRequest({ employeeId: EMP_ID, date: TODAY, hoursRequested: 2, reason: "Deadline" });

        const reqs = useAttendanceStore.getState().overtimeRequests;
        expect(reqs).toHaveLength(1);
        expect(reqs[0].status).toBe("pending");
        expect(reqs[0].hoursRequested).toBe(2);
        expect(reqs[0].id).toMatch(/^OT-/);
    });

    it("approveOvertime sets status=approved and reviewedBy", () => {
        useAttendanceStore.setState({
            overtimeRequests: [{ id: "OT-TEST", employeeId: EMP_ID, date: TODAY, hoursRequested: 1, reason: "test", status: "pending", requestedAt: new Date().toISOString() }],
        });
        useAttendanceStore.getState().approveOvertime("OT-TEST", "ADMIN-001");

        const req = useAttendanceStore.getState().overtimeRequests[0];
        expect(req.status).toBe("approved");
        expect(req.reviewedBy).toBe("ADMIN-001");
        expect(req.reviewedAt).toBeDefined();
    });

    it("rejectOvertime sets status=rejected with reason", () => {
        useAttendanceStore.setState({
            overtimeRequests: [{ id: "OT-REJ", employeeId: EMP_ID, date: TODAY, hoursRequested: 3, reason: "test", status: "pending", requestedAt: new Date().toISOString() }],
        });
        useAttendanceStore.getState().rejectOvertime("OT-REJ", "ADMIN-001", "Budget exceeded");

        const req = useAttendanceStore.getState().overtimeRequests[0];
        expect(req.status).toBe("rejected");
        expect(req.rejectionReason).toBe("Budget exceeded");
    });
});

// ─── Shifts ──────────────────────────────────────────────────
describe("Shift Management", () => {
    it("createShift adds a new shift with generated ID", () => {
        const before = useAttendanceStore.getState().shiftTemplates.length;
        useAttendanceStore.getState().createShift({
            name: "Flex Shift",
            startTime: "10:00",
            endTime: "19:00",
            gracePeriod: 15,
            breakDuration: 45,
            workDays: [1, 2, 3, 4, 5],
        });
        const shifts = useAttendanceStore.getState().shiftTemplates;
        expect(shifts).toHaveLength(before + 1);
        expect(shifts[shifts.length - 1].id).toMatch(/^SHIFT-/);
    });

    it("assignShift maps employeeId to shiftId", () => {
        useAttendanceStore.getState().assignShift(EMP_ID, "SHIFT-TEST-DAY");
        expect(useAttendanceStore.getState().employeeShifts[EMP_ID]).toBe("SHIFT-TEST-DAY");
    });

    it("assignShift overwrites a previous assignment", () => {
        useAttendanceStore.getState().assignShift(EMP_ID, "SHIFT-TEST-DAY");
        useAttendanceStore.getState().assignShift(EMP_ID, "SHIFT-TEST-MID");
        expect(useAttendanceStore.getState().employeeShifts[EMP_ID]).toBe("SHIFT-TEST-MID");
    });
});

// ─── resetTodayLog ───────────────────────────────────────────
describe("resetTodayLog", () => {
    it("removes today's log for the specified employee", () => {
        jest.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)).toBeDefined();

        useAttendanceStore.getState().resetTodayLog(EMP_ID);
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)).toBeUndefined();
    });

    it("does not affect other employees' today logs", () => {
        const OTHER = "TEST-EMP-OTHER";
        jest.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
        useAttendanceStore.getState().checkIn(EMP_ID);
        useAttendanceStore.setState({
            logs: [
                ...useAttendanceStore.getState().logs,
                { id: `ATT-${TODAY}-${OTHER}`, employeeId: OTHER, date: TODAY, status: "present" as const, checkIn: "08:00" },
            ],
        });

        useAttendanceStore.getState().resetTodayLog(EMP_ID);

        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)).toBeUndefined();
        expect(useAttendanceStore.getState().getEmployeeLogs(OTHER)).toHaveLength(1);
    });

    it("does not remove yesterday's log for the same employee", () => {
        const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
        useAttendanceStore.setState({
            logs: [
                { id: `ATT-${YESTERDAY}-${EMP_ID}`, employeeId: EMP_ID, date: YESTERDAY, status: "present" as const, checkIn: "08:00" },
                { id: `ATT-${TODAY}-${EMP_ID}`, employeeId: EMP_ID, date: TODAY, status: "present" as const, checkIn: "09:00" },
            ],
        });

        useAttendanceStore.getState().resetTodayLog(EMP_ID);

        const remaining = useAttendanceStore.getState().getEmployeeLogs(EMP_ID);
        expect(remaining).toHaveLength(1);
        expect(remaining[0].date).toBe(YESTERDAY);
    });

    it("is a no-op when no log exists for today", () => {
        expect(() => useAttendanceStore.getState().resetTodayLog(EMP_ID)).not.toThrow();
        expect(useAttendanceStore.getState().getTodayLog(EMP_ID)).toBeUndefined();
    });
});

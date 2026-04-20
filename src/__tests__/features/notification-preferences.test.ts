/**
 * NexHRMS — Notification Preferences & DB Persistence QA Tests
 * ==============================================================
 * Verifies that:
 *   1. prefKeyForTrigger() maps every trigger to the correct pref key
 *   2. isNotificationAllowed() blocks notifications when pref is OFF
 *   3. isPushAllowed() blocks push when pushEnabled is OFF
 *   4. dispatch() respects per-employee prefs (no log created when OFF)
 *   5. addLog() respects per-employee prefs (no log created when OFF)
 *   6. sendNotification() respects per-employee prefs
 *   7. Push fires only when pushEnabled is ON
 *   8. API route GET /api/settings/notification-preferences returns prefs
 *   9. API route PATCH validates ownership + saves correct prefs
 *  10. DB roundtrip: save prefs → load prefs → match
 *
 * AAA pattern, no mocking of the function under test.
 */

// ─── Mocks ────────────────────────────────────────────────────

const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

const MOCK_EMPLOYEES = [
  { id: "EMP-001", name: "Alice Admin", email: "alice@test.com", role: "admin", status: "active", profileId: "uuid-alice", jobTitle: "Admin", department: "Management", workType: "WFO" as const, salary: 80000, joinDate: "2024-01-01", productivity: 90, location: "" },
  { id: "EMP-002", name: "Bob Employee", email: "bob@test.com", role: "employee", status: "active", profileId: "uuid-bob", jobTitle: "Developer", department: "Engineering", workType: "WFO" as const, salary: 50000, joinDate: "2024-03-01", productivity: 85, location: "" },
  { id: "EMP-003", name: "Carol HR", email: "carol@test.com", role: "hr", status: "active", profileId: "uuid-carol", jobTitle: "HR Manager", department: "HR", workType: "WFO" as const, salary: 60000, joinDate: "2024-02-01", productivity: 88, location: "" },
];

jest.mock("@/store/employees.store", () => ({
  useEmployeesStore: {
    getState: () => ({ employees: MOCK_EMPLOYEES }),
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

let nanoidSeq = 0;

// ─── Imports ──────────────────────────────────────────────────

import {
  useNotificationsStore,
  prefKeyForTrigger,
  isNotificationAllowed,
  isPushAllowed,
  DEFAULT_EMPLOYEE_PREFS,
  type EmployeeNotifPrefs,
} from "@/store/notifications.store";

import {
  sendNotification,
  dispatchNotification,
  notifyPayslipPublished,
  notifyAbsence,
} from "@/lib/notifications";

// ─── Helpers ──────────────────────────────────────────────────

function resetStore() {
  useNotificationsStore.getState().resetToSeed();
}

function getLogsForEmployee(empId: string) {
  return useNotificationsStore.getState().logs.filter((l) => l.employeeId === empId);
}

function getAllPushPayloads() {
  return mockFetch.mock.calls
    .filter((c: [string, RequestInit]) => c[0] === "/api/push/send")
    .map((c: [string, RequestInit]) => JSON.parse(c[1].body as string));
}

// ═══════════════════════════════════════════════════════════════
// 1. PURE FUNCTION TESTS — prefKeyForTrigger
// ═══════════════════════════════════════════════════════════════

describe("prefKeyForTrigger() — Trigger-to-Preference Mapping", () => {
  it("should map leave_submitted to leaveUpdates", () => {
    expect(prefKeyForTrigger("leave_submitted")).toBe("leaveUpdates");
  });

  it("should map leave_approved to leaveUpdates", () => {
    expect(prefKeyForTrigger("leave_approved")).toBe("leaveUpdates");
  });

  it("should map leave_rejected to leaveUpdates", () => {
    expect(prefKeyForTrigger("leave_rejected")).toBe("leaveUpdates");
  });

  it("should map absence to absenceAlerts", () => {
    expect(prefKeyForTrigger("absence")).toBe("absenceAlerts");
  });

  it("should map attendance_missing to absenceAlerts", () => {
    expect(prefKeyForTrigger("attendance_missing")).toBe("absenceAlerts");
  });

  it("should map payslip_published to payrollAlerts", () => {
    expect(prefKeyForTrigger("payslip_published")).toBe("payrollAlerts");
  });

  it("should map payment_confirmed to payrollAlerts", () => {
    expect(prefKeyForTrigger("payment_confirmed")).toBe("payrollAlerts");
  });

  it("should map payslip_unsigned_reminder to payrollAlerts", () => {
    expect(prefKeyForTrigger("payslip_unsigned_reminder")).toBe("payrollAlerts");
  });

  it("should map payslip_signed to payrollAlerts", () => {
    expect(prefKeyForTrigger("payslip_signed")).toBe("payrollAlerts");
  });

  it("should return null for triggers without a pref gate (always allowed)", () => {
    const ungatedTriggers = [
      "geofence_violation", "loan_reminder", "overtime_submitted",
      "birthday", "contract_expiry", "daily_summary", "task_assigned",
      "task_submitted", "task_verified", "task_rejected",
      "cheat_detected", "location_disabled",
    ];
    ungatedTriggers.forEach((trigger) => {
      expect(prefKeyForTrigger(trigger)).toBeNull();
    });
  });

  it("should return null for unknown trigger strings", () => {
    expect(prefKeyForTrigger("unknown_trigger")).toBeNull();
    expect(prefKeyForTrigger("")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. isNotificationAllowed / isPushAllowed — State-Aware Checks
// ═══════════════════════════════════════════════════════════════

describe("isNotificationAllowed() — Per-Employee Category Gating", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `pref-${++nanoidSeq}`);
  });

  it("should ALLOW all categories by default (no prefs set)", () => {
    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(true);
    expect(isNotificationAllowed("EMP-002", "absence")).toBe(true);
    expect(isNotificationAllowed("EMP-002", "payslip_published")).toBe(true);
    expect(isNotificationAllowed("EMP-002", "task_assigned")).toBe(true);
  });

  it("should BLOCK leave notifications when leaveUpdates is OFF", () => {
    // Arrange
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    // Act & Assert
    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "leave_rejected")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "leave_submitted")).toBe(false);
  });

  it("should still ALLOW non-leave notifications when leaveUpdates is OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    expect(isNotificationAllowed("EMP-002", "payslip_published")).toBe(true);
    expect(isNotificationAllowed("EMP-002", "absence")).toBe(true);
    expect(isNotificationAllowed("EMP-002", "task_assigned")).toBe(true);
  });

  it("should BLOCK absence notifications when absenceAlerts is OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { absenceAlerts: false });

    expect(isNotificationAllowed("EMP-002", "absence")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "attendance_missing")).toBe(false);
  });

  it("should BLOCK payroll notifications when payrollAlerts is OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    expect(isNotificationAllowed("EMP-002", "payslip_published")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "payment_confirmed")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "payslip_unsigned_reminder")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "payslip_signed")).toBe(false);
  });

  it("should isolate prefs per employee — EMP-002 OFF, EMP-003 still ON", () => {
    // Arrange: Only EMP-002 disables leave
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    // Assert: EMP-002 blocked, EMP-003 allowed
    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(false);
    expect(isNotificationAllowed("EMP-003", "leave_approved")).toBe(true);
  });

  it("should handle multiple prefs OFF simultaneously", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", {
      leaveUpdates: false,
      absenceAlerts: false,
      payrollAlerts: false,
    });

    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "absence")).toBe(false);
    expect(isNotificationAllowed("EMP-002", "payslip_published")).toBe(false);
    // Ungated triggers should still be allowed
    expect(isNotificationAllowed("EMP-002", "task_assigned")).toBe(true);
  });

  it("should re-enable notifications when pref is toggled back ON", () => {
    // OFF
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });
    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(false);

    // ON again
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: true });
    expect(isNotificationAllowed("EMP-002", "leave_approved")).toBe(true);
  });
});

describe("isPushAllowed() — Push Notification Gating", () => {
  beforeEach(() => {
    resetStore();
  });

  it("should ALLOW push by default (pushEnabled defaults to true)", () => {
    expect(isPushAllowed("EMP-002")).toBe(true);
  });

  it("should BLOCK push when pushEnabled is OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });
    expect(isPushAllowed("EMP-002")).toBe(false);
  });

  it("should isolate push prefs per employee", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });

    expect(isPushAllowed("EMP-002")).toBe(false);
    expect(isPushAllowed("EMP-003")).toBe(true); // not set → default true
  });

  it("should re-enable push when toggled back ON", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });
    expect(isPushAllowed("EMP-002")).toBe(false);

    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: true });
    expect(isPushAllowed("EMP-002")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. DISPATCH GATING — Prefs ON/OFF affect dispatch()
// ═══════════════════════════════════════════════════════════════

describe("dispatch() — Respects Per-Employee Notification Preferences", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `disp-${++nanoidSeq}`);
  });

  it("should NOT create log when payrollAlerts is OFF for payslip_published", () => {
    // Arrange
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    // Act
    useNotificationsStore.getState().dispatch(
      "payslip_published",
      { name: "Bob", period: "Apr 2026", amount: "₱20,000" },
      "EMP-002",
    );

    // Assert — no log created, no push fired
    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should NOT create log when leaveUpdates is OFF for leave_approved", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    useNotificationsStore.getState().dispatch(
      "leave_approved",
      { name: "Bob", leaveType: "VL", dates: "2026-04-20", status: "approved" },
      "EMP-002",
    );

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("should NOT create log when absenceAlerts is OFF for absence", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { absenceAlerts: false });

    useNotificationsStore.getState().dispatch(
      "absence",
      { name: "Bob", date: "2026-04-15" },
      "EMP-002",
    );

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("should CREATE log when pref is ON (default)", () => {
    useNotificationsStore.getState().dispatch(
      "payslip_published",
      { name: "Bob", period: "Apr 2026", amount: "₱20,000" },
      "EMP-002",
    );

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(1);
  });

  it("should create log but NOT fire push when pushEnabled=false and pref=ON", () => {
    // Arrange: payrollAlerts=ON (default), pushEnabled=OFF
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });

    // Act
    useNotificationsStore.getState().dispatch(
      "payslip_published",
      { name: "Bob", period: "Apr 2026", amount: "₱20,000" },
      "EMP-002",
    );

    // Assert: log created (in-app notification exists) but no push
    const logs = getLogsForEmployee("EMP-002");
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("payslip_published");
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should block BOTH log and push when category is OFF (even if pushEnabled=ON)", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", {
      payrollAlerts: false,
      pushEnabled: true,
    });

    useNotificationsStore.getState().dispatch(
      "payslip_published",
      { name: "Bob", period: "Apr 2026", amount: "₱20,000" },
      "EMP-002",
    );

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should still allow ungated triggers even with all category prefs OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", {
      leaveUpdates: false,
      absenceAlerts: false,
      payrollAlerts: false,
    });

    // task_assigned is ungated (prefKeyForTrigger returns null)
    useNotificationsStore.getState().dispatch(
      "task_assigned",
      { title: "Build Feature X", dueDate: "2026-05-01" },
      "EMP-002",
    );

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
  });

  it("should respect different prefs for different employees in same batch", () => {
    // EMP-002 disables payroll, EMP-003 keeps it ON
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    const vars = { name: "Test", period: "Apr 2026", amount: "₱10,000" };
    useNotificationsStore.getState().dispatch("payslip_published", vars, "EMP-002");
    useNotificationsStore.getState().dispatch("payslip_published", vars, "EMP-003");

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
    expect(getLogsForEmployee("EMP-003")).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. addLog() GATING — Prefs ON/OFF affect addLog()
// ═══════════════════════════════════════════════════════════════

describe("addLog() — Respects Per-Employee Preferences", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `add-${++nanoidSeq}`);
  });

  it("should NOT create log when payrollAlerts is OFF for payslip_published type", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    useNotificationsStore.getState().addLog({
      employeeId: "EMP-002",
      type: "payslip_published",
      channel: "in_app",
      subject: "Payslip",
      body: "Your payslip is ready",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should NOT create log when leaveUpdates is OFF for leave_approved type", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    useNotificationsStore.getState().addLog({
      employeeId: "EMP-002",
      type: "leave_approved",
      channel: "in_app",
      subject: "Leave",
      body: "Approved",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("should create log but skip push when pushEnabled=false", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });

    useNotificationsStore.getState().addLog({
      employeeId: "EMP-002",
      type: "task_assigned",
      channel: "in_app",
      subject: "Task",
      body: "New task for you",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should create log AND fire push when pushEnabled=true (default)", () => {
    useNotificationsStore.getState().addLog({
      employeeId: "EMP-002",
      type: "task_assigned",
      channel: "in_app",
      subject: "Task",
      body: "New task for you",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(1);
    expect(getAllPushPayloads()[0].employeeId).toBe("EMP-002");
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. sendNotification() GATING
// ═══════════════════════════════════════════════════════════════

describe("sendNotification() — Respects Per-Employee Preferences", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `send-${++nanoidSeq}`);
  });

  it("should NOT create notification when payrollAlerts is OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    sendNotification({
      type: "payslip_published",
      employeeId: "EMP-002",
      subject: "Payslip Ready",
      body: "Your payslip is ready",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should NOT create notification when absenceAlerts is OFF for absence type", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { absenceAlerts: false });

    sendNotification({
      type: "absence",
      employeeId: "EMP-002",
      subject: "Absent",
      body: "You were marked absent",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("should create notification but skip push when pushEnabled=false", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });

    sendNotification({
      type: "assignment",
      employeeId: "EMP-002",
      subject: "Project",
      body: "Assigned to new project",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(0);
  });

  it("should create notification AND fire push when all prefs ON (default)", () => {
    sendNotification({
      type: "assignment",
      employeeId: "EMP-002",
      subject: "Project",
      body: "Assigned to new project",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. CONVENIENCE FACTORY GATING — notifyPayslipPublished, etc.
// ═══════════════════════════════════════════════════════════════

describe("Notification Factories — Respect Preferences", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `fac-${++nanoidSeq}`);
  });

  it("notifyPayslipPublished should be blocked when payrollAlerts=OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    notifyPayslipPublished({
      employeeId: "EMP-002",
      employeeName: "Bob Employee",
      employeeEmail: "bob@test.com",
      period: "Apr 2026",
      amount: "₱20,000",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("notifyPayslipPublished should succeed when payrollAlerts=ON", () => {
    notifyPayslipPublished({
      employeeId: "EMP-002",
      employeeName: "Bob Employee",
      employeeEmail: "bob@test.com",
      period: "Apr 2026",
      amount: "₱20,000",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getLogsForEmployee("EMP-002")[0].type).toBe("payslip_published");
  });

  it("notifyAbsence should be blocked when absenceAlerts=OFF", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { absenceAlerts: false });

    notifyAbsence({
      employeeId: "EMP-002",
      employeeName: "Bob Employee",
      employeeEmail: "bob@test.com",
      date: "2026-04-15",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
  });

  it("notifyAbsence should succeed when absenceAlerts=ON (default)", () => {
    notifyAbsence({
      employeeId: "EMP-002",
      employeeName: "Bob Employee",
      employeeEmail: "bob@test.com",
      date: "2026-04-15",
    });

    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getLogsForEmployee("EMP-002")[0].type).toBe("absence");
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. STORE setEmployeePref / getEmployeePref — Correctness
// ═══════════════════════════════════════════════════════════════

describe("setEmployeePref / getEmployeePref — Store State Management", () => {
  beforeEach(() => {
    resetStore();
  });

  it("should return DEFAULT_EMPLOYEE_PREFS when nothing has been set", () => {
    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs).toEqual(DEFAULT_EMPLOYEE_PREFS);
    expect(prefs.leaveUpdates).toBe(true);
    expect(prefs.absenceAlerts).toBe(true);
    expect(prefs.payrollAlerts).toBe(true);
    expect(prefs.pushEnabled).toBe(true);
  });

  it("should merge partial patch with defaults (not replace)", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });

    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs.leaveUpdates).toBe(false);
    // Others remain default
    expect(prefs.absenceAlerts).toBe(true);
    expect(prefs.payrollAlerts).toBe(true);
    expect(prefs.pushEnabled).toBe(true);
  });

  it("should support setting multiple prefs in one call", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", {
      leaveUpdates: false,
      payrollAlerts: false,
    });

    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs.leaveUpdates).toBe(false);
    expect(prefs.payrollAlerts).toBe(false);
    expect(prefs.absenceAlerts).toBe(true);
  });

  it("should support incremental updates (second call merges with first)", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs.leaveUpdates).toBe(false);
    expect(prefs.payrollAlerts).toBe(false);
  });

  it("should isolate prefs between employees", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false });
    useNotificationsStore.getState().setEmployeePref("EMP-003", { payrollAlerts: false });

    const bobPrefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    const carolPrefs = useNotificationsStore.getState().getEmployeePref("EMP-003");

    expect(bobPrefs.leaveUpdates).toBe(false);
    expect(bobPrefs.payrollAlerts).toBe(true); // Bob's payroll is still ON

    expect(carolPrefs.leaveUpdates).toBe(true); // Carol's leave is still ON
    expect(carolPrefs.payrollAlerts).toBe(false);
  });

  it("should reset all prefs on resetToSeed()", () => {
    useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: false, pushEnabled: false });

    useNotificationsStore.getState().resetToSeed();

    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs).toEqual(DEFAULT_EMPLOYEE_PREFS);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. API ROUTE — GET /api/settings/notification-preferences
// ═══════════════════════════════════════════════════════════════

describe("GET /api/settings/notification-preferences — Supabase Integration", () => {
  let createServerSupabaseClient: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    const serverMod = jest.requireMock("@/services/supabase-server");
    createServerSupabaseClient = serverMod.createServerSupabaseClient;
  });

  it("should return 401 when user is not authenticated", async () => {
    // Arrange: mock no user
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } }) },
      from: jest.fn(),
    });

    const { GET } = await import("@/app/api/settings/notification-preferences/route");
    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("should return employee preferences when authenticated", async () => {
    // Arrange: mock authenticated user + employee with prefs
    const mockUser = { id: "uuid-bob" };
    const mockPrefs = { leaveUpdates: false, absenceAlerts: true, payrollAlerts: true, pushEnabled: false };

    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "EMP-002", notification_preferences: mockPrefs },
              error: null,
            }),
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/settings/notification-preferences/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employeeId).toBe("EMP-002");
    expect(body.preferences).toEqual(mockPrefs);
  });

  it("should return empty prefs when column doesn't exist (pre-migration)", async () => {
    const mockUser = { id: "uuid-bob" };
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "column notification_preferences does not exist" },
            }),
          }),
        }),
      }),
    });

    const { GET } = await import("@/app/api/settings/notification-preferences/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employeeId).toBeNull();
    expect(body.preferences).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. API ROUTE — PATCH /api/settings/notification-preferences
// ═══════════════════════════════════════════════════════════════

describe("PATCH /api/settings/notification-preferences — Supabase Integration", () => {
  let createServerSupabaseClient: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    const serverMod = jest.requireMock("@/services/supabase-server");
    createServerSupabaseClient = serverMod.createServerSupabaseClient;
  });

  it("should return 401 when user is not authenticated", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "No session" } }) },
      from: jest.fn(),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ employeeId: "EMP-002", preferences: { leaveUpdates: false } }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when preferences is missing or invalid", async () => {
    const mockUser = { id: "uuid-bob" };
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn(),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ employeeId: "EMP-002" }), // no preferences
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("preferences");
  });

  it("should return 403 when employee does not belong to user (ownership check)", async () => {
    const mockUser = { id: "uuid-attacker" }; // NOT uuid-bob
    const mockSelectReturn = {
      single: jest.fn().mockResolvedValue({
        data: { id: "EMP-002", profile_id: "uuid-bob" }, // belongs to Bob, not attacker
        error: null,
      }),
    };

    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(mockSelectReturn),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ employeeId: "EMP-002", preferences: { leaveUpdates: false } }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("should return 404 when employee ID doesn't exist", async () => {
    const mockUser = { id: "uuid-bob" };
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
      }),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ employeeId: "EMP-999", preferences: { leaveUpdates: false } }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("should sanitize preferences — only accept known boolean keys", async () => {
    const mockUser = { id: "uuid-bob" };
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "EMP-002", profile_id: "uuid-bob" },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      }),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({
        employeeId: "EMP-002",
        preferences: {
          leaveUpdates: false,
          payrollAlerts: true,
          // These should be stripped:
          sqlInjection: "DROP TABLE employees",
          xssPayload: "<script>alert(1)</script>",
          numericValue: 42,
          pushEnabled: true,
        },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Only valid boolean pref keys should be saved
    expect(body.preferences).toEqual({
      leaveUpdates: false,
      payrollAlerts: true,
      pushEnabled: true,
    });
    // Malicious keys should NOT be present
    expect(body.preferences.sqlInjection).toBeUndefined();
    expect(body.preferences.xssPayload).toBeUndefined();
    expect(body.preferences.numericValue).toBeUndefined();
  });

  it("should successfully update prefs for own employee record", async () => {
    const mockUser = { id: "uuid-bob" };
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "EMP-002", profile_id: "uuid-bob" },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      }),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({
        employeeId: "EMP-002",
        preferences: { leaveUpdates: false, absenceAlerts: false, payrollAlerts: true, pushEnabled: true },
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.preferences.leaveUpdates).toBe(false);
    expect(body.preferences.absenceAlerts).toBe(false);
    expect(body.preferences.payrollAlerts).toBe(true);
    expect(body.preferences.pushEnabled).toBe(true);

    // Verify Supabase update was called with sanitized prefs
    expect(mockUpdate).toHaveBeenCalledWith({
      notification_preferences: {
        leaveUpdates: false,
        absenceAlerts: false,
        payrollAlerts: true,
        pushEnabled: true,
      },
    });
  });

  it("should gracefully handle pre-migration column missing on update", async () => {
    const mockUser = { id: "uuid-bob" };
    createServerSupabaseClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "EMP-002", profile_id: "uuid-bob" },
              error: null,
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: "column notification_preferences does not exist" },
          }),
        }),
      }),
    });

    const { PATCH } = await import("@/app/api/settings/notification-preferences/route");
    const req = new Request("http://localhost/api/settings/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ employeeId: "EMP-002", preferences: { leaveUpdates: false } }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.note).toContain("not yet migrated");
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. END-TO-END SCENARIO — Toggle OFF, Dispatch, Toggle ON
// ═══════════════════════════════════════════════════════════════

describe("End-to-End Scenario — Full Toggle Lifecycle", () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    nanoidSeq = 0;
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `e2e-${++nanoidSeq}`);
  });

  it("should block payslip_published when OFF, then allow after toggling back ON", () => {
    const store = useNotificationsStore.getState();

    // Step 1: Default — ON
    store.dispatch("payslip_published", { name: "Bob", period: "Mar 2026", amount: "₱15K" }, "EMP-002");
    expect(getLogsForEmployee("EMP-002")).toHaveLength(1);
    expect(getAllPushPayloads()).toHaveLength(1);

    // Step 2: Turn payrollAlerts OFF
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });

    // Step 3: Dispatch again — should be blocked
    useNotificationsStore.getState().dispatch("payslip_published", { name: "Bob", period: "Apr 2026", amount: "₱16K" }, "EMP-002");
    expect(getLogsForEmployee("EMP-002")).toHaveLength(1); // still only 1 from step 1
    expect(getAllPushPayloads()).toHaveLength(1); // still only 1

    // Step 4: Turn payrollAlerts back ON
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: true });

    // Step 5: Dispatch again — should succeed
    useNotificationsStore.getState().dispatch("payslip_published", { name: "Bob", period: "May 2026", amount: "₱17K" }, "EMP-002");
    expect(getLogsForEmployee("EMP-002")).toHaveLength(2); // now 2
    expect(getAllPushPayloads()).toHaveLength(2); // now 2
  });

  it("should independently control in-app vs push with pushEnabled toggle", () => {
    const store = useNotificationsStore.getState();

    // Step 1: pushEnabled=false — in-app should still work
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: false });

    store.dispatch("payslip_published", { name: "Bob", period: "Apr 2026", amount: "₱20K" }, "EMP-002");
    expect(getLogsForEmployee("EMP-002")).toHaveLength(1); // in-app log created
    expect(getAllPushPayloads()).toHaveLength(0); // no push

    // Step 2: pushEnabled=true — push should fire
    useNotificationsStore.getState().setEmployeePref("EMP-002", { pushEnabled: true });

    useNotificationsStore.getState().dispatch("payment_confirmed", { name: "Bob", period: "Apr 2026", amount: "₱20K" }, "EMP-002");
    expect(getLogsForEmployee("EMP-002")).toHaveLength(2); // two in-app logs
    expect(getAllPushPayloads()).toHaveLength(1); // one push (only second dispatch)
  });

  it("should handle rapid toggles without data corruption", () => {
    // Rapidly toggle prefs
    for (let i = 0; i < 10; i++) {
      useNotificationsStore.getState().setEmployeePref("EMP-002", { leaveUpdates: i % 2 === 0 });
    }

    // After 10 toggles (0→true, 1→false, ..., 9→false), final should be false
    const prefs = useNotificationsStore.getState().getEmployeePref("EMP-002");
    expect(prefs.leaveUpdates).toBe(false); // last toggle was i=9 → false

    // Other prefs should be untouched
    expect(prefs.absenceAlerts).toBe(true);
    expect(prefs.payrollAlerts).toBe(true);
    expect(prefs.pushEnabled).toBe(true);
  });

  it("should correctly gate notifications for MULTIPLE employees with DIFFERENT prefs simultaneously", () => {
    // EMP-002: payroll OFF, leave ON
    useNotificationsStore.getState().setEmployeePref("EMP-002", { payrollAlerts: false });
    // EMP-003: payroll ON, leave OFF
    useNotificationsStore.getState().setEmployeePref("EMP-003", { leaveUpdates: false });

    // Dispatch payslip to both
    useNotificationsStore.getState().dispatch("payslip_published", { name: "Bob", period: "Apr", amount: "₱1" }, "EMP-002");
    useNotificationsStore.getState().dispatch("payslip_published", { name: "Carol", period: "Apr", amount: "₱2" }, "EMP-003");

    // EMP-002 blocked, EMP-003 received
    expect(getLogsForEmployee("EMP-002").filter(l => l.type === "payslip_published")).toHaveLength(0);
    expect(getLogsForEmployee("EMP-003").filter(l => l.type === "payslip_published")).toHaveLength(1);

    // Dispatch leave_approved to both
    useNotificationsStore.getState().dispatch("leave_approved", { name: "Bob", leaveType: "VL", dates: "2026-05-01", status: "approved" }, "EMP-002");
    useNotificationsStore.getState().dispatch("leave_approved", { name: "Carol", leaveType: "SL", dates: "2026-05-02", status: "approved" }, "EMP-003");

    // EMP-002 received, EMP-003 blocked
    expect(getLogsForEmployee("EMP-002").filter(l => l.type === "leave_approved")).toHaveLength(1);
    expect(getLogsForEmployee("EMP-003").filter(l => l.type === "leave_approved")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. DEFAULT_EMPLOYEE_PREFS — Exported Constant Verification
// ═══════════════════════════════════════════════════════════════

describe("DEFAULT_EMPLOYEE_PREFS — Correct Defaults", () => {
  it("should have all prefs enabled by default", () => {
    expect(DEFAULT_EMPLOYEE_PREFS).toEqual({
      leaveUpdates: true,
      absenceAlerts: true,
      payrollAlerts: true,
      pushEnabled: true,
    });
  });

  it("should have exactly 4 keys (no extra, no missing)", () => {
    const keys = Object.keys(DEFAULT_EMPLOYEE_PREFS);
    expect(keys).toHaveLength(4);
    expect(keys).toContain("leaveUpdates");
    expect(keys).toContain("absenceAlerts");
    expect(keys).toContain("payrollAlerts");
    expect(keys).toContain("pushEnabled");
  });
});

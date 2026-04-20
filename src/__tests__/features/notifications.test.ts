/**
 * NexHRMS — Notification System QA Tests
 * ========================================
 * Verifies that:
 * 1. Every notification path delivers to the CORRECT recipient(s)
 * 2. Notification text (subject + body) is correctly formatted
 * 3. Push notifications fire for every in-app notification
 * 4. Channel routing matches rule configuration
 * 5. Template rendering replaces all placeholders
 *
 * Coverage targets:
 *   - addLog() recipient routing → 100%
 *   - dispatch() recipient + template rendering → 100%
 *   - sendNotification() recipient + push → 100%
 *   - All convenience factories (notifyPayslipPublished, etc.) → 100%
 *   - Task store notification dispatch → 100%
 *   - Overtime store notification dispatch → 100%
 */

// ─── Mocks ────────────────────────────────────────────────────
// Must be declared before imports (Jest hoists jest.mock calls)

const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

// Mock employees store with test employees
const MOCK_EMPLOYEES = [
  { id: "EMP-001", name: "Alice Admin", email: "alice@test.com", role: "admin", status: "active", jobTitle: "Admin", department: "Management", workType: "WFO" as const, salary: 80000, joinDate: "2024-01-01", productivity: 90, location: "" },
  { id: "EMP-002", name: "Bob Employee", email: "bob@test.com", role: "employee", status: "active", jobTitle: "Developer", department: "Engineering", workType: "WFO" as const, salary: 50000, joinDate: "2024-03-01", productivity: 85, location: "" },
  { id: "EMP-003", name: "Carol HR", email: "carol@test.com", role: "hr", status: "active", jobTitle: "HR Manager", department: "HR", workType: "WFO" as const, salary: 60000, joinDate: "2024-02-01", productivity: 88, location: "" },
  { id: "EMP-004", name: "Dave Finance", email: "dave@test.com", role: "finance", status: "active", jobTitle: "Finance Officer", department: "Finance", workType: "WFO" as const, salary: 55000, joinDate: "2024-04-01", productivity: 82, location: "" },
  { id: "EMP-005", name: "Eve Supervisor", email: "eve@test.com", role: "supervisor", status: "active", jobTitle: "Team Lead", department: "Engineering", workType: "WFO" as const, salary: 65000, joinDate: "2024-01-15", productivity: 92, location: "" },
  { id: "EMP-006", name: "Frank Employee", email: "frank@test.com", role: "employee", status: "active", jobTitle: "QA Engineer", department: "Engineering", workType: "WFO" as const, salary: 48000, joinDate: "2024-05-01", productivity: 78, location: "" },
];

jest.mock("@/store/employees.store", () => ({
  useEmployeesStore: {
    getState: () => ({
      employees: MOCK_EMPLOYEES,
    }),
  },
}));

jest.mock("@/store/audit.store", () => ({
  useAuditStore: {
    getState: () => ({
      log: jest.fn(),
    }),
  },
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// nanoid is mocked globally in setup.ts; we re-set its implementation
// in beforeEach to produce unique IDs per call (setup.ts resets mocks)
let nanoidCounter = 0;

// ─── Imports ──────────────────────────────────────────────────

import { useNotificationsStore } from "@/store/notifications.store";
import {
  sendNotification,
  dispatchNotification,
  notifyProjectAssignment,
  notifyAbsence,
  notifyGeofenceViolation,
  notifyPayslipPublished,
  notifyPayslipSigned,
  notifyPaymentConfirmed,
  notifyLocationDisabled,
} from "@/lib/notifications";

// ─── Helpers ──────────────────────────────────────────────────

/** Reset the store to a clean state before each test */
function resetStore() {
  useNotificationsStore.getState().resetToSeed();
}

/** Get the most recently added notification log */
function getLatestLog() {
  return useNotificationsStore.getState().logs[0];
}

/** Get all logs for a specific employee */
function getLogsForEmployee(employeeId: string) {
  return useNotificationsStore.getState().logs.filter((l) => l.employeeId === employeeId);
}

/** Get all logs of a specific type */
function getLogsByType(type: string) {
  return useNotificationsStore.getState().logs.filter((l) => l.type === type);
}

/** Extract the push payload from the last fetch call */
function getLastPushPayload(): { employeeId: string; title: string; body: string; url: string; tag: string } | null {
  const calls = mockFetch.mock.calls.filter(
    (c: [string, RequestInit]) => c[0] === "/api/push/send"
  );
  if (calls.length === 0) return null;
  const lastCall = calls[calls.length - 1];
  return JSON.parse(lastCall[1].body as string);
}

/** Get ALL push payloads from fetch calls */
function getAllPushPayloads(): { employeeId: string; title: string; body: string; url: string; tag: string }[] {
  return mockFetch.mock.calls
    .filter((c: [string, RequestInit]) => c[0] === "/api/push/send")
    .map((c: [string, RequestInit]) => JSON.parse(c[1].body as string));
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════

describe("Notification System — Recipient Correctness & Text Format", () => {
  beforeEach(() => {
    resetStore();
    nanoidCounter = 0;
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true });
    // Restore nanoid to produce unique sequential IDs (setup.ts afterEach resets)
    const { nanoid } = jest.requireMock("nanoid") as { nanoid: jest.Mock };
    nanoid.mockImplementation(() => `mock-${++nanoidCounter}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. addLog() — Direct store method
  // ─────────────────────────────────────────────────────────────
  describe("addLog() — Direct Notification Creation", () => {
    it("should create notification for the exact employee specified", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({
        employeeId: "EMP-002",
        type: "task_assigned",
        channel: "in_app",
        subject: "New Task Assigned",
        body: "You have been assigned: Build Login Page",
        link: "/tasks/TSK-001",
      });

      const logs = getLogsForEmployee("EMP-002");
      expect(logs).toHaveLength(1);
      expect(logs[0].employeeId).toBe("EMP-002");
      expect(logs[0].subject).toBe("New Task Assigned");
      expect(logs[0].body).toBe("You have been assigned: Build Login Page");
      expect(logs[0].type).toBe("task_assigned");
      expect(logs[0].link).toBe("/tasks/TSK-001");
    });

    it("should NOT create notification for other employees", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({
        employeeId: "EMP-002",
        type: "task_assigned",
        channel: "in_app",
        subject: "Test",
        body: "Test body",
      });

      // EMP-001 (admin) should have zero notifications
      expect(getLogsForEmployee("EMP-001")).toHaveLength(0);
      // EMP-003 (HR) should have zero notifications
      expect(getLogsForEmployee("EMP-003")).toHaveLength(0);
      // EMP-006 (another employee) should have zero notifications
      expect(getLogsForEmployee("EMP-006")).toHaveLength(0);
    });

    it("should fire push notification to the correct employee", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({
        employeeId: "EMP-002",
        type: "task_assigned",
        channel: "in_app",
        subject: "New Task",
        body: "You've been assigned a task",
        link: "/tasks/TSK-001",
      });

      const pushPayload = getLastPushPayload();
      expect(pushPayload).not.toBeNull();
      expect(pushPayload!.employeeId).toBe("EMP-002");
      expect(pushPayload!.title).toBe("New Task");
      expect(pushPayload!.body).toBe("You've been assigned a task");
      // URL should be role-prefixed (EMP-002 is "employee")
      expect(pushPayload!.url).toBe("/employee/tasks/TSK-001");
    });

    it("should resolve role-prefixed URL for admin employee", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({
        employeeId: "EMP-001",
        type: "task_assigned",
        channel: "in_app",
        subject: "Admin Task",
        body: "Admin task body",
        link: "/tasks/TSK-002",
      });

      const pushPayload = getLastPushPayload();
      expect(pushPayload!.url).toBe("/admin/tasks/TSK-002");
    });

    it("should generate unique notification IDs (NOTIF- prefix)", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "A", body: "B" });
      addLog({ employeeId: "EMP-002", type: "task_verified", channel: "in_app", subject: "C", body: "D" });

      const logs = getLogsForEmployee("EMP-002");
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toMatch(/^NOTIF-/);
      expect(logs[1].id).toMatch(/^NOTIF-/);
      expect(logs[0].id).not.toBe(logs[1].id); // unique
    });

    it("should set sentAt timestamp and simulated status", () => {
      const { addLog } = useNotificationsStore.getState();
      const before = new Date().toISOString();

      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "X", body: "Y" });

      const log = getLatestLog();
      expect(log.sentAt).toBeDefined();
      expect(new Date(log.sentAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(log.status).toBe("simulated");
    });

    it("should default link to /notifications when no link provided", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "X", body: "Y" });

      const pushPayload = getLastPushPayload();
      // Should be role-prefixed /notifications
      expect(pushPayload!.url).toBe("/employee/notifications");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. dispatch() — Rules-based notification engine
  // ─────────────────────────────────────────────────────────────
  describe("dispatch() — Rules-Based Template Engine", () => {
    it("should render payslip_published template correctly for employee", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_published",
        { name: "Bob Employee", period: "Apr 1-15 2026", amount: "₱20,000.00" },
        "EMP-002",
        "bob@test.com",
        "09171234567"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-002");
      expect(log.subject).toBe("Payslip Ready: Apr 1-15 2026");
      // channel=both uses smsTemplate: "Your payslip for {period} is ready. Net: {amount}."
      expect(log.body).toContain("Apr 1-15 2026");
      expect(log.body).toContain("₱20,000.00");
      expect(log.type).toBe("payslip_published");
    });

    it("should render leave_approved template with correct recipient", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "leave_approved",
        { name: "Bob Employee", leaveType: "Vacation Leave", dates: "2026-04-20 – 2026-04-22", status: "approved" },
        "EMP-002"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-002");
      expect(log.subject).toBe("Leave approved: 2026-04-20 – 2026-04-22");
      // channel=both with smsTemplate: "Your {leaveType} leave ({dates}) has been {status}."
      expect(log.body).toContain("Vacation Leave");
      expect(log.body).toContain("2026-04-20 – 2026-04-22");
      expect(log.body).toContain("approved");
    });

    it("should render leave_rejected template with correct recipient", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "leave_rejected",
        { name: "Frank Employee", leaveType: "Sick Leave", dates: "2026-04-18 – 2026-04-18", status: "rejected" },
        "EMP-006"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-006");
      expect(log.subject).toBe("Leave Rejected: 2026-04-18 – 2026-04-18");
      expect(log.body).toContain("Frank Employee");
      expect(log.body).toContain("Sick Leave");
      expect(log.body).toContain("rejected");
    });

    it("should render overtime_submitted template for admin recipients", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "overtime_submitted",
        { name: "Bob Employee", date: "2026-04-15" },
        "EMP-001", // admin is the recipient
        "alice@test.com"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-001");
      expect(log.subject).toBe("Overtime Request: Bob Employee");
      expect(log.body).toContain("Bob Employee");
      expect(log.body).toContain("2026-04-15");
    });

    it("should render geofence_violation template for admin", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "geofence_violation",
        { name: "Bob Employee", time: "09:15 AM", distance: "250" },
        "EMP-001"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-001");
      expect(log.subject).toBe("Geofence Violation: Bob Employee");
      expect(log.body).toContain("Bob Employee");
      expect(log.body).toContain("09:15 AM");
      expect(log.body).toContain("250m");
    });

    it("should render payment_confirmed with correct SMS body", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payment_confirmed",
        { name: "Bob Employee", period: "Apr 1-15 2026", amount: "₱20,000" },
        "EMP-002",
        undefined,
        "09171234567"
      );

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-002");
      expect(log.subject).toBe("Payment Confirmed: Apr 1-15 2026");
      // SMS channel uses smsTemplate
      expect(log.body).toContain("Payment confirmed");
      expect(log.body).toContain("₱20,000");
    });

    it("should render payslip_signed template", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_signed",
        { name: "Bob Employee", period: "Apr 1-15 2026" },
        "EMP-002"
      );

      const log = getLatestLog();
      expect(log.subject).toBe("Payslip Signed: Bob Employee (Apr 1-15 2026)");
      expect(log.body).toContain("Bob Employee");
      expect(log.body).toContain("signed");
    });

    it("should fire push notification on dispatch", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_published",
        { name: "Bob Employee", period: "Apr 2026", amount: "₱20,000" },
        "EMP-002"
      );

      const pushPayload = getLastPushPayload();
      expect(pushPayload).not.toBeNull();
      expect(pushPayload!.employeeId).toBe("EMP-002");
      expect(pushPayload!.title).toBe("Payslip Ready: Apr 2026");
      expect(pushPayload!.url).toBe("/employee/payroll");
    });

    it("should NOT dispatch when rule is disabled", () => {
      const { toggleRule, dispatch } = useNotificationsStore.getState();

      // Disable payslip_published rule (NR-01)
      toggleRule("NR-01");

      dispatch(
        "payslip_published",
        { name: "Bob Employee", period: "Apr 2026", amount: "₱20,000" },
        "EMP-002"
      );

      expect(useNotificationsStore.getState().logs).toHaveLength(0);
    });

    it("should replace all template placeholders — no leftover {var}", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_published",
        { name: "Bob", period: "Apr 2026", amount: "₱20K" },
        "EMP-002"
      );

      const log = getLatestLog();
      // No unreplaced {placeholders} should remain
      expect(log.subject).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(log.body).not.toMatch(/\{[a-zA-Z]+\}/);
    });

    it("should auto-generate link based on trigger type", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "leave_approved",
        { name: "Bob", leaveType: "VL", dates: "2026-04-20", status: "approved" },
        "EMP-002"
      );

      const log = getLatestLog();
      expect(log.link).toBe("/leave");
    });

    it("should create exactly ONE log entry per dispatch (no duplicates for channel=both)", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_published", // channel = "both" (email + SMS)
        { name: "Bob", period: "Apr 2026", amount: "₱20K" },
        "EMP-002",
        "bob@test.com",
        "09171234567"
      );

      // Should be exactly 1 log, not 2 (previous bug created 2 for "both")
      const logs = getLogsForEmployee("EMP-002");
      expect(logs).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. sendNotification() — Lib helper
  // ─────────────────────────────────────────────────────────────
  describe("sendNotification() — Direct Notification Helper", () => {
    it("should create log for the exact employee and fire push", () => {
      sendNotification({
        type: "assignment",
        employeeId: "EMP-002",
        subject: "Project Assignment: Website Redesign",
        body: "Hi Bob, you've been assigned to Website Redesign.",
        channel: "email",
        employeeEmail: "bob@test.com",
      });

      const log = getLatestLog();
      expect(log.employeeId).toBe("EMP-002");
      expect(log.type).toBe("assignment");
      expect(log.subject).toBe("Project Assignment: Website Redesign");
      expect(log.body).toBe("Hi Bob, you've been assigned to Website Redesign.");
      expect(log.channel).toBe("email");
      expect(log.recipientEmail).toBe("bob@test.com");

      // Push should fire
      const pushPayload = getLastPushPayload();
      expect(pushPayload!.employeeId).toBe("EMP-002");
      expect(pushPayload!.url).toBe("/employee/projects");
    });

    it("should NOT create notification for other employees", () => {
      sendNotification({
        type: "assignment",
        employeeId: "EMP-006",
        subject: "Test",
        body: "Test",
      });

      expect(getLogsForEmployee("EMP-001")).toHaveLength(0);
      expect(getLogsForEmployee("EMP-002")).toHaveLength(0);
      expect(getLogsForEmployee("EMP-006")).toHaveLength(1);
    });

    it("should auto-resolve link based on notification type", () => {
      sendNotification({
        type: "leave_approved",
        employeeId: "EMP-002",
        subject: "Leave Approved",
        body: "Your leave is approved",
      });

      const log = getLatestLog();
      expect(log.link).toBe("/leave");
    });

    it("should use explicit link when provided", () => {
      sendNotification({
        type: "task_assigned",
        employeeId: "EMP-002",
        subject: "Task",
        body: "Task body",
        link: "/tasks/TSK-CUSTOM",
      });

      const log = getLatestLog();
      expect(log.link).toBe("/tasks/TSK-CUSTOM");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Convenience Factories — Correct recipient + format
  // ─────────────────────────────────────────────────────────────
  describe("Notification Factories — Recipient & Format Verification", () => {
    describe("notifyProjectAssignment()", () => {
      it("should notify the assigned employee with correct project details", () => {
        notifyProjectAssignment({
          employeeId: "EMP-002",
          employeeName: "Bob Employee",
          employeeEmail: "bob@test.com",
          projectName: "Website Redesign 2026",
        });

        const log = getLatestLog();
        expect(log.employeeId).toBe("EMP-002");
        expect(log.type).toBe("assignment");
        expect(log.subject).toBe("New Project Assignment: Website Redesign 2026");
        expect(log.body).toContain("Bob Employee");
        expect(log.body).toContain("Website Redesign 2026");
        expect(log.recipientEmail).toBe("bob@test.com");

        const push = getLastPushPayload();
        expect(push!.employeeId).toBe("EMP-002");
      });
    });

    describe("notifyAbsence()", () => {
      it("should notify the absent employee with date", () => {
        notifyAbsence({
          employeeId: "EMP-006",
          employeeName: "Frank Employee",
          employeeEmail: "frank@test.com",
          date: "2026-04-15",
        });

        const log = getLatestLog();
        expect(log.employeeId).toBe("EMP-006");
        expect(log.type).toBe("absence");
        expect(log.subject).toContain("2026-04-15");
        expect(log.body).toContain("Frank Employee");
        expect(log.body).toContain("2026-04-15");
      });
    });

    describe("notifyGeofenceViolation()", () => {
      it("should auto-resolve and notify all admin users", () => {
        notifyGeofenceViolation({
          employeeId: "EMP-002", // the offending employee
          employeeName: "Bob Employee",
          employeeEmail: "bob@test.com",
          distance: 250,
          time: "09:15 AM",
        });

        // Should notify EMP-001 (admin), NOT EMP-002 (the offending employee)
        const adminLogs = getLogsForEmployee("EMP-001").filter((l) => l.type === "geofence_violation");
        expect(adminLogs).toHaveLength(1);
        expect(adminLogs[0].subject).toContain("Bob Employee");
        expect(adminLogs[0].body).toContain("250m");

        // The offending employee should NOT receive the violation notification
        const empLogs = getLogsForEmployee("EMP-002").filter((l) => l.type === "geofence_violation");
        expect(empLogs).toHaveLength(0);
      });
    });

    describe("notifyPayslipPublished()", () => {
      it("should notify the correct employee with payslip details", () => {
        notifyPayslipPublished({
          employeeId: "EMP-002",
          employeeName: "Bob Employee",
          employeeEmail: "bob@test.com",
          employeePhone: "09171234567",
          period: "Apr 1-15 2026",
          amount: "₱20,000.00",
        });

        const log = getLatestLog();
        expect(log.employeeId).toBe("EMP-002");
        expect(log.type).toBe("payslip_published");
        expect(log.subject).toBe("Payslip Ready: Apr 1-15 2026");
        // channel=both uses smsTemplate for body (doesn't contain {name})
        expect(log.body).toContain("Apr 1-15 2026");
        expect(log.body).toContain("₱20,000.00");
        expect(log.link).toBe("/payroll");

        const push = getLastPushPayload();
        expect(push!.employeeId).toBe("EMP-002");
        expect(push!.url).toBe("/employee/payroll");
      });
    });

    describe("notifyPayslipSigned()", () => {
      it("should NOT notify the signing employee (only admin/finance)", () => {
        notifyPayslipSigned({
          employeeId: "EMP-002",
          employeeName: "Bob Employee",
          period: "Apr 1-15 2026",
        });

        // notifyPayslipSigned filters: e.id !== params.employeeId
        // So the signer (EMP-002) should NOT receive a notification
        const empLogs = getLogsForEmployee("EMP-002").filter((l) => l.type === "payslip_signed");
        expect(empLogs).toHaveLength(0);
      });

      it("should also notify admin and finance users", () => {
        notifyPayslipSigned({
          employeeId: "EMP-002",
          employeeName: "Bob Employee",
          period: "Apr 1-15 2026",
        });

        // EMP-001 (admin) should receive payslip_signed notification
        const adminLogs = getLogsForEmployee("EMP-001").filter((l) => l.type === "payslip_signed");
        expect(adminLogs).toHaveLength(1);
        expect(adminLogs[0].subject).toContain("Bob Employee");

        // EMP-004 (finance) should receive payslip_signed notification
        const financeLogs = getLogsForEmployee("EMP-004").filter((l) => l.type === "payslip_signed");
        expect(financeLogs).toHaveLength(1);
        expect(financeLogs[0].subject).toContain("Bob Employee");

        // EMP-003 (HR) should NOT receive payslip_signed notification
        const hrLogs = getLogsForEmployee("EMP-003").filter((l) => l.type === "payslip_signed");
        expect(hrLogs).toHaveLength(0);
      });
    });

    describe("notifyPaymentConfirmed()", () => {
      it("should notify the employee whose payment was confirmed", () => {
        notifyPaymentConfirmed({
          employeeId: "EMP-006",
          employeeName: "Frank Employee",
          employeePhone: "09181234567",
          period: "Apr 1-15 2026",
          amount: "₱18,500.00",
        });

        const log = getLatestLog();
        expect(log.employeeId).toBe("EMP-006");
        expect(log.type).toBe("payment_confirmed");
        expect(log.subject).toBe("Payment Confirmed: Apr 1-15 2026");
        expect(log.body).toContain("₱18,500.00");
      });
    });

    describe("notifyLocationDisabled()", () => {
      it("should notify admin users (excluding the offending employee)", () => {
        // Pass EMP-002 as the offending employee — admin (EMP-001) should be notified
        notifyLocationDisabled({
          employeeId: "EMP-002",
          employeeName: "Bob Employee",
          time: "14:30",
        });

        // EMP-001 (admin) should receive the notification
        const adminLogs = getLogsForEmployee("EMP-001").filter((l) => l.type === "location_disabled");
        expect(adminLogs).toHaveLength(1);
        expect(adminLogs[0].subject).toContain("Bob Employee");
        expect(adminLogs[0].body).toContain("14:30");

        // EMP-002 (offending employee) should NOT receive it
        const empLogs = getLogsForEmployee("EMP-002").filter((l) => l.type === "location_disabled");
        expect(empLogs).toHaveLength(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Task Store — Notification Integration
  // ─────────────────────────────────────────────────────────────
  describe("Task Store — Notification Recipient Routing", () => {
    // We import the task store lazily to avoid circular dependency issues
    let useTasksStore: typeof import("@/store/tasks.store").useTasksStore;

    beforeEach(async () => {
      // Dynamic import to ensure mock setup is complete
      const taskModule = await import("@/store/tasks.store");
      useTasksStore = taskModule.useTasksStore;
      // Reset task store to prevent state leakage between tests
      useTasksStore.setState({ tasks: [], completionReports: [], comments: [], taskTags: [] });
    });

    it("should notify ALL assignees when a task is created", () => {
      const { addTask } = useTasksStore.getState();

      addTask({
        title: "Build Login Page",
        description: "Implement the login page with Supabase auth",
        assignedTo: ["EMP-002", "EMP-006"],
        priority: "high",
        status: "open",
        createdBy: "EMP-001",
        groupId: "GRP-001",
        completionRequired: false,
      });

      // Both assignees should get notifications
      const logsEMP002 = getLogsForEmployee("EMP-002");
      const logsEMP006 = getLogsForEmployee("EMP-006");
      expect(logsEMP002).toHaveLength(1);
      expect(logsEMP006).toHaveLength(1);

      // Admin (creator) should NOT get a notification
      expect(getLogsForEmployee("EMP-001")).toHaveLength(0);

      // Verify text format
      expect(logsEMP002[0].subject).toBe("New Task Assigned");
      expect(logsEMP002[0].body).toBe("You have been assigned: Build Login Page");
      expect(logsEMP002[0].type).toBe("task_assigned");
    });

    it("should notify ALL assignees when task is verified", () => {
      const state = useTasksStore.getState();

      // Setup: create a task and submit completion
      const taskId = state.addTask({
        title: "Fix Bug #42",
        description: "Critical bug fix",
        assignedTo: ["EMP-002", "EMP-006"],
        priority: "high",
        status: "open",
        createdBy: "EMP-001",
        groupId: "GRP-001",
        completionRequired: true,
      });

      // Clear addTask notifications
      resetStore();
      mockFetch.mockClear();

      const reportId = useTasksStore.getState().submitCompletion({
        taskId,
        employeeId: "EMP-002",
        notes: "Fixed the bug",
      });

      // Verify completion
      useTasksStore.getState().verifyCompletion(reportId, "EMP-001");

      const logsEMP002 = getLogsForEmployee("EMP-002");
      const logsEMP006 = getLogsForEmployee("EMP-006");
      expect(logsEMP002).toHaveLength(1);
      expect(logsEMP006).toHaveLength(1);
      expect(logsEMP002[0].subject).toBe("Task Verified");
      expect(logsEMP002[0].body).toContain("Fix Bug #42");
      expect(logsEMP002[0].body).toContain("approved");
    });

    it("should notify ALL assignees when task is rejected", () => {
      const state = useTasksStore.getState();

      const taskId = useTasksStore.getState().addTask({
        title: "Update Dashboard",
        description: "Refresh the dashboard UI",
        assignedTo: ["EMP-002"],
        priority: "medium",
        status: "open",
        createdBy: "EMP-001",
        groupId: "GRP-001",
        completionRequired: true,
      });

      // Clear addTask notifications
      resetStore();
      mockFetch.mockClear();

      const reportId = useTasksStore.getState().submitCompletion({
        taskId,
        employeeId: "EMP-002",
        notes: "Updated the dashboard",
      });

      useTasksStore.getState().rejectCompletion(reportId, "Missing responsive design");

      const logs = getLogsForEmployee("EMP-002");
      expect(logs).toHaveLength(1);
      expect(logs[0].subject).toBe("Task Rejected");
      expect(logs[0].body).toContain("Update Dashboard");
      expect(logs[0].body).toContain("Missing responsive design");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Overtime — Notification to Admins/Supervisors
  // ─────────────────────────────────────────────────────────────
  describe("Overtime Store — Admin/Supervisor Notification", () => {
    let useAttendanceStore: typeof import("@/store/attendance.store").useAttendanceStore;

    beforeEach(async () => {
      const attendanceModule = await import("@/store/attendance.store");
      useAttendanceStore = attendanceModule.useAttendanceStore;
    });

    it("should notify all admins, supervisors, and HR (not the requester)", () => {
      const { submitOvertimeRequest } = useAttendanceStore.getState();

      submitOvertimeRequest({
        employeeId: "EMP-002", // Bob (employee) submits
        date: "2026-04-15",
        hoursRequested: 2,
        reason: "Urgent deadline",
      });

      // Admin (EMP-001), HR (EMP-003), Supervisor (EMP-005) should be notified
      const adminLogs = getLogsForEmployee("EMP-001");
      const hrLogs = getLogsForEmployee("EMP-003");
      const supervisorLogs = getLogsForEmployee("EMP-005");

      expect(adminLogs.length).toBeGreaterThanOrEqual(1);
      expect(hrLogs.length).toBeGreaterThanOrEqual(1);
      expect(supervisorLogs.length).toBeGreaterThanOrEqual(1);

      // Employee (requester) should NOT get a notification about their own OT request
      const requesterLogs = getLogsForEmployee("EMP-002")
        .filter((l) => l.type === "overtime_submitted");
      expect(requesterLogs).toHaveLength(0);

      // Finance (EMP-004) should NOT get OT notifications
      const financeLogs = getLogsForEmployee("EMP-004")
        .filter((l) => l.type === "overtime_submitted");
      expect(financeLogs).toHaveLength(0);

      // Verify format
      expect(adminLogs[0].subject).toBe("Overtime Request: Bob Employee");
      expect(adminLogs[0].body).toContain("Bob Employee");
      expect(adminLogs[0].body).toContain("2026-04-15");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6b. Leave Store — leave_submitted Notification
  // ─────────────────────────────────────────────────────────────
  describe("Leave Store — leave_submitted Notification to Admin/HR", () => {
    let useLeaveStore: typeof import("@/store/leave.store").useLeaveStore;

    beforeEach(async () => {
      const leaveModule = await import("@/store/leave.store");
      useLeaveStore = leaveModule.useLeaveStore;
    });

    it("should notify admin and HR when employee submits leave", () => {
      const { addRequest } = useLeaveStore.getState();

      addRequest({
        employeeId: "EMP-002", // Bob (employee) submits
        type: "VL",
        startDate: "2026-04-20",
        endDate: "2026-04-22",
        reason: "Family vacation",
        duration: "full_day",
      });

      // Admin (EMP-001) should be notified
      const adminLogs = getLogsForEmployee("EMP-001").filter((l) => l.type === "leave_submitted");
      expect(adminLogs).toHaveLength(1);
      expect(adminLogs[0].subject).toContain("Bob Employee");
      expect(adminLogs[0].body).toContain("Bob Employee");
      expect(adminLogs[0].body).toContain("VL");

      // HR (EMP-003) should be notified
      const hrLogs = getLogsForEmployee("EMP-003").filter((l) => l.type === "leave_submitted");
      expect(hrLogs).toHaveLength(1);

      // The requester (EMP-002) should NOT get their own leave_submitted notification
      const requesterLogs = getLogsForEmployee("EMP-002").filter((l) => l.type === "leave_submitted");
      expect(requesterLogs).toHaveLength(0);

      // Finance/Supervisor should NOT get leave_submitted
      const financeLogs = getLogsForEmployee("EMP-004").filter((l) => l.type === "leave_submitted");
      expect(financeLogs).toHaveLength(0);
    });

    it("should include leave dates in notification body", () => {
      const { addRequest } = useLeaveStore.getState();

      addRequest({
        employeeId: "EMP-006",
        type: "SL",
        startDate: "2026-04-18",
        endDate: "2026-04-18",
        reason: "Not feeling well",
        duration: "full_day",
      });

      const adminLogs = getLogsForEmployee("EMP-001").filter((l) => l.type === "leave_submitted");
      expect(adminLogs).toHaveLength(1);
      expect(adminLogs[0].body).toContain("2026-04-18");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Read Tracking — Per-Employee Isolation
  // ─────────────────────────────────────────────────────────────
  describe("Read Tracking — Per-Employee Isolation", () => {
    it("should only mark notifications as read for the specified employee", () => {
      const store = useNotificationsStore.getState();

      // Create notifications for two different employees
      store.addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "Bob's task", body: "B" });
      store.addLog({ employeeId: "EMP-006", type: "task_assigned", channel: "in_app", subject: "Frank's task", body: "F" });

      // Mark all as read for EMP-002
      useNotificationsStore.getState().markAllAsRead("EMP-002");

      const bobLogs = getLogsForEmployee("EMP-002");
      const frankLogs = getLogsForEmployee("EMP-006");

      // Bob's should be read
      expect(bobLogs.every((l) => l.read === true)).toBe(true);
      // Frank's should still be unread
      expect(frankLogs.every((l) => !l.read)).toBe(true);
    });

    it("should count unread only for the specified employee", () => {
      const store = useNotificationsStore.getState();

      store.addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "A", body: "B" });
      store.addLog({ employeeId: "EMP-002", type: "task_verified", channel: "in_app", subject: "C", body: "D" });
      store.addLog({ employeeId: "EMP-006", type: "task_assigned", channel: "in_app", subject: "E", body: "F" });

      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-002")).toBe(2);
      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-006")).toBe(1);
      // Non-existent employee
      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-999")).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Push Notification Payload Correctness
  // ─────────────────────────────────────────────────────────────
  describe("Push Notification — Payload Correctness", () => {
    it("should include employeeId, title, body, url, tag in push payload", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({
        employeeId: "EMP-002",
        type: "task_assigned",
        channel: "in_app",
        subject: "New Task",
        body: "You have a new task",
        link: "/tasks/TSK-100",
      });

      const push = getLastPushPayload();
      expect(push).toEqual(expect.objectContaining({
        employeeId: "EMP-002",
        title: "New Task",
        body: "You have a new task",
        url: "/employee/tasks/TSK-100",
      }));
      expect(push!.tag).toMatch(/^NOTIF-/);
    });

    it("should fire push for every dispatch() call", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch("payslip_published", { name: "Bob", period: "Apr 2026", amount: "₱20K" }, "EMP-002");
      dispatch("payment_confirmed", { name: "Frank", period: "Apr 2026", amount: "₱18K" }, "EMP-006");

      const pushPayloads = getAllPushPayloads();
      expect(pushPayloads).toHaveLength(2);
      expect(pushPayloads[0].employeeId).toBe("EMP-002");
      expect(pushPayloads[1].employeeId).toBe("EMP-006");
    });

    it("should fire push for every sendNotification() call", () => {
      sendNotification({
        type: "assignment",
        employeeId: "EMP-002",
        subject: "Project A",
        body: "Assigned to Project A",
      });
      sendNotification({
        type: "absence",
        employeeId: "EMP-006",
        subject: "Absent",
        body: "Marked absent",
      });

      const pushPayloads = getAllPushPayloads();
      expect(pushPayloads).toHaveLength(2);
      expect(pushPayloads[0].employeeId).toBe("EMP-002");
      expect(pushPayloads[1].employeeId).toBe("EMP-006");
    });

    it("should use role-prefixed URL for each employee role", () => {
      // Employee role
      sendNotification({ type: "task_assigned", employeeId: "EMP-002", subject: "T", body: "B", link: "/tasks/TSK-1" });
      // Admin role
      sendNotification({ type: "task_assigned", employeeId: "EMP-001", subject: "T", body: "B", link: "/tasks/TSK-2" });
      // HR role
      sendNotification({ type: "task_assigned", employeeId: "EMP-003", subject: "T", body: "B", link: "/tasks/TSK-3" });
      // Finance role
      sendNotification({ type: "task_assigned", employeeId: "EMP-004", subject: "T", body: "B", link: "/tasks/TSK-4" });
      // Supervisor role
      sendNotification({ type: "task_assigned", employeeId: "EMP-005", subject: "T", body: "B", link: "/tasks/TSK-5" });

      const pushPayloads = getAllPushPayloads();
      expect(pushPayloads[0].url).toBe("/employee/tasks/TSK-1");
      expect(pushPayloads[1].url).toBe("/admin/tasks/TSK-2");
      expect(pushPayloads[2].url).toBe("/hr/tasks/TSK-3");
      expect(pushPayloads[3].url).toBe("/finance/tasks/TSK-4");
      expect(pushPayloads[4].url).toBe("/supervisor/tasks/TSK-5");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Template Rendering Edge Cases
  // ─────────────────────────────────────────────────────────────
  describe("Template Rendering — Edge Cases", () => {
    it("should leave unreplaced placeholders as literal {key} when var missing", () => {
      const { dispatch } = useNotificationsStore.getState();

      // Only provide "name", omit "period" and "amount"
      dispatch("payslip_published", { name: "Bob" }, "EMP-002");

      const log = getLatestLog();
      expect(log.subject).toBe("Payslip Ready: {period}");
      expect(log.body).toContain("{period}");
      expect(log.body).toContain("{amount}");
    });

    it("should handle special characters in template variables", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch(
        "payslip_published",
        { name: "José María O'Brien", period: "Apr 1–15, 2026", amount: "₱50,000.00" },
        "EMP-002"
      );

      const log = getLatestLog();
      // channel=both uses smsTemplate: "Your payslip for {period} is ready. Net: {amount}."
      expect(log.body).toContain("Apr 1–15, 2026");
      expect(log.body).toContain("₱50,000.00");
    });

    it("should handle special characters in email-channel templates", () => {
      const { dispatch } = useNotificationsStore.getState();

      // leave_rejected uses channel=both WITHOUT smsTemplate, so bodyTemplate (with {name}) is used
      dispatch(
        "leave_rejected",
        { name: "José María O'Brien", leaveType: "VL", dates: "2026-04-20" },
        "EMP-002"
      );

      const log = getLatestLog();
      expect(log.body).toContain("José María O'Brien");
    });

    it("should handle empty string variables", () => {
      const { dispatch } = useNotificationsStore.getState();

      dispatch("payslip_published", { name: "", period: "", amount: "" }, "EMP-002");

      const log = getLatestLog();
      // Should not crash, just empty replacements
      expect(log.subject).toBe("Payslip Ready: ");
      // channel=both uses smsTemplate: "Your payslip for {period} is ready. Net: {amount}."
      expect(log.body).toContain("Your payslip for  is ready.");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. Cross-Contamination Prevention
  // ─────────────────────────────────────────────────────────────
  describe("Cross-Contamination Prevention — Multi-User Scenarios", () => {
    it("should not leak notifications between employees in batch payslip publish", () => {
      const { dispatch } = useNotificationsStore.getState();

      // Simulate bulk payslip publish for 3 employees
      const payslips = [
        { employeeId: "EMP-002", name: "Bob Employee", period: "Apr 2026", amount: "₱20,000" },
        { employeeId: "EMP-006", name: "Frank Employee", period: "Apr 2026", amount: "₱18,000" },
        { employeeId: "EMP-001", name: "Alice Admin", period: "Apr 2026", amount: "₱40,000" },
      ];

      payslips.forEach((ps) => {
        dispatch("payslip_published", { name: ps.name, period: ps.period, amount: ps.amount }, ps.employeeId);
      });

      // Each employee should have exactly 1 payslip notification
      expect(getLogsForEmployee("EMP-002").filter((l) => l.type === "payslip_published")).toHaveLength(1);
      expect(getLogsForEmployee("EMP-006").filter((l) => l.type === "payslip_published")).toHaveLength(1);
      expect(getLogsForEmployee("EMP-001").filter((l) => l.type === "payslip_published")).toHaveLength(1);

      // Bob should NOT see Alice's or Frank's payslip amounts
      const bobLog = getLogsForEmployee("EMP-002")[0];
      // channel=both uses smsTemplate (no name), but amount is unique per employee
      expect(bobLog.body).toContain("₱20,000");
      expect(bobLog.body).not.toContain("₱18,000");
      expect(bobLog.body).not.toContain("₱40,000");
      // Verify subjects are personalized per employee
      const frankLog = getLogsForEmployee("EMP-006")[0];
      const aliceLog = getLogsForEmployee("EMP-001")[0];
      expect(bobLog.subject).toBe("Payslip Ready: Apr 2026");
      expect(frankLog.body).toContain("₱18,000");
      expect(aliceLog.body).toContain("₱40,000");
    });

    it("should not leak notifications between task assignees with different tasks", () => {
      const { addLog } = useNotificationsStore.getState();

      // Task 1: Only for EMP-002
      addLog({
        employeeId: "EMP-002",
        type: "task_assigned",
        channel: "in_app",
        subject: "Task: Secret Project",
        body: "You are assigned to Secret Project",
        link: "/tasks/TSK-SECRET",
      });

      // Task 2: Only for EMP-006
      addLog({
        employeeId: "EMP-006",
        type: "task_assigned",
        channel: "in_app",
        subject: "Task: Public Project",
        body: "You are assigned to Public Project",
        link: "/tasks/TSK-PUBLIC",
      });

      // EMP-002 should only see Secret Project
      const bobLogs = getLogsForEmployee("EMP-002");
      expect(bobLogs).toHaveLength(1);
      expect(bobLogs[0].subject).toBe("Task: Secret Project");

      // EMP-006 should only see Public Project
      const frankLogs = getLogsForEmployee("EMP-006");
      expect(frankLogs).toHaveLength(1);
      expect(frankLogs[0].subject).toBe("Task: Public Project");
    });

    it("should correctly isolate unread counts per employee after mixed operations", () => {
      const store = useNotificationsStore.getState();

      // Create 3 notifications for EMP-002 and 2 for EMP-006
      store.addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "A", body: "B" });
      store.addLog({ employeeId: "EMP-002", type: "task_verified", channel: "in_app", subject: "C", body: "D" });
      store.addLog({ employeeId: "EMP-002", type: "task_rejected", channel: "in_app", subject: "E", body: "F" });
      store.addLog({ employeeId: "EMP-006", type: "task_assigned", channel: "in_app", subject: "G", body: "H" });
      store.addLog({ employeeId: "EMP-006", type: "task_assigned", channel: "in_app", subject: "I", body: "J" });

      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-002")).toBe(3);
      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-006")).toBe(2);

      // Read one of EMP-002's notifications (get a specific unique ID)
      const bobLogs = getLogsForEmployee("EMP-002");
      const bobId = bobLogs[0].id;
      // Verify we have different IDs per notification (nanoid mock increments)
      expect(new Set(bobLogs.map((l) => l.id)).size).toBe(3);

      useNotificationsStore.getState().markAsRead(bobId);

      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-002")).toBe(2);
      expect(useNotificationsStore.getState().getUnreadCountForEmployee("EMP-006")).toBe(2); // unchanged
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Rule/Trigger Coverage Map
  // ─────────────────────────────────────────────────────────────
  describe("Rule Configuration — All Triggers Mapped", () => {
    it("should have a rule for every implemented notification type", () => {
      const rules = useNotificationsStore.getState().rules;

      const implementedTriggers = [
        "payslip_published", "payslip_signed", "payslip_unsigned_reminder",
        "payment_confirmed", "leave_submitted", "leave_approved", "leave_rejected",
        "attendance_missing", "geofence_violation", "location_disabled",
        "loan_reminder", "overtime_submitted", "birthday", "contract_expiry",
        "daily_summary",
      ];

      implementedTriggers.forEach((trigger) => {
        const rule = rules.find((r) => r.trigger === trigger);
        expect(rule).toBeDefined();
        expect(rule!.subjectTemplate).toBeTruthy();
        expect(rule!.bodyTemplate).toBeTruthy();
      });
    });

    it("should default all rules to enabled (except daily_summary)", () => {
      const rules = useNotificationsStore.getState().rules;

      rules.forEach((rule) => {
        if (rule.trigger === "daily_summary") {
          expect(rule.enabled).toBe(false);
        } else {
          expect(rule.enabled).toBe(true);
        }
      });
    });

    it("should have correct auto-link mapping for all notification types", () => {
      const { dispatch } = useNotificationsStore.getState();

      // Test a selection of type → link mappings
      const testCases: [string, Record<string, string>, string][] = [
        ["leave_approved", { name: "B", leaveType: "VL", dates: "2026-04-20", status: "approved" }, "/leave"],
        ["leave_rejected", { name: "B", leaveType: "VL", dates: "2026-04-20", status: "rejected" }, "/leave"],
        ["payslip_published", { name: "B", period: "Apr", amount: "₱1" }, "/payroll"],
        ["payment_confirmed", { name: "B", period: "Apr", amount: "₱1" }, "/payroll"],
        ["overtime_submitted", { name: "B", date: "2026-04-15" }, "/attendance"],
        ["geofence_violation", { name: "B", time: "10:00", distance: "100" }, "/attendance"],
      ];

      testCases.forEach(([trigger, vars, expectedLink]) => {
        resetStore();
        dispatch(trigger as Parameters<typeof dispatch>[0], vars, "EMP-002");
        const log = getLatestLog();
        expect(log.link).toBe(expectedLink);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 12. Store Capacity & Ordering
  // ─────────────────────────────────────────────────────────────
  describe("Store Capacity & Ordering", () => {
    it("should cap logs at 500 entries (newest first)", () => {
      const { addLog } = useNotificationsStore.getState();

      for (let i = 0; i < 510; i++) {
        addLog({
          employeeId: "EMP-002",
          type: "task_assigned",
          channel: "in_app",
          subject: `Task #${i}`,
          body: `Body #${i}`,
        });
      }

      const logs = useNotificationsStore.getState().logs;
      expect(logs.length).toBeLessThanOrEqual(500);
      // Newest should be first
      expect(logs[0].subject).toBe("Task #509");
    });

    it("should order notifications newest-first (prepend)", () => {
      const { addLog } = useNotificationsStore.getState();

      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "First", body: "1" });
      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "Second", body: "2" });
      addLog({ employeeId: "EMP-002", type: "task_assigned", channel: "in_app", subject: "Third", body: "3" });

      const logs = useNotificationsStore.getState().logs;
      expect(logs[0].subject).toBe("Third");
      expect(logs[1].subject).toBe("Second");
      expect(logs[2].subject).toBe("First");
    });
  });
});

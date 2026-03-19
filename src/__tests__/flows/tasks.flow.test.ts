/**
 * Integration flow: Task assignment → completion → verification
 *
 * Simulates the real-world sequence:
 *   1. Admin creates a group and a task, assigns to employee(s)
 *   2. Assigned employee(s) can see the task via getTasksForEmployee
 *   3. Employee starts the task (changeStatus → in_progress)
 *   4. Employee submits completion (with optional proof)
 *   5. Admin verifies → status=verified, audit + notification chain fires
 *   6. Admin can also reject → notification dispatched, reject reason stored
 *   7. Multi-assignee: all assignees receive task_assigned notifications
 */
import { useTasksStore } from "@/store/tasks.store";
import { useAuditStore } from "@/store/audit.store";
import { useNotificationsStore } from "@/store/notifications.store";
import type { Task, TaskGroup } from "@/types";

const ADMIN_ID = "ADMIN-FLOW-001";
const EMP_A = "EMP-FLOW-A";
const EMP_B = "EMP-FLOW-B";
const EMP_C = "EMP-FLOW-C";

const BASE_GROUP: Omit<TaskGroup, "id" | "createdAt"> = {
    name: "Flow Test Group",
    description: "Group used in flow tests",
    memberEmployeeIds: [EMP_A, EMP_B, EMP_C],
    createdBy: ADMIN_ID,
    announcementPermission: "admin_only",
};

const resetStores = () => {
    useTasksStore.setState({ groups: [], tasks: [], completionReports: [], comments: [] });
    useAuditStore.setState({ logs: [] });
    useNotificationsStore.setState({ logs: [] });
};

beforeEach(resetStores);

// ─── Scenario 1: Assignment visibility ───────────────────────

describe("Task assignment visibility", () => {
    it("employee sees only tasks assigned to them", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({
            groupId,
            title: "Task for A",
            description: "",
            assignedTo: [EMP_A],
            priority: "medium",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });
        useTasksStore.getState().addTask({
            groupId,
            title: "Task for B",
            description: "",
            assignedTo: [EMP_B],
            priority: "low",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });

        expect(useTasksStore.getState().getTasksForEmployee(EMP_A)).toHaveLength(1);
        expect(useTasksStore.getState().getTasksForEmployee(EMP_A)[0].title).toBe("Task for A");
        expect(useTasksStore.getState().getTasksForEmployee(EMP_B)).toHaveLength(1);
        expect(useTasksStore.getState().getTasksForEmployee(EMP_C)).toHaveLength(0);
    });

    it("dispatches task_assigned notification to each assignee on creation", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({
            groupId,
            title: "Multi-assignee Task",
            description: "",
            assignedTo: [EMP_A, EMP_B, EMP_C],
            priority: "high",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });

        const notifs = useNotificationsStore.getState().logs.filter((n) => n.type === "task_assigned");
        expect(notifs).toHaveLength(3);
        const recipients = notifs.map((n) => n.employeeId).sort();
        expect(recipients).toEqual([EMP_A, EMP_B, EMP_C].sort());
    });
});

// ─── Scenario 2: Full verify flow ────────────────────────────

describe("Full task lifecycle — open → in_progress → submitted → verified", () => {
    let taskId: string;
    let groupId: string;

    beforeEach(() => {
        groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        taskId = useTasksStore.getState().addTask({
            groupId,
            title: "Deploy hotfix",
            description: "Push the patch to production",
            assignedTo: [EMP_A],
            priority: "critical",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: true,
        });
    });

    it("status starts as open", () => {
        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("open");
    });

    it("employee progresses task to in_progress", () => {
        useTasksStore.getState().changeStatus(taskId, "in_progress");
        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("in_progress");
    });

    it("employee submits completion → status becomes submitted and report is created", () => {
        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({
            taskId,
            employeeId: EMP_A,
            notes: "Hotfix deployed successfully.",
            photoDataUrl: "data:image/png;base64,proof",
            latitude: 14.5995,
            longitude: 120.9842,
        });

        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("submitted");

        const report = useTasksStore.getState().getCompletionReport(taskId)!;
        expect(report).toBeDefined();
        expect(report.employeeId).toBe(EMP_A);
        expect(report.notes).toBe("Hotfix deployed successfully.");
        expect(report.photoDataUrl).toBe("data:image/png;base64,proof");
        expect(report.latitude).toBe(14.5995);
        expect(report.longitude).toBe(120.9842);
    });

    it("admin verifies submission → status becomes verified, notification sent to assignee", () => {
        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_A, notes: "Done." });
        const report = useTasksStore.getState().getCompletionReport(taskId)!;

        useTasksStore.getState().verifyCompletion(report.id, ADMIN_ID);

        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("verified");

        const verifyNotifs = useNotificationsStore.getState().logs.filter((n) => n.type === "task_verified");
        expect(verifyNotifs).toHaveLength(1);
        expect(verifyNotifs[0].employeeId).toBe(EMP_A);
    });

    it("full chain produces an audit trail with at least 3 entries for the task", () => {
        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_A, notes: "Done." });
        const report = useTasksStore.getState().getCompletionReport(taskId)!;
        useTasksStore.getState().verifyCompletion(report.id, ADMIN_ID);

        const taskAudit = useAuditStore.getState().logs.filter((l) => l.entityId === taskId);
        expect(taskAudit.length).toBeGreaterThanOrEqual(3);
    });
});

// ─── Scenario 3: Reject flow ─────────────────────────────────

describe("Task rejection and resubmission flow", () => {
    it("admin rejects → task_rejected notification sent, reason stored", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        const taskId = useTasksStore.getState().addTask({
            groupId,
            title: "Write report",
            description: "",
            assignedTo: [EMP_B],
            priority: "medium",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: true,
        });

        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_B, notes: "Draft version." });
        const report = useTasksStore.getState().getCompletionReport(taskId)!;

        useTasksStore.getState().rejectCompletion(report.id, "Missing executive summary");

        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("rejected");

        const rejectedReport = useTasksStore.getState().getCompletionReport(taskId)!;
        expect(rejectedReport.rejectionReason).toBe("Missing executive summary");

        const rejNotifs = useNotificationsStore.getState().logs.filter((n) => n.type === "task_rejected");
        expect(rejNotifs).toHaveLength(1);
        expect(rejNotifs[0].employeeId).toBe(EMP_B);
    });

    it("employee can resubmit after rejection", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        const taskId = useTasksStore.getState().addTask({
            groupId,
            title: "Write report",
            description: "",
            assignedTo: [EMP_B],
            priority: "medium",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: true,
        });

        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_B, notes: "First attempt." });
        const report = useTasksStore.getState().getCompletionReport(taskId)!;
        useTasksStore.getState().rejectCompletion(report.id, "Needs revision");

        // Re-open and resubmit
        useTasksStore.getState().changeStatus(taskId, "open");
        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_B, notes: "Revised version." });

        expect(useTasksStore.getState().getTaskById(taskId)?.status).toBe("submitted");
    });
});

// ─── Scenario 4: Multi-assignee visibility ───────────────────

describe("Multi-assignee task", () => {
    it("all 3 assignees see the task via getTasksForEmployee", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({
            groupId,
            title: "Shared deliverable",
            description: "",
            assignedTo: [EMP_A, EMP_B, EMP_C],
            priority: "high",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });

        expect(useTasksStore.getState().getTasksForEmployee(EMP_A)).toHaveLength(1);
        expect(useTasksStore.getState().getTasksForEmployee(EMP_B)).toHaveLength(1);
        expect(useTasksStore.getState().getTasksForEmployee(EMP_C)).toHaveLength(1);
    });

    it("unassigned employee sees zero tasks", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({
            groupId,
            title: "Team task",
            description: "",
            assignedTo: [EMP_A, EMP_B],
            priority: "medium",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });

        expect(useTasksStore.getState().getTasksForEmployee(EMP_C)).toHaveLength(0);
        expect(useTasksStore.getState().getTasksForEmployee("EMP-STRANGER")).toHaveLength(0);
    });
});

// ─── Scenario 5: Admin CRUD (edit + delete) ──────────────────

describe("Admin task management — update and delete", () => {
    it("updateTask patches fields and admin can see updated values", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        const taskId = useTasksStore.getState().addTask({
            groupId,
            title: "Old title",
            description: "Old desc",
            assignedTo: [EMP_A],
            priority: "low",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2050-01-01",
            completionRequired: false,
        });

        useTasksStore.getState().updateTask(taskId, {
            title: "Updated title",
            priority: "critical",
            dueDate: "2060-06-30",
            assignedTo: [EMP_A, EMP_B],
        });

        const task = useTasksStore.getState().getTaskById(taskId)!;
        expect(task.title).toBe("Updated title");
        expect(task.priority).toBe("critical");
        expect(task.dueDate).toBe("2060-06-30");
        expect(task.assignedTo).toEqual([EMP_A, EMP_B]);
    });

    it("deleteTask removes task and its completion reports and comments", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        const taskId = useTasksStore.getState().addTask({
            groupId,
            title: "Temporary task",
            description: "",
            assignedTo: [EMP_A],
            priority: "low",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: true,
        });

        useTasksStore.getState().changeStatus(taskId, "in_progress");
        useTasksStore.getState().submitCompletion({ taskId, employeeId: EMP_A, notes: "done" });
        useTasksStore.getState().addComment({ taskId, employeeId: EMP_A, message: "Done" });

        useTasksStore.getState().deleteTask(taskId);

        expect(useTasksStore.getState().getTaskById(taskId)).toBeUndefined();
        expect(useTasksStore.getState().getCompletionReport(taskId)).toBeUndefined();
        expect(useTasksStore.getState().getComments(taskId)).toHaveLength(0);
    });

    it("deleteGroup removes the group and cascades to all its tasks", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({
            groupId,
            title: "Task In Group",
            description: "",
            assignedTo: [EMP_A],
            priority: "medium",
            status: "open",
            createdBy: ADMIN_ID,
            dueDate: "2099-12-31",
            completionRequired: false,
        });

        useTasksStore.getState().deleteGroup(groupId);

        expect(useTasksStore.getState().getGroupById(groupId)).toBeUndefined();
        expect(useTasksStore.getState().getTasksForEmployee(EMP_A)).toHaveLength(0);
    });
});

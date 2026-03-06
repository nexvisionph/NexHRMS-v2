/**
 * Unit tests for the Tasks store
 */
import { useTasksStore } from "@/store/tasks.store";
import { useAuditStore } from "@/store/audit.store";
import { useNotificationsStore } from "@/store/notifications.store";
import type { Task, TaskGroup } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────

const BASE_GROUP: Omit<TaskGroup, "id" | "createdAt"> = {
    name: "Test Group",
    description: "A test task group",
    memberEmployeeIds: ["EMP-001", "EMP-002"],
    createdBy: "ADMIN-001",
    announcementPermission: "admin_only",
};

const BASE_TASK: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
    groupId: "TG-TEST",
    title: "Fix the bug",
    description: "Investigate and fix the production bug",
    assignedTo: ["EMP-001"],
    priority: "high",
    status: "open",
    createdBy: "ADMIN-001",
    dueDate: "2099-12-31",
    completionRequired: false,
};

const resetStores = () => {
    useTasksStore.setState({ groups: [], tasks: [], completionReports: [], comments: [] });
    useAuditStore.setState({ logs: [] });
    useNotificationsStore.setState({ logs: [] });
};

beforeEach(resetStores);

// ─── Task Group CRUD ──────────────────────────────────────────

describe("Tasks Store — addGroup", () => {
    it("creates a group with TG- prefix id", () => {
        const id = useTasksStore.getState().addGroup(BASE_GROUP);
        expect(id).toMatch(/^TG-/);
        expect(useTasksStore.getState().groups).toHaveLength(1);
    });

    it("sets createdAt as ISO string", () => {
        const id = useTasksStore.getState().addGroup(BASE_GROUP);
        const group = useTasksStore.getState().groups.find((g) => g.id === id)!;
        expect(() => new Date(group.createdAt)).not.toThrow();
    });

    it("preserves all provided fields", () => {
        const id = useTasksStore.getState().addGroup(BASE_GROUP);
        const group = useTasksStore.getState().groups.find((g) => g.id === id)!;
        expect(group.name).toBe("Test Group");
        expect(group.memberEmployeeIds).toEqual(["EMP-001", "EMP-002"]);
        expect(group.createdBy).toBe("ADMIN-001");
    });
});

describe("Tasks Store — updateGroup", () => {
    it("patches group fields", () => {
        const id = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().updateGroup(id, { name: "Updated Group" });
        const group = useTasksStore.getState().groups.find((g) => g.id === id)!;
        expect(group.name).toBe("Updated Group");
    });
});

describe("Tasks Store — deleteGroup", () => {
    it("removes the group", () => {
        const id = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().deleteGroup(id);
        expect(useTasksStore.getState().groups).toHaveLength(0);
    });

    it("cascades deletion to tasks in that group", () => {
        const groupId = useTasksStore.getState().addGroup(BASE_GROUP);
        useTasksStore.getState().addTask({ ...BASE_TASK, groupId });
        expect(useTasksStore.getState().tasks).toHaveLength(1);
        useTasksStore.getState().deleteGroup(groupId);
        expect(useTasksStore.getState().tasks).toHaveLength(0);
    });
});

// ─── Task CRUD  ───────────────────────────────────────────────

describe("Tasks Store — addTask", () => {
    it("creates a task with TSK- prefix id", () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        expect(id).toMatch(/^TSK-/);
        expect(useTasksStore.getState().tasks).toHaveLength(1);
    });

    it("sets createdAt and updatedAt as ISO strings", () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
        expect(() => new Date(task.createdAt)).not.toThrow();
        expect(() => new Date(task.updatedAt)).not.toThrow();
    });

    it("preserves all provided fields", () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
        expect(task.title).toBe("Fix the bug");
        expect(task.status).toBe("open");
        expect(task.priority).toBe("high");
        expect(task.assignedTo).toEqual(["EMP-001"]);
    });

    it("writes a task_created audit log entry", () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === id && l.action === "task_created")).toBe(true);
    });

    it("dispatches task_assigned notification to each assignee", () => {
        useTasksStore.getState().addTask({
            ...BASE_TASK,
            assignedTo: ["EMP-001", "EMP-002"],
        });
        const notifLogs = useNotificationsStore.getState().logs;
        const empIds = notifLogs.filter((n) => n.type === "task_assigned").map((n) => n.employeeId);
        expect(empIds).toContain("EMP-001");
        expect(empIds).toContain("EMP-002");
    });
});

describe("Tasks Store — updateTask", () => {
    it("patches task fields and bumps updatedAt", async () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        const before = useTasksStore.getState().tasks.find((t) => t.id === id)!.updatedAt;
        await new Promise((r) => setTimeout(r, 2));
        useTasksStore.getState().updateTask(id, { title: "Fixed the bug" });
        const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
        expect(task.title).toBe("Fixed the bug");
        expect(task.updatedAt >= before).toBe(true);
    });
});

describe("Tasks Store — deleteTask", () => {
    it("removes the task", () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().deleteTask(id);
        expect(useTasksStore.getState().tasks).toHaveLength(0);
    });

    it("cascades deletion to related completion reports and comments", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().submitCompletion({
            taskId,
            employeeId: "EMP-001",
            notes: "Done",
        });
        useTasksStore.getState().addComment({ taskId, employeeId: "EMP-001", message: "Looking good" });
        expect(useTasksStore.getState().completionReports).toHaveLength(1);
        expect(useTasksStore.getState().comments).toHaveLength(1);
        useTasksStore.getState().deleteTask(taskId);
        expect(useTasksStore.getState().completionReports).toHaveLength(0);
        expect(useTasksStore.getState().comments).toHaveLength(0);
    });
});

describe("Tasks Store — changeStatus", () => {
    it("updates status and bumps updatedAt", async () => {
        const id = useTasksStore.getState().addTask(BASE_TASK);
        await new Promise((r) => setTimeout(r, 2));
        useTasksStore.getState().changeStatus(id, "in_progress");
        const task = useTasksStore.getState().tasks.find((t) => t.id === id)!;
        expect(task.status).toBe("in_progress");
    });
});

// ─── Completion Workflow ──────────────────────────────────────

describe("Tasks Store — submitCompletion", () => {
    it("creates a report with TCR- prefix id", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId,
            employeeId: "EMP-001",
            notes: "All done",
        });
        expect(reportId).toMatch(/^TCR-/);
        expect(useTasksStore.getState().completionReports).toHaveLength(1);
    });

    it("sets task status to submitted", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().submitCompletion({
            taskId,
            employeeId: "EMP-001",
            notes: "Done",
        });
        const task = useTasksStore.getState().tasks.find((t) => t.id === taskId)!;
        expect(task.status).toBe("submitted");
    });

    it("writes a task_completed audit log entry", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        useAuditStore.setState({ logs: [] }); // clear addTask's log
        useTasksStore.getState().submitCompletion({
            taskId,
            employeeId: "EMP-001",
            notes: "Done",
        });
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === taskId && l.action === "task_completed")).toBe(true);
    });
});

describe("Tasks Store — verifyCompletion", () => {
    it("sets task status to verified", () => {
        const taskId = useTasksStore.getState().addTask({ ...BASE_TASK, assignedTo: ["EMP-001"] });
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useTasksStore.getState().verifyCompletion(reportId, "ADMIN-001");
        const task = useTasksStore.getState().tasks.find((t) => t.id === taskId)!;
        expect(task.status).toBe("verified");
    });

    it("sets verifiedBy and verifiedAt on the report", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useTasksStore.getState().verifyCompletion(reportId, "ADMIN-001");
        const report = useTasksStore.getState().completionReports.find((r) => r.id === reportId)!;
        expect(report.verifiedBy).toBe("ADMIN-001");
        expect(report.verifiedAt).toBeDefined();
    });

    it("writes a task_verified audit log entry", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useAuditStore.setState({ logs: [] });
        useTasksStore.getState().verifyCompletion(reportId, "ADMIN-001");
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === taskId && l.action === "task_verified")).toBe(true);
    });

    it("dispatches task_verified notification to assignees", () => {
        const taskId = useTasksStore.getState().addTask({ ...BASE_TASK, assignedTo: ["EMP-001"] });
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useNotificationsStore.setState({ logs: [] });
        useTasksStore.getState().verifyCompletion(reportId, "ADMIN-001");
        const notifs = useNotificationsStore.getState().logs;
        expect(notifs.some((n) => n.type === "task_verified" && n.employeeId === "EMP-001")).toBe(true);
    });

    it("does nothing if reportId does not exist", () => {
        useTasksStore.getState().addTask(BASE_TASK);
        expect(() => useTasksStore.getState().verifyCompletion("NONEXISTENT", "ADMIN-001")).not.toThrow();
    });
});

describe("Tasks Store — rejectCompletion", () => {
    it("sets task status to rejected", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useTasksStore.getState().rejectCompletion(reportId, "Incomplete work");
        const task = useTasksStore.getState().tasks.find((t) => t.id === taskId)!;
        expect(task.status).toBe("rejected");
    });

    it("records rejection reason on the report", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useTasksStore.getState().rejectCompletion(reportId, "Incomplete work");
        const report = useTasksStore.getState().completionReports.find((r) => r.id === reportId)!;
        expect(report.rejectionReason).toBe("Incomplete work");
    });

    it("writes a task_rejected audit log entry", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useAuditStore.setState({ logs: [] });
        useTasksStore.getState().rejectCompletion(reportId, "Incomplete work");
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === taskId && l.action === "task_rejected")).toBe(true);
    });

    it("dispatches task_rejected notification to assignees", () => {
        const taskId = useTasksStore.getState().addTask({ ...BASE_TASK, assignedTo: ["EMP-001"] });
        const reportId = useTasksStore.getState().submitCompletion({
            taskId, employeeId: "EMP-001", notes: "Done",
        });
        useNotificationsStore.setState({ logs: [] });
        useTasksStore.getState().rejectCompletion(reportId, "Incomplete");
        const notifs = useNotificationsStore.getState().logs;
        expect(notifs.some((n) => n.type === "task_rejected" && n.employeeId === "EMP-001")).toBe(true);
    });
});

// ─── Comments ─────────────────────────────────────────────────

describe("Tasks Store — addComment", () => {
    it("creates a comment with TC- prefix id", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        const cId = useTasksStore.getState().addComment({ taskId, employeeId: "EMP-001", message: "Looks good" });
        expect(cId).toMatch(/^TC-/);
    });
});

// ─── Selectors ────────────────────────────────────────────────

describe("Tasks Store — getTasksByGroup", () => {
    it("returns only tasks belonging to the given group", () => {
        useTasksStore.getState().addTask({ ...BASE_TASK, groupId: "TG-A" });
        useTasksStore.getState().addTask({ ...BASE_TASK, groupId: "TG-B" });
        const result = useTasksStore.getState().getTasksByGroup("TG-A");
        expect(result).toHaveLength(1);
        expect(result[0].groupId).toBe("TG-A");
    });
});

describe("Tasks Store — getTasksForEmployee", () => {
    it("returns tasks assigned to the given employee", () => {
        useTasksStore.getState().addTask({ ...BASE_TASK, assignedTo: ["EMP-001"] });
        useTasksStore.getState().addTask({ ...BASE_TASK, assignedTo: ["EMP-002"] });
        const result = useTasksStore.getState().getTasksForEmployee("EMP-001");
        expect(result).toHaveLength(1);
        expect(result[0].assignedTo).toContain("EMP-001");
    });
});

describe("Tasks Store — getCompletionReport", () => {
    it("returns the report for a given taskId", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().submitCompletion({ taskId, employeeId: "EMP-001", notes: "Done" });
        const report = useTasksStore.getState().getCompletionReport(taskId);
        expect(report).toBeDefined();
        expect(report!.taskId).toBe(taskId);
    });

    it("returns undefined when no report exists", () => {
        expect(useTasksStore.getState().getCompletionReport("NONEXISTENT")).toBeUndefined();
    });
});

describe("Tasks Store — getComments", () => {
    it("returns comments for the given task", () => {
        const taskId = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().addComment({ taskId, employeeId: "EMP-001", message: "Comment 1" });
        useTasksStore.getState().addComment({ taskId, employeeId: "EMP-002", message: "Comment 2" });
        const result = useTasksStore.getState().getComments(taskId);
        expect(result).toHaveLength(2);
    });
});

describe("Tasks Store — getStats", () => {
    it("counts tasks by status correctly", () => {
        const t1 = useTasksStore.getState().addTask(BASE_TASK);
        const t2 = useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().changeStatus(t2, "in_progress");
        const stats = useTasksStore.getState().getStats();
        expect(stats.total).toBe(2);
        expect(stats.open).toBe(1);
        expect(stats.inProgress).toBe(1);
    });

    it("counts overdue tasks (past dueDate, non-verified/cancelled)", () => {
        useTasksStore.getState().addTask({ ...BASE_TASK, dueDate: "2000-01-01" }); // overdue
        useTasksStore.getState().addTask({ ...BASE_TASK, dueDate: "2099-12-31" }); // not overdue
        const stats = useTasksStore.getState().getStats();
        expect(stats.overdue).toBe(1);
    });
});

// ─── resetToSeed ─────────────────────────────────────────────

describe("Tasks Store — resetToSeed", () => {
    it("restores seed data and clears custom entries", () => {
        useTasksStore.getState().addTask(BASE_TASK);
        useTasksStore.getState().resetToSeed();
        const { groups, tasks } = useTasksStore.getState();
        // Seed data is non-empty
        expect(groups.length).toBeGreaterThan(0);
        expect(tasks.length).toBeGreaterThan(0);
    });
});

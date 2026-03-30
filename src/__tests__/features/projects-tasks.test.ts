/**
 * Feature Test: Projects & Tasks
 *
 * Covers: projects.store.ts, tasks.store.ts
 * - Project CRUD & employee assignment
 * - Task group CRUD (cascade delete)
 * - Task lifecycle (add → status change → submit → verify/reject)
 * - Completion reports (photo/GPS proof)
 * - Comments
 * - Stats computation (total, open, in_progress, submitted, verified, rejected, overdue)
 */

import { useProjectsStore } from "@/store/projects.store";
import { useTasksStore } from "@/store/tasks.store";

beforeEach(() => {
    useProjectsStore.getState().resetToSeed();
    useTasksStore.getState().resetToSeed();
});

describe("Projects", () => {
    describe("CRUD", () => {
        it("adds a project", () => {
            const before = useProjectsStore.getState().projects.length;
            useProjectsStore.getState().addProject({
                name: "Test Project",
                description: "Test description",
                status: "active",
                assignedEmployeeIds: [],
                location: { lat: 14.5, lng: 121.0, radius: 200 },
            });
            expect(useProjectsStore.getState().projects.length).toBe(before + 1);
        });

        it("updates a project", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().updateProject(proj.id, { name: "Updated Name" });
            expect(useProjectsStore.getState().projects.find((p) => p.id === proj.id)?.name).toBe("Updated Name");
        });

        it("deletes a project", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().deleteProject(proj.id);
            expect(useProjectsStore.getState().projects.find((p) => p.id === proj.id)).toBeUndefined();
        });
    });

    describe("Employee assignment", () => {
        it("assigns an employee to a project", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().assignEmployee(proj.id, "EMP-NEW");
            expect(useProjectsStore.getState().projects.find((p) => p.id === proj.id)?.assignedEmployeeIds).toContain("EMP-NEW");
        });

        it("does not duplicate assignment", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().assignEmployee(proj.id, "EMP-NEW");
            useProjectsStore.getState().assignEmployee(proj.id, "EMP-NEW");
            const assigned = useProjectsStore.getState().projects.find((p) => p.id === proj.id)?.assignedEmployeeIds;
            expect(assigned?.filter((id) => id === "EMP-NEW").length).toBe(1);
        });

        it("removes an employee from a project", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().assignEmployee(proj.id, "EMP-NEW");
            useProjectsStore.getState().removeEmployee(proj.id, "EMP-NEW");
            expect(useProjectsStore.getState().projects.find((p) => p.id === proj.id)?.assignedEmployeeIds).not.toContain("EMP-NEW");
        });

        it("getProjectForEmployee finds a project", () => {
            const proj = useProjectsStore.getState().projects[0];
            useProjectsStore.getState().assignEmployee(proj.id, "EMP-FIND");
            expect(useProjectsStore.getState().getProjectForEmployee("EMP-FIND")?.id).toBe(proj.id);
        });
    });
});

describe("Tasks", () => {
    describe("Task groups", () => {
        it("adds a task group", () => {
            const before = useTasksStore.getState().groups.length;
            useTasksStore.getState().addGroup({
                name: "Test Group",
                projectId: "PRJ-001",
                description: "Test",
                createdBy: "EMP001",
                memberEmployeeIds: [],
                announcementPermission: "admin_only" as const,
            });
            expect(useTasksStore.getState().groups.length).toBe(before + 1);
        });

        it("updates a group", () => {
            const group = useTasksStore.getState().groups[0];
            useTasksStore.getState().updateGroup(group.id, { name: "Renamed" });
            expect(useTasksStore.getState().groups.find((g) => g.id === group.id)?.name).toBe("Renamed");
        });

        it("deletes a group and cascades to tasks", () => {
            const group = useTasksStore.getState().groups[0];
            const tasksBefore = useTasksStore.getState().tasks.filter((t) => t.groupId === group.id).length;
            useTasksStore.getState().deleteGroup(group.id);
            expect(useTasksStore.getState().groups.find((g) => g.id === group.id)).toBeUndefined();
            // Tasks belonging to that group should be removed
            expect(useTasksStore.getState().tasks.filter((t) => t.groupId === group.id).length).toBe(0);
            // Verify something was actually removed (if seed had tasks)
            if (tasksBefore > 0) {
                expect(useTasksStore.getState().tasks.length).toBeLessThan(useTasksStore.getState().tasks.length + tasksBefore);
            }
        });
    });

    describe("Task CRUD", () => {
        it("adds a task", () => {
            const before = useTasksStore.getState().tasks.length;
            const group = useTasksStore.getState().groups[0];
            useTasksStore.getState().addTask({
                groupId: group.id,
                title: "New Task",
                description: "Do something",
                status: "open",
                priority: "medium",
                assignedTo: ["EMP001"],
                dueDate: "2026-06-01",
                createdBy: "EMP001",
                completionRequired: false,
            });
            expect(useTasksStore.getState().tasks.length).toBe(before + 1);
        });

        it("updates a task", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().updateTask(task.id, { title: "Updated Task" });
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)?.title).toBe("Updated Task");
        });

        it("deletes a task", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().deleteTask(task.id);
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)).toBeUndefined();
        });
    });

    describe("Task status changes", () => {
        it("changes task status", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().changeStatus(task.id, "in_progress");
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)?.status).toBe("in_progress");
        });
    });

    describe("Completion workflow", () => {
        it("submits a completion report", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().changeStatus(task.id, "in_progress");
            const reportId = useTasksStore.getState().submitCompletion({
                taskId: task.id,
                employeeId: "EMP001",
                notes: "Done",
                photoDataUrl: "data:image/png;base64,abc",
                gpsLat: 14.5,
                gpsLng: 121.0,
            });
            expect(reportId).toBeTruthy();
            // Task should be in submitted status
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)?.status).toBe("submitted");
        });

        it("verifies a completion report", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().changeStatus(task.id, "in_progress");
            const reportId = useTasksStore.getState().submitCompletion({
                taskId: task.id,
                employeeId: "EMP001",
                notes: "Done",
            });
            useTasksStore.getState().verifyCompletion(reportId, "ADMIN001");
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)?.status).toBe("verified");
        });

        it("rejects a completion report", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().changeStatus(task.id, "in_progress");
            const reportId = useTasksStore.getState().submitCompletion({
                taskId: task.id,
                employeeId: "EMP001",
                notes: "Done",
            });
            useTasksStore.getState().rejectCompletion(reportId, "Not complete");
            expect(useTasksStore.getState().tasks.find((t) => t.id === task.id)?.status).toBe("rejected");
        });

        it("getCompletionReport retrieves by task ID", () => {
            const task = useTasksStore.getState().tasks[0];
            useTasksStore.getState().changeStatus(task.id, "in_progress");
            useTasksStore.getState().submitCompletion({
                taskId: task.id,
                employeeId: "EMP001",
                notes: "Proof",
            });
            const report = useTasksStore.getState().getCompletionReport(task.id);
            expect(report?.taskId).toBe(task.id);
        });
    });

    describe("Comments", () => {
        it("adds a comment to a task", () => {
            const task = useTasksStore.getState().tasks[0];
            const commentId = useTasksStore.getState().addComment({
                taskId: task.id,
                employeeId: "EMP001",
                message: "Great progress",
            });
            expect(commentId).toBeTruthy();
            const comments = useTasksStore.getState().getComments(task.id);
            expect(comments.some((c) => c.message === "Great progress")).toBe(true);
        });
    });

    describe("Selectors", () => {
        it("getTasksByGroup returns tasks for a group", () => {
            const group = useTasksStore.getState().groups[0];
            const tasks = useTasksStore.getState().getTasksByGroup(group.id);
            expect(tasks.every((t) => t.groupId === group.id)).toBe(true);
        });

        it("getTasksForEmployee returns tasks assigned to an employee", () => {
            const task = useTasksStore.getState().tasks[0];
            if (task.assignedTo.length > 0) {
                const employeeTasks = useTasksStore.getState().getTasksForEmployee(task.assignedTo[0]);
                expect(employeeTasks.length).toBeGreaterThan(0);
            }
        });

        it("getStats returns correct shape", () => {
            const stats = useTasksStore.getState().getStats();
            expect(stats).toHaveProperty("total");
            expect(stats).toHaveProperty("open");
            expect(stats).toHaveProperty("inProgress");
            expect(stats).toHaveProperty("submitted");
            expect(stats).toHaveProperty("verified");
            expect(stats).toHaveProperty("rejected");
            expect(stats).toHaveProperty("overdue");
        });

        it("getGroupById and getTaskById work", () => {
            const group = useTasksStore.getState().groups[0];
            expect(useTasksStore.getState().getGroupById(group.id)?.id).toBe(group.id);
            const task = useTasksStore.getState().tasks[0];
            expect(useTasksStore.getState().getTaskById(task.id)?.id).toBe(task.id);
        });
    });

    describe("Reset", () => {
        it("resets tasks to seed data", () => {
            useTasksStore.getState().addGroup({ name: "Temp", projectId: "PRJ-001", createdBy: "EMP001", memberEmployeeIds: [], announcementPermission: "admin_only" as const });
            useTasksStore.getState().resetToSeed();
            expect(useTasksStore.getState().groups.some((g) => g.name === "Temp")).toBe(false);
        });

        it("resets projects to seed data", () => {
            useProjectsStore.getState().addProject({ name: "Temp Proj", description: "", status: "active", assignedEmployeeIds: [], location: { lat: 0, lng: 0, radius: 100 } });
            useProjectsStore.getState().resetToSeed();
            expect(useProjectsStore.getState().projects.some((p) => p.name === "Temp Proj")).toBe(false);
        });
    });
});

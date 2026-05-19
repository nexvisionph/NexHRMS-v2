"use client";
/**
 * Tasks Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 19 of ZUSTAND_MIGRATION_CHECKLIST.md
 *
 * Important: Task groups MUST be persisted before tasks (FK on group_id),
 * so addTask awaits its parent group's upsert when the group is missing
 * from the DB.
 */

import { tasksDb } from "./db.service";
import { useTasksStore } from "@/store/tasks.store";
import { useAuditStore } from "@/store/audit.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import type {
    TaskGroup,
    Task,
    TaskCompletionReport,
    TaskComment,
    TaskTag,
    TaskStatus,
} from "@/types";
import { nanoid } from "nanoid";

function nowIso() {
    return new Date().toISOString();
}

// ─── Task Groups ─────────────────────────────────────────────────

/**
 * Create a task group — DB-first.
 */
export async function addGroup(
    data: Omit<TaskGroup, "id" | "createdAt">
): Promise<{ ok: boolean; id?: string }> {
    const id = `TG-${nanoid(6)}`;
    const group: TaskGroup = { ...data, id, createdAt: nowIso() };

    const ok = await tasksDb.upsertGroup(group);
    if (!ok) return { ok: false };

    useTasksStore.setState((s) => ({ groups: [...s.groups, group] }));
    return { ok: true, id };
}

/**
 * Update a task group — DB-first.
 */
export async function updateGroup(
    id: string,
    patch: Partial<Omit<TaskGroup, "id">>
): Promise<boolean> {
    const group = useTasksStore.getState().groups.find((g) => g.id === id);
    if (!group) return false;

    const updated: TaskGroup = { ...group, ...patch };
    const ok = await tasksDb.upsertGroup(updated);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        groups: s.groups.map((g) => (g.id === id ? updated : g)),
    }));
    return true;
}

/**
 * Delete a task group (and its child tasks) — DB-first.
 */
export async function deleteGroup(id: string): Promise<boolean> {
    const ok = await tasksDb.deleteGroup(id);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        groups: s.groups.filter((g) => g.id !== id),
        tasks: s.tasks.filter((t) => t.groupId !== id),
    }));
    return true;
}

// ─── Tasks ───────────────────────────────────────────────────────

/**
 * Add a task — DB-first. Ensures parent group exists in DB before insert.
 */
export async function addTask(
    data: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<{ ok: boolean; id?: string }> {
    const id = data.id?.trim() || `TSK-${nanoid(6)}`;
    const { id: _ignored, ...rest } = data as typeof data & { id?: string };
    void _ignored;
    const now = nowIso();
    const task: Task = { ...rest, id, createdAt: now, updatedAt: now };

    // Guard: parent group must exist before task can be inserted (FK constraint)
    if (task.groupId) {
        const localGroup = useTasksStore
            .getState()
            .groups.find((g) => g.id === task.groupId);
        if (localGroup) {
            const groupOk = await tasksDb.upsertGroup(localGroup);
            if (!groupOk) return { ok: false };
        }
    }

    const ok = await tasksDb.upsertTask(task);
    if (!ok) return { ok: false };

    useTasksStore.setState((s) => ({ tasks: [...s.tasks, task] }));

    useAuditStore.getState().log({
        entityType: "task",
        entityId: id,
        action: "task_created",
        performedBy: data.createdBy,
        afterSnapshot: { title: data.title, assignedTo: data.assignedTo },
    });
    data.assignedTo.forEach((empId) =>
        useNotificationsStore.getState().addLog({
            employeeId: empId,
            type: "task_assigned",
            channel: "both",
            subject: "New Task Assigned",
            body: `You have been assigned: ${data.title}`,
            link: `/tasks/${id}`,
        })
    );
    return { ok: true, id };
}

/**
 * Update a task — DB-first.
 */
export async function updateTask(
    id: string,
    patch: Partial<Omit<Task, "id">>
): Promise<boolean> {
    const task = useTasksStore.getState().tasks.find((t) => t.id === id);
    if (!task) return false;

    const updated: Task = { ...task, ...patch, updatedAt: nowIso() };
    const ok = await tasksDb.upsertTask(updated);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Delete a task (and its completion reports + comments) — DB-first.
 */
export async function deleteTask(id: string): Promise<boolean> {
    const ok = await tasksDb.deleteTask(id);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        completionReports: s.completionReports.filter((r) => r.taskId !== id),
        comments: s.comments.filter((c) => c.taskId !== id),
    }));
    return true;
}

/**
 * Change a task's status — DB-first.
 */
export async function changeStatus(
    id: string,
    status: TaskStatus
): Promise<boolean> {
    return updateTask(id, { status });
}

// ─── Completion Reports ──────────────────────────────────────────

/**
 * Submit a completion report — DB-first. Also flips task status to
 * "submitted" and notifies admin/HR reviewers.
 */
export async function submitCompletion(
    data: Omit<TaskCompletionReport, "id" | "submittedAt">
): Promise<{ ok: boolean; id?: string }> {
    const id = `TCR-${nanoid(6)}`;
    const report: TaskCompletionReport = {
        ...data,
        id,
        submittedAt: nowIso(),
    };

    const reportOk = await tasksDb.upsertCompletionReport(report);
    if (!reportOk) return { ok: false };

    // Flip parent task to "submitted" — DB write before local mutation
    const task = useTasksStore.getState().tasks.find((t) => t.id === data.taskId);
    if (task) {
        const taskUpdate: Task = {
            ...task,
            status: "submitted" as TaskStatus,
            updatedAt: nowIso(),
        };
        await tasksDb.upsertTask(taskUpdate);
        useTasksStore.setState((s) => ({
            completionReports: [...s.completionReports, report],
            tasks: s.tasks.map((t) =>
                t.id === data.taskId ? taskUpdate : t
            ),
        }));
    } else {
        useTasksStore.setState((s) => ({
            completionReports: [...s.completionReports, report],
        }));
    }

    useAuditStore.getState().log({
        entityType: "task",
        entityId: data.taskId,
        action: "task_completed",
        performedBy: data.employeeId,
    });

    // Notify admins/HR
    if (task) {
        const admins = useEmployeesStore
            .getState()
            .employees.filter(
                (e) => e.status === "active" && (e.role === "admin" || e.role === "hr")
            );
        admins.forEach((admin) =>
            useNotificationsStore.getState().addLog({
                employeeId: admin.id,
                type: "task_submitted",
                channel: "both",
                subject: "Task Submitted for Review",
                body: `"${task.title}" has been submitted for your review.`,
                link: `/tasks/${data.taskId}`,
            })
        );
    }
    return { ok: true, id };
}

/**
 * Verify a completion report — DB-first. Flips task status to "verified".
 */
export async function verifyCompletion(
    reportId: string,
    verifiedBy: string
): Promise<boolean> {
    const report = useTasksStore
        .getState()
        .completionReports.find((r) => r.id === reportId);
    if (!report) return false;

    const updatedReport: TaskCompletionReport = {
        ...report,
        verifiedBy,
        verifiedAt: nowIso(),
    };
    const reportOk = await tasksDb.upsertCompletionReport(updatedReport);
    if (!reportOk) return false;

    const task = useTasksStore
        .getState()
        .tasks.find((t) => t.id === report.taskId);
    if (task) {
        const taskUpdate: Task = {
            ...task,
            status: "verified" as TaskStatus,
            updatedAt: nowIso(),
        };
        await tasksDb.upsertTask(taskUpdate);
        useTasksStore.setState((s) => ({
            completionReports: s.completionReports.map((r) =>
                r.id === reportId ? updatedReport : r
            ),
            tasks: s.tasks.map((t) =>
                t.id === report.taskId ? taskUpdate : t
            ),
        }));
    } else {
        useTasksStore.setState((s) => ({
            completionReports: s.completionReports.map((r) =>
                r.id === reportId ? updatedReport : r
            ),
        }));
    }

    useAuditStore.getState().log({
        entityType: "task",
        entityId: report.taskId,
        action: "task_verified",
        performedBy: verifiedBy,
    });
    if (task) {
        task.assignedTo.forEach((empId) =>
            useNotificationsStore.getState().addLog({
                employeeId: empId,
                type: "task_verified",
                channel: "both",
                subject: "Task Verified",
                body: `Your completion report for "${task.title}" was approved.`,
                link: `/tasks/${report.taskId}`,
            })
        );
    }
    return true;
}

/**
 * Reject a completion report — DB-first. Flips task status to "rejected".
 */
export async function rejectCompletion(
    reportId: string,
    rejectedBy: string,
    reason: string
): Promise<boolean> {
    const report = useTasksStore
        .getState()
        .completionReports.find((r) => r.id === reportId);
    if (!report) return false;

    const updatedReport: TaskCompletionReport = {
        ...report,
        rejectionReason: reason,
    };
    const reportOk = await tasksDb.upsertCompletionReport(updatedReport);
    if (!reportOk) return false;

    const task = useTasksStore
        .getState()
        .tasks.find((t) => t.id === report.taskId);
    if (task) {
        const taskUpdate: Task = {
            ...task,
            status: "rejected" as TaskStatus,
            updatedAt: nowIso(),
        };
        await tasksDb.upsertTask(taskUpdate);
        useTasksStore.setState((s) => ({
            completionReports: s.completionReports.map((r) =>
                r.id === reportId ? updatedReport : r
            ),
            tasks: s.tasks.map((t) =>
                t.id === report.taskId ? taskUpdate : t
            ),
        }));
    } else {
        useTasksStore.setState((s) => ({
            completionReports: s.completionReports.map((r) =>
                r.id === reportId ? updatedReport : r
            ),
        }));
    }

    useAuditStore.getState().log({
        entityType: "task",
        entityId: report.taskId,
        action: "task_rejected",
        performedBy: rejectedBy,
        reason,
    });
    if (task) {
        task.assignedTo.forEach((empId) =>
            useNotificationsStore.getState().addLog({
                employeeId: empId,
                type: "task_rejected",
                channel: "both",
                subject: "Task Rejected",
                body: `Your completion report for "${task.title}" was rejected: ${reason}`,
                link: `/tasks/${report.taskId}`,
            })
        );
    }
    return true;
}

// ─── Comments ────────────────────────────────────────────────────

/**
 * Add a comment to a task — DB-first (append-only).
 */
export async function addComment(
    data: Omit<TaskComment, "id" | "createdAt">
): Promise<{ ok: boolean; id?: string }> {
    const id = `TC-${nanoid(6)}`;
    const comment: TaskComment = { ...data, id, createdAt: nowIso() };

    const ok = await tasksDb.insertComment(comment);
    if (!ok) return { ok: false };

    useTasksStore.setState((s) => ({
        comments: [...s.comments, comment],
    }));
    return { ok: true, id };
}

// ─── Task Tags ───────────────────────────────────────────────────

/**
 * Add a task tag — DB-first.
 */
export async function addTag(
    data: Omit<TaskTag, "id" | "createdAt">
): Promise<{ ok: boolean; id?: string }> {
    const id = `TAG-${nanoid(6)}`;
    const tag: TaskTag = { ...data, id, createdAt: nowIso() };

    const ok = await tasksDb.upsertTag(tag);
    if (!ok) return { ok: false };

    useTasksStore.setState((s) => ({ taskTags: [...s.taskTags, tag] }));
    useAuditStore.getState().log({
        entityType: "task",
        entityId: id,
        action: "tag_created",
        performedBy: data.createdBy,
        afterSnapshot: { name: data.name, color: data.color },
    });
    return { ok: true, id };
}

/**
 * Update a task tag — DB-first.
 */
export async function updateTag(
    id: string,
    patch: Partial<Omit<TaskTag, "id" | "createdAt">>
): Promise<boolean> {
    const tag = useTasksStore.getState().taskTags.find((t) => t.id === id);
    if (!tag) return false;

    const updated: TaskTag = { ...tag, ...patch };
    const ok = await tasksDb.upsertTag(updated);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        taskTags: s.taskTags.map((t) => (t.id === id ? updated : t)),
    }));
    return true;
}

/**
 * Delete a task tag — DB-first.
 */
export async function deleteTag(id: string): Promise<boolean> {
    const ok = await tasksDb.deleteTag(id);
    if (!ok) return false;

    useTasksStore.setState((s) => ({
        taskTags: s.taskTags.filter((t) => t.id !== id),
    }));
    return true;
}

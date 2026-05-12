"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type {
    TaskGroup,
    Task,
    TaskCompletionReport,
    TaskComment,
    TaskTag,
    TaskStatus,
} from "@/types";
import {
    SEED_TASK_GROUPS,
    SEED_TASKS,
    SEED_COMPLETION_REPORTS,
    SEED_TASK_COMMENTS,
    SEED_TASK_TAGS,
} from "@/data/seed";
import { useAuditStore } from "@/store/audit.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";

interface TasksState {
    groups: TaskGroup[];
    tasks: Task[];
    completionReports: TaskCompletionReport[];
    comments: TaskComment[];
    taskTags: TaskTag[];

    // ── Groups ────────────────────────────────────────────────
    addGroup: (data: Omit<TaskGroup, "id" | "createdAt">) => string;
    updateGroup: (id: string, patch: Partial<Omit<TaskGroup, "id">>) => void;
    deleteGroup: (id: string) => void;

    // ── Tasks ─────────────────────────────────────────────────
    addTask: (data: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }) => string;
    updateTask: (id: string, patch: Partial<Omit<Task, "id">>) => void;
    deleteTask: (id: string) => void;
    changeStatus: (id: string, status: TaskStatus) => void;

    // ── Completion / verification ─────────────────────────────
    submitCompletion: (data: Omit<TaskCompletionReport, "id" | "submittedAt">) => string;
    verifyCompletion: (reportId: string, verifiedBy: string) => void;
    rejectCompletion: (reportId: string, reason: string) => void;

    // ── Comments ──────────────────────────────────────────────
    addComment: (data: Omit<TaskComment, "id" | "createdAt">) => string;

    // ── Tags ──────────────────────────────────────────────────
    addTag: (data: Omit<TaskTag, "id" | "createdAt">) => string;
    updateTag: (id: string, patch: Partial<Omit<TaskTag, "id" | "createdAt">>) => void;
    deleteTag: (id: string) => void;

    // ── Selectors ─────────────────────────────────────────────
    getTasksByGroup: (groupId: string) => Task[];
    getTasksForEmployee: (employeeId: string) => Task[];
    getCompletionReport: (taskId: string) => TaskCompletionReport | undefined;
    getComments: (taskId: string) => TaskComment[];
    getGroupById: (id: string) => TaskGroup | undefined;
    getTaskById: (id: string) => Task | undefined;
    getStats: () => { total: number; open: number; inProgress: number; submitted: number; verified: number; rejected: number; overdue: number };

    // ── Reset ─────────────────────────────────────────────────
    resetToSeed: () => void;
}

export const useTasksStore = create<TasksState>()(
    persist(
        (set, get) => ({
            groups: SEED_TASK_GROUPS,
            tasks: SEED_TASKS,
            completionReports: SEED_COMPLETION_REPORTS,
            comments: SEED_TASK_COMMENTS,
            taskTags: SEED_TASK_TAGS,

            // ── Groups ────────────────────────────────────────
            addGroup: (data) => {
                const id = `TG-${nanoid(6)}`;
                set((s) => ({
                    groups: [
                        ...s.groups,
                        { ...data, id, createdAt: new Date().toISOString() },
                    ],
                }));
                return id;
            },
            updateGroup: (id, patch) =>
                set((s) => ({
                    groups: s.groups.map((g) =>
                        g.id === id ? { ...g, ...patch } : g
                    ),
                })),
            deleteGroup: (id) =>
                set((s) => ({
                    groups: s.groups.filter((g) => g.id !== id),
                    tasks: s.tasks.filter((t) => t.groupId !== id),
                })),

            // ── Tasks ─────────────────────────────────────────
            addTask: (data) => {
                const id = data.id?.trim() || `TSK-${nanoid(6)}`;
                const { id: _id, ...rest } = data as typeof data & { id?: string };
                void _id;
                const now = new Date().toISOString();
                set((s) => ({
                    tasks: [
                        ...s.tasks,
                        { ...rest, id, createdAt: now, updatedAt: now },
                    ],
                }));
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
                return id;
            },
            updateTask: (id, patch) =>
                set((s) => ({
                    tasks: s.tasks.map((t) =>
                        t.id === id
                            ? { ...t, ...patch, updatedAt: new Date().toISOString() }
                            : t
                    ),
                })),
            deleteTask: (id) =>
                set((s) => ({
                    tasks: s.tasks.filter((t) => t.id !== id),
                    completionReports: s.completionReports.filter((r) => r.taskId !== id),
                    comments: s.comments.filter((c) => c.taskId !== id),
                })),
            changeStatus: (id, status) =>
                set((s) => ({
                    tasks: s.tasks.map((t) =>
                        t.id === id
                            ? { ...t, status, updatedAt: new Date().toISOString() }
                            : t
                    ),
                })),

            // ── Completion ────────────────────────────────────
            submitCompletion: (data) => {
                const id = `TCR-${nanoid(6)}`;
                set((s) => ({
                    completionReports: [
                        ...s.completionReports,
                        { ...data, id, submittedAt: new Date().toISOString() },
                    ],
                    tasks: s.tasks.map((t) =>
                        t.id === data.taskId
                            ? { ...t, status: "submitted" as TaskStatus, updatedAt: new Date().toISOString() }
                            : t
                    ),
                }));
                useAuditStore.getState().log({
                    entityType: "task",
                    entityId: data.taskId,
                    action: "task_completed",
                    performedBy: data.employeeId,
                });
                // Notify admin/HR that an employee submitted a task for review
                const submittedTask = get().tasks.find((t) => t.id === data.taskId);
                if (submittedTask) {
                    const admins = useEmployeesStore.getState().employees.filter(
                        (e) => e.status === "active" && (e.role === "admin" || e.role === "hr")
                    );
                    admins.forEach((admin) =>
                        useNotificationsStore.getState().addLog({
                            employeeId: admin.id,
                            type: "task_submitted",
                            channel: "both",
                            subject: "Task Submitted for Review",
                            body: `"${submittedTask.title}" has been submitted for your review.`,
                            link: `/tasks/${data.taskId}`,
                        })
                    );
                }
                return id;
            },
            verifyCompletion: (reportId, verifiedBy) => {
                const report = get().completionReports.find((r) => r.id === reportId);
                if (!report) return;
                set((s) => ({
                    completionReports: s.completionReports.map((r) =>
                        r.id === reportId
                            ? { ...r, verifiedBy, verifiedAt: new Date().toISOString() }
                            : r
                    ),
                    tasks: s.tasks.map((t) =>
                        t.id === report.taskId
                            ? { ...t, status: "verified" as TaskStatus, updatedAt: new Date().toISOString() }
                            : t
                    ),
                }));
                useAuditStore.getState().log({
                    entityType: "task",
                    entityId: report.taskId,
                    action: "task_verified",
                    performedBy: verifiedBy,
                });
                const task = get().tasks.find((t) => t.id === report.taskId);
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
            },
            rejectCompletion: (reportId, reason) => {
                const report = get().completionReports.find((r) => r.id === reportId);
                if (!report) return;
                set((s) => ({
                    completionReports: s.completionReports.map((r) =>
                        r.id === reportId
                            ? { ...r, rejectionReason: reason }
                            : r
                    ),
                    tasks: s.tasks.map((t) =>
                        t.id === report.taskId
                            ? { ...t, status: "rejected" as TaskStatus, updatedAt: new Date().toISOString() }
                            : t
                    ),
                }));
                useAuditStore.getState().log({
                    entityType: "task",
                    entityId: report.taskId,
                    action: "task_rejected",
                    performedBy: "system",
                    reason,
                });
                const task = get().tasks.find((t) => t.id === report.taskId);
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
            },

            // ── Comments ──────────────────────────────────────
            addComment: (data) => {
                const id = `TC-${nanoid(6)}`;
                set((s) => ({
                    comments: [
                        ...s.comments,
                        { ...data, id, createdAt: new Date().toISOString() },
                    ],
                }));
                return id;
            },

            // ── Tags ──────────────────────────────────────────
            addTag: (data) => {
                const id = `TAG-${nanoid(6)}`;
                set((s) => ({
                    taskTags: [
                        ...s.taskTags,
                        { ...data, id, createdAt: new Date().toISOString() },
                    ],
                }));
                useAuditStore.getState().log({
                    entityType: "task",
                    entityId: id,
                    action: "tag_created",
                    performedBy: data.createdBy,
                    afterSnapshot: { name: data.name, color: data.color },
                });
                return id;
            },
            updateTag: (id, patch) =>
                set((s) => ({
                    taskTags: s.taskTags.map((t) =>
                        t.id === id ? { ...t, ...patch } : t
                    ),
                })),
            deleteTag: (id) =>
                set((s) => ({
                    taskTags: s.taskTags.filter((t) => t.id !== id),
                })),

            // ── Selectors ─────────────────────────────────────
            getTasksByGroup: (groupId) =>
                get().tasks.filter((t) => t.groupId === groupId),
            getTasksForEmployee: (employeeId) =>
                get().tasks.filter((t) => t.assignedTo.includes(employeeId)),
            getCompletionReport: (taskId) =>
                get().completionReports.find((r) => r.taskId === taskId),
            getComments: (taskId) =>
                get().comments.filter((c) => c.taskId === taskId),
            getGroupById: (id) =>
                get().groups.find((g) => g.id === id),
            getTaskById: (id) =>
                get().tasks.find((t) => t.id === id),
            getStats: () => {
                const tasks = get().tasks;
                const now = new Date();
                return {
                    total: tasks.length,
                    open: tasks.filter((t) => t.status === "open").length,
                    inProgress: tasks.filter((t) => t.status === "in_progress").length,
                    submitted: tasks.filter((t) => t.status === "submitted").length,
                    verified: tasks.filter((t) => t.status === "verified").length,
                    rejected: tasks.filter((t) => t.status === "rejected").length,
                    overdue: tasks.filter(
                        (t) =>
                            t.dueDate &&
                            new Date(t.dueDate) < now &&
                            !["verified", "cancelled"].includes(t.status)
                    ).length,
                };
            },

            resetToSeed: () =>
                set({
                    groups: SEED_TASK_GROUPS,
                    tasks: SEED_TASKS,
                    completionReports: SEED_COMPLETION_REPORTS,
                    comments: SEED_TASK_COMMENTS,
                    taskTags: SEED_TASK_TAGS,
                }),
        }),
        { name: "soren-tasks", version: 2, storage: safePersistStorage,
            migrate: (persisted) => {
                const state = persisted as Partial<{ groups: unknown; tasks: unknown; completionReports: unknown; comments: unknown; taskTags: unknown[] }>;
                // v1→v2: inject seed tags for existing users who had empty taskTags
                const existingTags = state.taskTags ?? [];
                const seedTagIds = new Set(SEED_TASK_TAGS.map((t) => t.id));
                const mergedTags = [
                    ...SEED_TASK_TAGS,
                    ...existingTags.filter((t): t is typeof SEED_TASK_TAGS[0] => !seedTagIds.has((t as { id: string }).id)),
                ];
                return { ...state, taskTags: mergedTags };
            },
        }
    )
);

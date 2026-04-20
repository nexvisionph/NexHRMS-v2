"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type { JobTitle } from "@/types";
import { ROLES, DEPARTMENTS } from "@/lib/constants";
import { useAuditStore } from "@/store/audit.store";

// ─── Seed Data (matches migration seed) ────────────────────────
const SEED_JOB_TITLES: JobTitle[] = ROLES.map((role, idx) => {
    const deptMap: Record<string, string> = {
        "Frontend Developer": "Engineering",
        "Backend Developer": "Engineering",
        "UI/UX Designer": "Design",
        "Product Manager": "Operations",
        "HR Manager": "Human Resources",
        "HR Specialist": "Human Resources",
        "Finance Manager": "Finance",
        "Accountant": "Finance",
        "Marketing Lead": "Marketing",
        "Sales Executive": "Sales",
        "DevOps Engineer": "Engineering",
        "QA Engineer": "Engineering",
    };
    const leadRoles = ["Product Manager", "HR Manager", "Finance Manager", "Marketing Lead"];
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#ef4444"];
    return {
        id: `jt_${nanoid(8)}`,
        name: role,
        description: undefined,
        department: deptMap[role] || DEPARTMENTS[idx % DEPARTMENTS.length],
        isActive: true,
        isLead: leadRoles.includes(role),
        color: colors[idx % colors.length],
        createdBy: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
});

interface JobTitlesState {
    jobTitles: JobTitle[];

    // ── CRUD ─────────────────────────────────────────────────
    addJobTitle: (data: Omit<JobTitle, "id" | "createdAt" | "updatedAt">) => string;
    updateJobTitle: (id: string, patch: Partial<Omit<JobTitle, "id" | "createdAt" | "updatedAt">>) => void;
    deleteJobTitle: (id: string) => void;
    toggleActive: (id: string) => void;

    // ── Selectors ─────────────────────────────────────────────
    getById: (id: string) => JobTitle | undefined;
    getByName: (name: string) => JobTitle | undefined;
    getActive: () => JobTitle[];
    getByDepartment: (dept: string) => JobTitle[];

    // ── Reset ─────────────────────────────────────────────────
    resetToSeed: () => void;
}

export const useJobTitlesStore = create<JobTitlesState>()(
    persist(
        (set, get) => ({
            jobTitles: SEED_JOB_TITLES,

            // ── Add ───────────────────────────────────────────
            addJobTitle: (data) => {
                const id = `jt_${nanoid(8)}`;
                const now = new Date().toISOString();
                set((s) => ({
                    jobTitles: [
                        ...s.jobTitles,
                        { ...data, id, createdAt: now, updatedAt: now },
                    ],
                }));
                useAuditStore.getState().log({
                    entityType: "job_title",
                    entityId: id,
                    action: "tag_created", // reuse tag audit action
                    performedBy: data.createdBy,
                    afterSnapshot: { name: data.name, department: data.department },
                });
                return id;
            },

            // ── Update ────────────────────────────────────────
            updateJobTitle: (id, patch) =>
                set((s) => ({
                    jobTitles: s.jobTitles.map((jt) =>
                        jt.id === id
                            ? { ...jt, ...patch, updatedAt: new Date().toISOString() }
                            : jt
                    ),
                })),

            // ── Delete ────────────────────────────────────────
            deleteJobTitle: (id) =>
                set((s) => ({
                    jobTitles: s.jobTitles.filter((jt) => jt.id !== id),
                })),

            // ── Toggle Active ─────────────────────────────────
            toggleActive: (id) =>
                set((s) => ({
                    jobTitles: s.jobTitles.map((jt) =>
                        jt.id === id
                            ? { ...jt, isActive: !jt.isActive, updatedAt: new Date().toISOString() }
                            : jt
                    ),
                })),

            // ── Selectors ─────────────────────────────────────
            getById: (id) => get().jobTitles.find((jt) => jt.id === id),
            getByName: (name) => get().jobTitles.find((jt) => jt.name.toLowerCase() === name.toLowerCase()),
            getActive: () => get().jobTitles.filter((jt) => jt.isActive),
            getByDepartment: (dept) => get().jobTitles.filter((jt) => jt.department === dept),

            // ── Reset ─────────────────────────────────────────
            resetToSeed: () => set({ jobTitles: SEED_JOB_TITLES }),
        }),
        {
            name: "hrms-job-titles",
            version: 1,
            storage: safePersistStorage,
        }
    )
);

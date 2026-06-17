"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JobTitle } from "@/types";
import { ROLES, DEPARTMENTS } from "@/lib/constants";

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

import { jobTitlesDb, shouldSync, hasValidSession } from "@/services/db.service";
const USE_DEMO_MODE = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_USE_DEMO_MODE === "true";

interface JobTitlesState {
    jobTitles: JobTitle[];

    // ── CRUD (kept for backward compat — prefer service layer) ──
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
    // Self-hydration
    _hydrated: boolean;
    _hydrating: boolean;
    hydrateFromDb: () => Promise<void>;
}

export const useJobTitlesStore = create<JobTitlesState>()(
    (set, get) => ({
        jobTitles: USE_DEMO_MODE ? SEED_JOB_TITLES : [],

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
            return id;
        
                const jt = get().jobTitles[get().jobTitles.length - 1];
                if (jt) jobTitlesDb.upsert(jt).catch(() => {});
            },

        // ── Update ────────────────────────────────────────
        updateJobTitle: (id, patch) => {
            set((s) => ({
                jobTitles: s.jobTitles.map((jt) =>
                    jt.id === id
                        ? { ...jt, ...patch, updatedAt: new Date().toISOString() }
                        : jt
                ),
            }));
                const jt = get().jobTitles.find((j) => j.id === id);
                if (jt) jobTitlesDb.upsert(jt).catch(() => {});
            },

        // ── Delete ────────────────────────────────────────
        deleteJobTitle: (id) => {
            set((s) => ({
                jobTitles: s.jobTitles.filter((jt) => jt.id !== id),
            }));
                jobTitlesDb.remove(id).catch(() => {});
            },

        // ── Toggle Active ─────────────────────────────────
        toggleActive: (id) => {
            set((s) => ({
                jobTitles: s.jobTitles.map((jt) =>
                    jt.id === id
                        ? { ...jt, isActive: !jt.isActive, updatedAt: new Date().toISOString() }
                        : jt
                ),
            }));
                const jt = get().jobTitles.find((j) => j.id === id);
                if (jt) jobTitlesDb.upsert(jt).catch(() => {});
            },

        // ── Selectors ─────────────────────────────────────
        getById: (id) => get().jobTitles.find((jt) => jt.id === id),
        getByName: (name) => get().jobTitles.find((jt) => jt.name.toLowerCase() === name.toLowerCase()),
        getActive: () => get().jobTitles.filter((jt) => jt.isActive),
        getByDepartment: (dept) => get().jobTitles.filter((jt) => jt.department === dept),

        // ── Reset ─────────────────────────────────────────
        resetToSeed: () => set({ jobTitles: SEED_JOB_TITLES }),
    
            // Self-hydration
            _hydrated: false,
            _hydrating: false,
            hydrateFromDb: async () => {
                const state = get();
                if (state._hydrated || state._hydrating) return;
                if (!shouldSync()) return;
                const validSession = await hasValidSession();
                if (!validSession) return;
                set({ _hydrating: true });
                try {
                    const jobTitles = await jobTitlesDb.fetchAll();
                    const currentState = get();
                    if (currentState.jobTitles.length === 0 && jobTitles.length > 0) {
                        set({ jobTitles, _hydrated: true, _hydrating: false });
                    } else {
                        set({ _hydrated: true, _hydrating: false });
                    }
                } catch (err) {
                    console.warn("[job-titles] hydrateFromDb failed:", err);
                    set({ _hydrating: false });
                }
            },
})
);

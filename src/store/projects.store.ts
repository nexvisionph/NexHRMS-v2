"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Project } from "@/types";
import { projectsDb, shouldSync, hasValidSession } from "@/services/db.service";
import { SEED_PROJECTS } from "@/data/seed";

const USE_DEMO_MODE = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_USE_DEMO_MODE === "true";

interface ProjectsState {
    projects: Project[];
    addProject: (data: Omit<Project, "id" | "createdAt">) => void;
    updateProject: (id: string, data: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    assignEmployee: (projectId: string, employeeId: string) => void;
    removeEmployee: (projectId: string, employeeId: string) => void;
    getProjectForEmployee: (employeeId: string) => Project | undefined;
    resetToSeed: () => void;
    // Self-hydration
    _hydrated: boolean;
    _hydrating: boolean;
    hydrateFromDb: () => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>()(
    (set, get) => ({
        projects: USE_DEMO_MODE ? SEED_PROJECTS : [],
        addProject: (data) => {
            const newProject: Project = {
                ...data,
                id: `PRJ-${nanoid(8)}`,
                createdAt: new Date().toISOString(),
                qrSecret: nanoid(32),
                qrEnabled: data.qrEnabled ?? true,
            };
            set((s) => ({ projects: [...s.projects, newProject] }));
        
                // Persist to DB
                const proj = get().projects[get().projects.length - 1];
                if (proj) projectsDb.upsert(proj).catch(() => {});
            },
        updateProject: (id, data) => {
            set((s) => ({
                projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
            }));
        
                const proj = get().projects.find((p) => p.id === id);
                if (proj) projectsDb.upsert(proj).catch(() => {});
            },
        deleteProject: (id) => {
            set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
        
                projectsDb.remove(id).catch(() => {});
            },
        assignEmployee: (projectId, employeeId) => {
            set((s) => ({
                // Remove the employee from any other project first (1 project per employee)
                projects: s.projects.map((p) => {
                    if (p.id === projectId) {
                        return p.assignedEmployeeIds.includes(employeeId)
                            ? p
                            : { ...p, assignedEmployeeIds: [...p.assignedEmployeeIds, employeeId] };
                    }
                    return { ...p, assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== employeeId) };
                }),
            }));
        
                const proj = get().projects.find((p) => p.id === projectId);
                if (proj) projectsDb.upsert(proj).catch(() => {});
            },
        removeEmployee: (projectId, employeeId) => {
            set((s) => ({
                projects: s.projects.map((p) =>
                    p.id === projectId
                        ? { ...p, assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== employeeId) }
                        : p
                ),
            }));
        
                const proj = get().projects.find((p) => p.id === projectId);
                if (proj) projectsDb.upsert(proj).catch(() => {});
            },
        getProjectForEmployee: (employeeId) => {
            return get().projects.find((p) => p.assignedEmployeeIds.includes(employeeId));
        },
        resetToSeed: () => set({ projects: SEED_PROJECTS }),
    
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
                    const projects = await projectsDb.fetchAll();
                    const currentState = get();
                    if (currentState.projects.length === 0 && projects.length > 0) {
                        set({ projects, _hydrated: true, _hydrating: false });
                    } else {
                        set({ _hydrated: true, _hydrating: false });
                    }
                } catch (err) {
                    console.warn("[projects] hydrateFromDb failed:", err);
                    set({ _hydrating: false });
                }
            },
})
);

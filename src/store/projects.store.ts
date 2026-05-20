"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Project } from "@/types";
import { SEED_PROJECTS } from "@/data/seed";

interface ProjectsState {
    projects: Project[];
    addProject: (data: Omit<Project, "id" | "createdAt">) => void;
    updateProject: (id: string, data: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    assignEmployee: (projectId: string, employeeId: string) => void;
    removeEmployee: (projectId: string, employeeId: string) => void;
    getProjectForEmployee: (employeeId: string) => Project | undefined;
    resetToSeed: () => void;
}

export const useProjectsStore = create<ProjectsState>()(
    (set, get) => ({
        projects: SEED_PROJECTS,
        addProject: (data) => {
            const newProject: Project = {
                ...data,
                id: `PRJ-${nanoid(8)}`,
                createdAt: new Date().toISOString(),
                qrSecret: nanoid(32),
                qrEnabled: data.qrEnabled ?? true,
            };
            set((s) => ({ projects: [...s.projects, newProject] }));
        },
        updateProject: (id, data) => {
            set((s) => ({
                projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
            }));
        },
        deleteProject: (id) => {
            set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
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
        },
        removeEmployee: (projectId, employeeId) => {
            set((s) => ({
                projects: s.projects.map((p) =>
                    p.id === projectId
                        ? { ...p, assignedEmployeeIds: p.assignedEmployeeIds.filter((id) => id !== employeeId) }
                        : p
                ),
            }));
        },
        getProjectForEmployee: (employeeId) => {
            return get().projects.find((p) => p.assignedEmployeeIds.includes(employeeId));
        },
        resetToSeed: () => set({ projects: SEED_PROJECTS }),
    })
);

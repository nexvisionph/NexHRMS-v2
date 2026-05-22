"use client";
/**
 * Projects Actions Service — DB-first mutations.
 * 
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 5 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { projectsDb } from "./db.service";
import { useProjectsStore } from "@/store/projects.store";
import type { Project } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add a project — DB-first.
 */
export async function addProject(data: Omit<Project, "id" | "createdAt" | "assignedEmployeeIds">): Promise<boolean> {
    const project: Project = {
        ...data,
        id: `PROJ-${nanoid(8)}`,
        assignedEmployeeIds: [],
        createdAt: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await projectsDb.upsert(project);
    if (!ok) return false;

    // 2. Update local cache
    useProjectsStore.setState((s) => ({
        projects: [...s.projects, project],
    }));
    return true;
}

/**
 * Update a project — DB-first.
 */
export async function updateProject(id: string, data: Partial<Omit<Project, "id">>): Promise<boolean> {
    const store = useProjectsStore.getState();
    const existing = store.projects.find((p) => p.id === id);
    if (!existing) return false;

    const updated: Project = { ...existing, ...data };

    // 1. Write to DB first
    const ok = await projectsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useProjectsStore.setState((s) => ({
        projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
    return true;
}

/**
 * Delete a project — DB-first.
 */
export async function deleteProject(id: string): Promise<boolean> {
    // 1. Delete from DB first
    const ok = await projectsDb.remove(id);
    if (!ok) return false;

    // 2. Update local cache
    useProjectsStore.setState((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
    }));
    return true;
}

/**
 * Assign an employee to a project — DB-first.
 */
export async function assignEmployee(projectId: string, employeeId: string): Promise<boolean> {
    const store = useProjectsStore.getState();
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) return false;

    if (project.assignedEmployeeIds.includes(employeeId)) return true; // already assigned

    const updated: Project = {
        ...project,
        assignedEmployeeIds: [...project.assignedEmployeeIds, employeeId],
    };

    // 1. Write to DB first (upsert handles junction table sync)
    const ok = await projectsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useProjectsStore.setState((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
    return true;
}

/**
 * Remove an employee from a project — DB-first.
 */
export async function removeEmployee(projectId: string, employeeId: string): Promise<boolean> {
    const store = useProjectsStore.getState();
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) return false;

    const updated: Project = {
        ...project,
        assignedEmployeeIds: project.assignedEmployeeIds.filter((id) => id !== employeeId),
    };

    // 1. Write to DB first
    const ok = await projectsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useProjectsStore.setState((s) => ({
        projects: s.projects.map((p) => (p.id === projectId ? updated : p)),
    }));
    return true;
}

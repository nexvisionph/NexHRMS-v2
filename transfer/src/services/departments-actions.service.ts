"use client";
/**
 * Departments Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 6 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { departmentsDb } from "./db.service";
import { useDepartmentsStore } from "@/store/departments.store";
import type { Department } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add a department — DB-first.
 */
export async function addDepartment(
    data: Omit<Department, "id" | "createdAt" | "updatedAt">
): Promise<{ ok: boolean; id?: string }> {
    const now = new Date().toISOString();
    const dept: Department = {
        ...data,
        id: `dept_${nanoid(8)}`,
        createdAt: now,
        updatedAt: now,
    };

    // 1. Write to DB first
    const ok = await departmentsDb.upsert(dept);
    if (!ok) return { ok: false };

    // 2. Update local cache
    useDepartmentsStore.setState((s) => ({
        departments: [...s.departments, dept],
    }));
    return { ok: true, id: dept.id };
}

/**
 * Update a department — DB-first.
 */
export async function updateDepartment(
    id: string,
    patch: Partial<Omit<Department, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
    const store = useDepartmentsStore.getState();
    const existing = store.departments.find((d) => d.id === id);
    if (!existing) return false;

    const updated: Department = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await departmentsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useDepartmentsStore.setState((s) => ({
        departments: s.departments.map((d) => (d.id === id ? updated : d)),
    }));
    return true;
}

/**
 * Delete a department — DB-first.
 */
export async function deleteDepartment(id: string): Promise<boolean> {
    // 1. Delete from DB first
    const ok = await departmentsDb.remove(id);
    if (!ok) return false;

    // 2. Update local cache
    useDepartmentsStore.setState((s) => ({
        departments: s.departments.filter((d) => d.id !== id),
    }));
    return true;
}

/**
 * Toggle department active status — DB-first.
 */
export async function toggleDepartmentActive(id: string): Promise<boolean> {
    const store = useDepartmentsStore.getState();
    const existing = store.departments.find((d) => d.id === id);
    if (!existing) return false;

    const updated: Department = {
        ...existing,
        isActive: !existing.isActive,
        updatedAt: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await departmentsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useDepartmentsStore.setState((s) => ({
        departments: s.departments.map((d) => (d.id === id ? updated : d)),
    }));
    return true;
}

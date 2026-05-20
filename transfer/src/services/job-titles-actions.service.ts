"use client";
/**
 * Job Titles Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 7 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { jobTitlesDb } from "./db.service";
import { useJobTitlesStore } from "@/store/job-titles.store";
import type { JobTitle } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add a job title — DB-first.
 */
export async function addJobTitle(
    data: Omit<JobTitle, "id" | "createdAt" | "updatedAt">
): Promise<{ ok: boolean; id?: string }> {
    const now = new Date().toISOString();
    const jt: JobTitle = {
        ...data,
        id: `jt_${nanoid(8)}`,
        createdAt: now,
        updatedAt: now,
    };

    // 1. Write to DB first
    const ok = await jobTitlesDb.upsert(jt);
    if (!ok) return { ok: false };

    // 2. Update local cache
    useJobTitlesStore.setState((s) => ({
        jobTitles: [...s.jobTitles, jt],
    }));
    return { ok: true, id: jt.id };
}

/**
 * Update a job title — DB-first.
 */
export async function updateJobTitle(
    id: string,
    patch: Partial<Omit<JobTitle, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
    const store = useJobTitlesStore.getState();
    const existing = store.jobTitles.find((jt) => jt.id === id);
    if (!existing) return false;

    const updated: JobTitle = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await jobTitlesDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useJobTitlesStore.setState((s) => ({
        jobTitles: s.jobTitles.map((jt) => (jt.id === id ? updated : jt)),
    }));
    return true;
}

/**
 * Delete a job title — DB-first.
 */
export async function deleteJobTitle(id: string): Promise<boolean> {
    // 1. Delete from DB first
    const ok = await jobTitlesDb.remove(id);
    if (!ok) return false;

    // 2. Update local cache
    useJobTitlesStore.setState((s) => ({
        jobTitles: s.jobTitles.filter((jt) => jt.id !== id),
    }));
    return true;
}

/**
 * Toggle job title active status — DB-first.
 */
export async function toggleJobTitleActive(id: string): Promise<boolean> {
    const store = useJobTitlesStore.getState();
    const existing = store.jobTitles.find((jt) => jt.id === id);
    if (!existing) return false;

    const updated: JobTitle = {
        ...existing,
        isActive: !existing.isActive,
        updatedAt: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await jobTitlesDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useJobTitlesStore.setState((s) => ({
        jobTitles: s.jobTitles.map((jt) => (jt.id === id ? updated : jt)),
    }));
    return true;
}

"use client";
/**
 * Jobs Actions Service — DB-first mutations.
 *
 * Writes to API routes first, then updates TanStack Query cache on success.
 * Migrated from Zustand useJobsStore.setState() pattern to queryClient cache updates.
 */

import { getQueryClient } from "@/lib/query-client";
import { JOBS_QUERY_KEY, APPLICATIONS_QUERY_KEY } from "@/hooks/use-jobs";
import type {
    JobPosting,
    JobApplication,
    JobStatus,
    ApplicationStatus,
} from "@/types";
import { nanoid } from "nanoid";

function nowIso() {
    return new Date().toISOString();
}

function getJobs(): JobPosting[] {
    return getQueryClient().getQueryData<JobPosting[]>(JOBS_QUERY_KEY) ?? [];
}

function getApplications(): JobApplication[] {
    return getQueryClient().getQueryData<JobApplication[]>(APPLICATIONS_QUERY_KEY) ?? [];
}

function setJobs(updater: (prev: JobPosting[]) => JobPosting[]) {
    getQueryClient().setQueryData<JobPosting[]>(JOBS_QUERY_KEY, (prev) => updater(prev ?? []));
}

function setApplications(updater: (prev: JobApplication[]) => JobApplication[]) {
    getQueryClient().setQueryData<JobApplication[]>(APPLICATIONS_QUERY_KEY, (prev) => updater(prev ?? []));
}

// ─── Job CRUD ────────────────────────────────────────────────────

/**
 * Create a job posting — DB-first via /api/jobs POST.
 */
export async function addJob(
    data: Omit<JobPosting, "id" | "createdAt" | "updatedAt">
): Promise<{ ok: boolean; job?: JobPosting; error?: string }> {
    const job: JobPosting = {
        ...data,
        id: `JOB-${nanoid(8)}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    try {
        const res = await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(job),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
        }
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "Network error",
        };
    }

    setJobs((prev) => [job, ...prev]);
    return { ok: true, job };
}

/**
 * Update a job — DB-first.
 */
export async function updateJob(
    id: string,
    patch: Partial<Omit<JobPosting, "id" | "createdAt">>
): Promise<boolean> {
    const updatedAt = nowIso();
    try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        if (!res.ok) return false;
    } catch {
        return false;
    }

    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch, updatedAt } : j));
    return true;
}

/**
 * Set a job's status — DB-first.
 */
export async function setJobStatus(
    id: string,
    status: JobStatus
): Promise<boolean> {
    return updateJob(id, { status });
}

/**
 * Delete a job (and cascade-removed applications) — DB-first.
 */
export async function deleteJob(id: string): Promise<boolean> {
    try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
        if (!res.ok) return false;
    } catch {
        return false;
    }

    setJobs((prev) => prev.filter((j) => j.id !== id));
    setApplications((prev) => prev.filter((a) => a.jobId !== id));
    return true;
}

// ─── Application CRUD ────────────────────────────────────────────

/**
 * Add a job application — DB-first.
 */
export async function addApplication(
    data: Omit<JobApplication, "id" | "createdAt" | "updatedAt">
): Promise<{ ok: boolean; application?: JobApplication; error?: string }> {
    const app: JobApplication = {
        ...data,
        id: `APP-${nanoid(8)}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    try {
        const res = await fetch(
            `/api/jobs/${encodeURIComponent(app.jobId)}/applications`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(app),
            }
        );
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body?.error ?? `HTTP ${res.status}` };
        }
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "Network error",
        };
    }

    setApplications((prev) => [app, ...prev]);
    return { ok: true, application: app };
}

/**
 * Update an application — DB-first.
 */
export async function updateApplication(
    id: string,
    patch: Partial<Omit<JobApplication, "id" | "createdAt">>
): Promise<boolean> {
    const app = getApplications().find((a) => a.id === id);
    if (!app) return false;

    const updatedAt = nowIso();
    try {
        const res = await fetch(
            `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            }
        );
        if (!res.ok) return false;
    } catch {
        return false;
    }

    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, ...patch, updatedAt } : a));
    return true;
}

/**
 * Set an application's status — DB-first.
 */
export async function setApplicationStatus(
    id: string,
    status: ApplicationStatus,
    reviewedBy?: string
): Promise<boolean> {
    const app = getApplications().find((a) => a.id === id);
    if (!app) return false;

    const reviewedAt = nowIso();
    try {
        const res = await fetch(
            `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, reviewedBy, reviewedAt }),
            }
        );
        if (!res.ok) return false;
    } catch {
        return false;
    }

    setApplications((prev) => prev.map((a) =>
        a.id === id
            ? { ...a, status, reviewedBy: reviewedBy ?? a.reviewedBy, reviewedAt, updatedAt: reviewedAt }
            : a
    ));
    return true;
}

/**
 * Delete an application — DB-first.
 */
export async function deleteApplication(id: string): Promise<boolean> {
    const app = getApplications().find((a) => a.id === id);
    if (!app) return false;

    try {
        const res = await fetch(
            `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );
        if (!res.ok) return false;
    } catch {
        return false;
    }

    setApplications((prev) => prev.filter((a) => a.id !== id));
    return true;
}

"use client";

/**
 * TanStack Query replacement for useJobsStore.
 * Drop-in compatible API — same state shape and actions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import type { JobPosting, JobApplication, JobStatus, ApplicationStatus } from "@/types";

// ─── Query keys ──────────────────────────────────────────────

export const JOBS_QUERY_KEY = ["jobs"] as const;
export const APPLICATIONS_QUERY_KEY = ["job-applications"] as const;

// ─── Helpers ─────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

// ─── Fetch functions ─────────────────────────────────────────

async function fetchJobsFromApi(): Promise<JobPosting[]> {
    const res = await fetch("/api/jobs");
    if (!res.ok) return [];
    const json = await res.json() as { ok: boolean; jobs?: JobPosting[] };
    if (json.ok && Array.isArray(json.jobs)) return json.jobs;
    return [];
}

async function fetchAllApplications(): Promise<JobApplication[]> {
    // Applications are fetched per-job; this returns whatever is cached
    return [];
}

// ─── State type for selector overloads ───────────────────────

export interface JobsStoreState {
    jobs: JobPosting[];
    applications: JobApplication[];
    isLoading: boolean;
    hasFetched: boolean;
    fetchJobs: () => Promise<void>;
    fetchApplications: (jobId: string) => Promise<void>;
    createJob: (data: Omit<JobPosting, "id" | "createdAt" | "updatedAt">) => JobPosting;
    updateJob: (id: string, patch: Partial<Omit<JobPosting, "id" | "createdAt">>) => void;
    setJobStatus: (id: string, status: JobStatus) => void;
    deleteJob: (id: string) => void;
    addApplication: (data: Omit<JobApplication, "id" | "createdAt" | "updatedAt">) => JobApplication;
    updateApplication: (id: string, patch: Partial<Omit<JobApplication, "id" | "createdAt">>) => void;
    setApplicationStatus: (id: string, status: ApplicationStatus, reviewedBy?: string) => void;
    deleteApplication: (id: string) => void;
    uploadResume: (appId: string, jobId: string, file: File) => Promise<string | null>;
    deleteResume: (appId: string, jobId: string) => Promise<void>;
    getJob: (id: string) => JobPosting | undefined;
    getApplicationsByJob: (jobId: string) => JobApplication[];
    getStats: () => { total: number; open: number; draft: number; onHold: number; closed: number; totalApplications: number; inProgress: number; hired: number };
    resetToSeed: () => void;
}

// ─── Drop-in replacement for useJobsStore ────────────────────

export function useJobsStore(): JobsStoreState;
export function useJobsStore<T>(selector: (state: JobsStoreState) => T): T;
export function useJobsStore(selector?: unknown) {
    const queryClient = useQueryClient();

    const { data: jobs = [], isLoading: jobsLoading, isFetched } = useQuery({
        queryKey: JOBS_QUERY_KEY,
        queryFn: fetchJobsFromApi,
        staleTime: 2 * 60 * 1000,
    });

    const { data: applications = [] } = useQuery({
        queryKey: APPLICATIONS_QUERY_KEY,
        queryFn: fetchAllApplications,
        staleTime: Infinity, // managed via setQueryData from fetchApplications
        initialData: [] as JobApplication[],
    });

    const setJobsCache = useCallback((updater: (prev: JobPosting[]) => JobPosting[]) => {
        queryClient.setQueryData<JobPosting[]>(JOBS_QUERY_KEY, (prev) => updater(prev ?? []));
    }, [queryClient]);

    const setAppsCache = useCallback((updater: (prev: JobApplication[]) => JobApplication[]) => {
        queryClient.setQueryData<JobApplication[]>(APPLICATIONS_QUERY_KEY, (prev) => updater(prev ?? []));
    }, [queryClient]);

    // ─── Actions ─────────────────────────────────────────────

    const fetchJobs = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    }, [queryClient]);

    const fetchApplications = useCallback(async (jobId: string) => {
        try {
            const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/applications`);
            if (!res.ok) return;
            const json = await res.json() as { ok: boolean; applications?: JobApplication[] };
            if (json.ok && Array.isArray(json.applications)) {
                setAppsCache((prev) => {
                    const others = prev.filter((a) => a.jobId !== jobId);
                    return [...others, ...json.applications!];
                });
            }
        } catch { /* ignore */ }
    }, [setAppsCache]);

    const createJob = useCallback((data: Omit<JobPosting, "id" | "createdAt" | "updatedAt">): JobPosting => {
        const job: JobPosting = { ...data, id: `JOB-${nanoid(8)}`, createdAt: nowIso(), updatedAt: nowIso() };
        setJobsCache((prev) => [job, ...prev]);
        void fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) }).catch(() => {});
        return job;
    }, [setJobsCache]);

    const updateJob = useCallback((id: string, patch: Partial<Omit<JobPosting, "id" | "createdAt">>) => {
        setJobsCache((prev) => prev.map((j) => j.id === id ? { ...j, ...patch, updatedAt: nowIso() } : j));
        void fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
    }, [setJobsCache]);

    const setJobStatus = useCallback((id: string, status: JobStatus) => {
        setJobsCache((prev) => prev.map((j) => j.id === id ? { ...j, status, updatedAt: nowIso() } : j));
        void fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    }, [setJobsCache]);

    const deleteJob = useCallback((id: string) => {
        setJobsCache((prev) => prev.filter((j) => j.id !== id));
        setAppsCache((prev) => prev.filter((a) => a.jobId !== id));
        void fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    }, [setJobsCache, setAppsCache]);

    const addApplication = useCallback((data: Omit<JobApplication, "id" | "createdAt" | "updatedAt">): JobApplication => {
        const app: JobApplication = { ...data, id: `APP-${nanoid(8)}`, createdAt: nowIso(), updatedAt: nowIso() };
        setAppsCache((prev) => [app, ...prev]);
        void fetch(`/api/jobs/${encodeURIComponent(app.jobId)}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(app) }).catch(() => {});
        return app;
    }, [setAppsCache]);

    const updateApplication = useCallback((id: string, patch: Partial<Omit<JobApplication, "id" | "createdAt">>) => {
        setAppsCache((prev) => prev.map((a) => a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a));
        const app = applications.find((a) => a.id === id);
        if (app) {
            void fetch(`/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
        }
    }, [setAppsCache, applications]);

    const setApplicationStatus = useCallback((id: string, status: ApplicationStatus, reviewedBy?: string) => {
        setAppsCache((prev) => prev.map((a) => a.id === id ? { ...a, status, reviewedBy: reviewedBy ?? a.reviewedBy, reviewedAt: nowIso(), updatedAt: nowIso() } : a));
        const app = applications.find((a) => a.id === id);
        if (app) {
            void fetch(`/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
        }
    }, [setAppsCache, applications]);

    const deleteApplication = useCallback((id: string) => {
        const app = applications.find((a) => a.id === id);
        setAppsCache((prev) => prev.filter((a) => a.id !== id));
        if (app) {
            void fetch(`/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
        }
    }, [setAppsCache, applications]);

    const uploadResume = useCallback(async (appId: string, jobId: string, file: File): Promise<string | null> => {
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(appId)}/resume`, { method: "POST", body: formData });
            const json = await res.json() as { ok: boolean; path?: string; signedUrl?: string | null };
            if (json.ok && json.path) {
                setAppsCache((prev) => prev.map((a) => a.id === appId ? { ...a, resumeStoragePath: json.path!, updatedAt: nowIso() } : a));
                return json.signedUrl ?? null;
            }
            return null;
        } catch { return null; }
    }, [setAppsCache]);

    const deleteResume = useCallback(async (appId: string, jobId: string): Promise<void> => {
        try {
            await fetch(`/api/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(appId)}/resume`, { method: "DELETE" });
            setAppsCache((prev) => prev.map((a) => a.id === appId ? { ...a, resumeStoragePath: undefined, updatedAt: nowIso() } : a));
        } catch { /* ignore */ }
    }, [setAppsCache]);

    // ─── Selectors ───────────────────────────────────────────

    const getJob = useCallback((id: string) => jobs.find((j) => j.id === id), [jobs]);
    const getApplicationsByJob = useCallback((jobId: string) => applications.filter((a) => a.jobId === jobId), [applications]);
    const getStats = useCallback(() => ({
        total: jobs.length,
        open: jobs.filter((j) => j.status === "open").length,
        draft: jobs.filter((j) => j.status === "draft").length,
        onHold: jobs.filter((j) => j.status === "on_hold").length,
        closed: jobs.filter((j) => j.status === "closed").length,
        totalApplications: applications.length,
        inProgress: applications.filter((a) => ["applied", "screening", "interview", "offer"].includes(a.status)).length,
        hired: applications.filter((a) => a.status === "hired").length,
    }), [jobs, applications]);

    const resetToSeed = useCallback(() => {
        queryClient.setQueryData(JOBS_QUERY_KEY, []);
        queryClient.setQueryData(APPLICATIONS_QUERY_KEY, []);
    }, [queryClient]);

    const state = useMemo(() => ({
        jobs,
        applications,
        isLoading: jobsLoading,
        hasFetched: isFetched,
        fetchJobs,
        fetchApplications,
        createJob,
        updateJob,
        setJobStatus,
        deleteJob,
        addApplication,
        updateApplication,
        setApplicationStatus,
        deleteApplication,
        uploadResume,
        deleteResume,
        getJob,
        getApplicationsByJob,
        getStats,
        resetToSeed,
    }), [jobs, applications, jobsLoading, isFetched, fetchJobs, fetchApplications, createJob, updateJob, setJobStatus, deleteJob, addApplication, updateApplication, setApplicationStatus, deleteApplication, uploadResume, deleteResume, getJob, getApplicationsByJob, getStats, resetToSeed]);

    if (typeof selector === "function") {
        return selector(state);
    }
    return state;
}

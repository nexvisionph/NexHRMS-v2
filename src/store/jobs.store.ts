"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JobPosting, JobApplication, JobStatus, ApplicationStatus } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
    return new Date().toISOString();
}

// ── store interface ───────────────────────────────────────────────────────────

interface JobsState {
    jobs: JobPosting[];
    applications: JobApplication[];
    isLoading: boolean;
    hasFetched: boolean;

    // Remote sync
    fetchJobs: () => Promise<void>;
    fetchApplications: (jobId: string) => Promise<void>;

    // Job CRUD
    createJob: (data: Omit<JobPosting, "id" | "createdAt" | "updatedAt">) => JobPosting;
    updateJob: (id: string, patch: Partial<Omit<JobPosting, "id" | "createdAt">>) => void;
    setJobStatus: (id: string, status: JobStatus) => void;
    deleteJob: (id: string) => void;

    // Application CRUD
    addApplication: (data: Omit<JobApplication, "id" | "createdAt" | "updatedAt">) => JobApplication;
    updateApplication: (id: string, patch: Partial<Omit<JobApplication, "id" | "createdAt">>) => void;
    setApplicationStatus: (id: string, status: ApplicationStatus, reviewedBy?: string) => void;
    deleteApplication: (id: string) => void;

    // Resume upload / delete (returns signed URL on success, null on failure)
    uploadResume: (appId: string, jobId: string, file: File) => Promise<string | null>;
    deleteResume: (appId: string, jobId: string) => Promise<void>;

    // Selectors
    getJob: (id: string) => JobPosting | undefined;
    getApplicationsByJob: (jobId: string) => JobApplication[];
    getStats: () => {
        total: number;
        open: number;
        draft: number;
        onHold: number;
        closed: number;
        totalApplications: number;
        inProgress: number;
        hired: number;
    };

    resetToSeed: () => void;
}

// ── store ─────────────────────────────────────────────────────────────────────

export const useJobsStore = create<JobsState>()(
    (set, get) => ({
            jobs: [],
            applications: [],
            isLoading: false,
            hasFetched: false,

            // ── Remote sync ──────────────────────────────────────────────────

            fetchJobs: async () => {
                set({ isLoading: true });
                try {
                    const res = await fetch("/api/jobs");
                    if (!res.ok) return;
                    const json = await res.json() as { ok: boolean; jobs?: JobPosting[] };
                    if (json.ok && Array.isArray(json.jobs)) {
                        set({ jobs: json.jobs, hasFetched: true });
                    }
                } catch {
                    // network error — fall back to persisted local state
                } finally {
                    set({ isLoading: false });
                }
            },

            fetchApplications: async (jobId) => {
                try {
                    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/applications`);
                    if (!res.ok) return;
                    const json = await res.json() as { ok: boolean; applications?: JobApplication[] };
                    if (json.ok && Array.isArray(json.applications)) {
                        set((s) => {
                            const others = s.applications.filter((a) => a.jobId !== jobId);
                            return { applications: [...others, ...json.applications!] };
                        });
                    }
                } catch {
                    // ignore — use cached state
                }
            },

            // ── Job actions ──────────────────────────────────────────────────

            createJob: (data) => {
                const job: JobPosting = {
                    ...data,
                    id: `JOB-${nanoid(8)}`,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                };
                set((s) => ({ jobs: [job, ...s.jobs] }));
                // fire-and-forget backend sync
                void fetch("/api/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(job),
                }).catch(() => {});
                return job;
            },

            updateJob: (id, patch) => {
                set((s) => ({
                    jobs: s.jobs.map((j) =>
                        j.id === id ? { ...j, ...patch, updatedAt: nowIso() } : j
                    ),
                }));
                void fetch(`/api/jobs/${encodeURIComponent(id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                }).catch(() => {});
            },

            setJobStatus: (id, status) => {
                set((s) => ({
                    jobs: s.jobs.map((j) =>
                        j.id === id ? { ...j, status, updatedAt: nowIso() } : j
                    ),
                }));
                void fetch(`/api/jobs/${encodeURIComponent(id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                }).catch(() => {});
            },

            deleteJob: (id) => {
                set((s) => ({
                    jobs: s.jobs.filter((j) => j.id !== id),
                    applications: s.applications.filter((a) => a.jobId !== id),
                }));
                void fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
            },

            // ── Application actions ──────────────────────────────────────────

            addApplication: (data) => {
                const app: JobApplication = {
                    ...data,
                    id: `APP-${nanoid(8)}`,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                };
                set((s) => ({ applications: [app, ...s.applications] }));
                void fetch(`/api/jobs/${encodeURIComponent(app.jobId)}/applications`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(app),
                }).catch(() => {});
                return app;
            },

            updateApplication: (id, patch) => {
                set((s) => ({
                    applications: s.applications.map((a) =>
                        a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a
                    ),
                }));
                const app = get().applications.find((a) => a.id === id);
                if (app) {
                    void fetch(
                        `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(patch),
                        }
                    ).catch(() => {});
                }
            },

            setApplicationStatus: (id, status, reviewedBy) => {
                set((s) => ({
                    applications: s.applications.map((a) =>
                        a.id === id
                            ? {
                                  ...a,
                                  status,
                                  reviewedBy: reviewedBy ?? a.reviewedBy,
                                  reviewedAt: nowIso(),
                                  updatedAt: nowIso(),
                              }
                            : a
                    ),
                }));
                const app = get().applications.find((a) => a.id === id);
                if (app) {
                    void fetch(
                        `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status }),
                        }
                    ).catch(() => {});
                }
            },

            deleteApplication: (id) => {
                const app = get().applications.find((a) => a.id === id);
                set((s) => ({
                    applications: s.applications.filter((a) => a.id !== id),
                }));
                if (app) {
                    void fetch(
                        `/api/jobs/${encodeURIComponent(app.jobId)}/applications/${encodeURIComponent(id)}`,
                        { method: "DELETE" }
                    ).catch(() => {});
                }
            },

            // ── Resume actions ───────────────────────────────────────────────

            uploadResume: async (appId, jobId, file) => {
                const formData = new FormData();
                formData.append("file", file);
                try {
                    const res = await fetch(
                        `/api/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(appId)}/resume`,
                        { method: "POST", body: formData }
                    );
                    const json = await res.json() as { ok: boolean; path?: string; signedUrl?: string | null };
                    if (json.ok && json.path) {
                        set((s) => ({
                            applications: s.applications.map((a) =>
                                a.id === appId
                                    ? { ...a, resumeStoragePath: json.path!, updatedAt: nowIso() }
                                    : a
                            ),
                        }));
                        return json.signedUrl ?? null;
                    }
                    return null;
                } catch {
                    return null;
                }
            },

            deleteResume: async (appId, jobId) => {
                try {
                    await fetch(
                        `/api/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(appId)}/resume`,
                        { method: "DELETE" }
                    );
                    set((s) => ({
                        applications: s.applications.map((a) =>
                            a.id === appId
                                ? { ...a, resumeStoragePath: undefined, updatedAt: nowIso() }
                                : a
                        ),
                    }));
                } catch {
                    // ignore
                }
            },

            // ── Selectors ────────────────────────────────────────────────────

            getJob: (id) => get().jobs.find((j) => j.id === id),

            getApplicationsByJob: (jobId) =>
                get().applications.filter((a) => a.jobId === jobId),

            getStats: () => {
                const { jobs, applications } = get();
                return {
                    total: jobs.length,
                    open: jobs.filter((j) => j.status === "open").length,
                    draft: jobs.filter((j) => j.status === "draft").length,
                    onHold: jobs.filter((j) => j.status === "on_hold").length,
                    closed: jobs.filter((j) => j.status === "closed").length,
                    totalApplications: applications.length,
                    inProgress: applications.filter((a) =>
                        ["applied", "screening", "interview", "offer"].includes(a.status)
                    ).length,
                    hired: applications.filter((a) => a.status === "hired").length,
                };
            },

            resetToSeed: () => set({ jobs: [], applications: [], hasFetched: false }),
        })
);

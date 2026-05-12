"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────

export type JobStatus = "draft" | "open" | "closed" | "on_hold" | "filled";
export type JobType = "full_time" | "part_time" | "contract" | "internship";
export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "executive";

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  status: JobStatus;
  openings: number;
  filledCount: number;
  postedBy: string;
  postedAt?: string;
  closingDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = "new" | "screening" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";

export interface JobApplication {
  id: string;
  jobId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  resumeUrl?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
}

interface JobsState {
  jobs: JobPosting[];
  applications: JobApplication[];

  // Job CRUD
  createJob: (data: Omit<JobPosting, "id" | "status" | "filledCount" | "createdAt" | "updatedAt">) => string;
  updateJob: (id: string, patch: Partial<JobPosting>) => void;
  deleteJob: (id: string) => void;
  publishJob: (id: string) => void;
  closeJob: (id: string) => void;
  holdJob: (id: string) => void;

  // Application CRUD
  addApplication: (data: Omit<JobApplication, "id" | "status" | "appliedAt" | "updatedAt">) => void;
  updateApplicationStatus: (id: string, status: ApplicationStatus, notes?: string) => void;

  // Queries
  getJobById: (id: string) => JobPosting | undefined;
  getOpenJobs: () => JobPosting[];
  getJobsByDepartment: (dept: string) => JobPosting[];
  getApplicationsForJob: (jobId: string) => JobApplication[];
  getApplicationCount: (jobId: string) => number;
}

export const useJobsStore = create<JobsState>()(
  persist(
    (set, get) => ({
      jobs: [],
      applications: [],

      createJob: (data) => {
        const id = nanoid();
        const now = new Date().toISOString();
        set((s) => ({
          jobs: [...s.jobs, { ...data, id, status: "draft", filledCount: 0, createdAt: now, updatedAt: now }],
        }));
        return id;
      },

      updateJob: (id, patch) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, ...patch, updatedAt: new Date().toISOString() } : j
          ),
        })),

      deleteJob: (id) =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
          applications: s.applications.filter((a) => a.jobId !== id),
        })),

      publishJob: (id) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, status: "open" as JobStatus, postedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : j
          ),
        })),

      closeJob: (id) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, status: "closed" as JobStatus, updatedAt: new Date().toISOString() } : j
          ),
        })),

      holdJob: (id) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, status: "on_hold" as JobStatus, updatedAt: new Date().toISOString() } : j
          ),
        })),

      addApplication: (data) =>
        set((s) => ({
          applications: [
            ...s.applications,
            { ...data, id: nanoid(), status: "new" as ApplicationStatus, appliedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          ],
        })),

      updateApplicationStatus: (id, status, notes) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id ? { ...a, status, notes: notes ?? a.notes, updatedAt: new Date().toISOString() } : a
          ),
        })),

      getJobById: (id) => get().jobs.find((j) => j.id === id),
      getOpenJobs: () => get().jobs.filter((j) => j.status === "open"),
      getJobsByDepartment: (dept) => get().jobs.filter((j) => j.department === dept),
      getApplicationsForJob: (jobId) => get().applications.filter((a) => a.jobId === jobId),
      getApplicationCount: (jobId) => get().applications.filter((a) => a.jobId === jobId).length,
    }),
    {
      name: "nexhrms-jobs",
      storage: safePersistStorage,
    }
  )
);

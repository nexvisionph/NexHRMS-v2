"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────

export type CaseStatus =
  | "open"
  | "nte_issued"
  | "nte_acknowledged"
  | "explanation_submitted"
  | "under_review"
  | "nod_issued"
  | "nod_acknowledged"
  | "sanction_active"
  | "closed";

export type NODDecision =
  | "no_violation"
  | "verbal_warning"
  | "written_warning"
  | "final_warning"
  | "suspension"
  | "termination"
  | "salary_deduction"
  | "training_required"
  | "pip";

export interface DisciplinaryCase {
  id: string;
  employeeId: string;
  employeeName: string;
  status: CaseStatus;
  incidentDate: string;
  incidentDescription: string;
  reportedBy: string;
  reportedAt: string;
  category?: string;
  severity?: "minor" | "moderate" | "major" | "grave";
  closedAt?: string;
  closedBy?: string;
  closureNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NTERecord {
  id: string;
  caseId: string;
  employeeId: string;
  issuedBy: string;
  issuedAt: string;
  responseDeadline: string;
  allegations: string;
  supportingEvidence?: string;
  acknowledgedAt?: string;
  explanationText?: string;
  explanationSubmittedAt?: string;
  noResponseMarkedAt?: string;
}

export interface NODRecord {
  id: string;
  caseId: string;
  employeeId: string;
  issuedBy: string;
  issuedAt: string;
  decision: NODDecision;
  findings: string;
  sanctionStartDate?: string;
  sanctionEndDate?: string;
  returnToWorkDate?: string;
  acknowledgedAt?: string;
  deductionAmount?: number;
  trainingRequired?: string;
  pipDuration?: string;
}

interface DisciplinaryState {
  cases: DisciplinaryCase[];
  nteRecords: NTERecord[];
  nodRecords: NODRecord[];

  // Case CRUD
  createCase: (data: Omit<DisciplinaryCase, "id" | "status" | "createdAt" | "updatedAt">) => string;
  updateCase: (id: string, patch: Partial<DisciplinaryCase>) => void;
  closeCase: (id: string, closedBy: string, notes?: string) => void;

  // NTE workflow
  issueNTE: (data: Omit<NTERecord, "id">) => void;
  acknowledgeNTE: (nteId: string) => void;
  submitExplanation: (nteId: string, text: string) => void;
  markNoResponse: (nteId: string) => void;
  moveToReview: (caseId: string) => void;

  // NOD workflow
  issueNOD: (data: Omit<NODRecord, "id">) => void;
  acknowledgeNOD: (nodId: string) => void;

  // Queries
  getCasesByEmployee: (employeeId: string) => DisciplinaryCase[];
  getCaseById: (id: string) => DisciplinaryCase | undefined;
  getNTEForCase: (caseId: string) => NTERecord | undefined;
  getNODForCase: (caseId: string) => NODRecord | undefined;
  getOpenCases: () => DisciplinaryCase[];
  getCasesByStatus: (status: CaseStatus) => DisciplinaryCase[];

  // KPI
  getKPIs: () => {
    open: number;
    awaitingExplanation: number;
    forReview: number;
    nodPending: number;
    suspensionsActive: number;
    closed: number;
  };
}

export const useDisciplinaryStore = create<DisciplinaryState>()(
  persist(
    (set, get) => ({
      cases: [],
      nteRecords: [],
      nodRecords: [],

      createCase: (data) => {
        const id = nanoid();
        const now = new Date().toISOString();
        set((s) => ({
          cases: [
            ...s.cases,
            { ...data, id, status: "open", createdAt: now, updatedAt: now },
          ],
        }));
        return id;
      },

      updateCase: (id, patch) =>
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
          ),
        })),

      closeCase: (id, closedBy, notes) =>
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id === id
              ? { ...c, status: "closed" as CaseStatus, closedBy, closedAt: new Date().toISOString(), closureNotes: notes, updatedAt: new Date().toISOString() }
              : c
          ),
        })),

      issueNTE: (data) => {
        const id = nanoid();
        set((s) => ({
          nteRecords: [...s.nteRecords, { ...data, id }],
          cases: s.cases.map((c) =>
            c.id === data.caseId ? { ...c, status: "nte_issued" as CaseStatus, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      acknowledgeNTE: (nteId) =>
        set((s) => {
          const nte = s.nteRecords.find((n) => n.id === nteId);
          return {
            nteRecords: s.nteRecords.map((n) =>
              n.id === nteId ? { ...n, acknowledgedAt: new Date().toISOString() } : n
            ),
            cases: nte
              ? s.cases.map((c) =>
                  c.id === nte.caseId ? { ...c, status: "nte_acknowledged" as CaseStatus, updatedAt: new Date().toISOString() } : c
                )
              : s.cases,
          };
        }),

      submitExplanation: (nteId, text) =>
        set((s) => {
          const nte = s.nteRecords.find((n) => n.id === nteId);
          return {
            nteRecords: s.nteRecords.map((n) =>
              n.id === nteId ? { ...n, explanationText: text, explanationSubmittedAt: new Date().toISOString() } : n
            ),
            cases: nte
              ? s.cases.map((c) =>
                  c.id === nte.caseId ? { ...c, status: "explanation_submitted" as CaseStatus, updatedAt: new Date().toISOString() } : c
                )
              : s.cases,
          };
        }),

      markNoResponse: (nteId) =>
        set((s) => {
          const nte = s.nteRecords.find((n) => n.id === nteId);
          return {
            nteRecords: s.nteRecords.map((n) =>
              n.id === nteId ? { ...n, noResponseMarkedAt: new Date().toISOString() } : n
            ),
            cases: nte
              ? s.cases.map((c) =>
                  c.id === nte.caseId ? { ...c, status: "under_review" as CaseStatus, updatedAt: new Date().toISOString() } : c
                )
              : s.cases,
          };
        }),

      moveToReview: (caseId) =>
        set((s) => ({
          cases: s.cases.map((c) =>
            c.id === caseId ? { ...c, status: "under_review" as CaseStatus, updatedAt: new Date().toISOString() } : c
          ),
        })),

      issueNOD: (data) => {
        const id = nanoid();
        set((s) => ({
          nodRecords: [...s.nodRecords, { ...data, id }],
          cases: s.cases.map((c) =>
            c.id === data.caseId ? { ...c, status: "nod_issued" as CaseStatus, updatedAt: new Date().toISOString() } : c
          ),
        }));
      },

      acknowledgeNOD: (nodId) =>
        set((s) => {
          const nod = s.nodRecords.find((n) => n.id === nodId);
          const decision = nod?.decision;
          const newStatus: CaseStatus = decision === "suspension" || decision === "termination" ? "sanction_active" : "nod_acknowledged";
          return {
            nodRecords: s.nodRecords.map((n) =>
              n.id === nodId ? { ...n, acknowledgedAt: new Date().toISOString() } : n
            ),
            cases: nod
              ? s.cases.map((c) =>
                  c.id === nod.caseId ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
                )
              : s.cases,
          };
        }),

      getCasesByEmployee: (employeeId) =>
        get().cases.filter((c) => c.employeeId === employeeId),

      getCaseById: (id) => get().cases.find((c) => c.id === id),

      getNTEForCase: (caseId) => get().nteRecords.find((n) => n.caseId === caseId),

      getNODForCase: (caseId) => get().nodRecords.find((n) => n.caseId === caseId),

      getOpenCases: () => get().cases.filter((c) => c.status !== "closed"),

      getCasesByStatus: (status) => get().cases.filter((c) => c.status === status),

      getKPIs: () => {
        const cases = get().cases;
        return {
          open: cases.filter((c) => c.status === "open").length,
          awaitingExplanation: cases.filter((c) => c.status === "nte_issued" || c.status === "nte_acknowledged").length,
          forReview: cases.filter((c) => c.status === "explanation_submitted" || c.status === "under_review").length,
          nodPending: cases.filter((c) => c.status === "nod_issued").length,
          suspensionsActive: cases.filter((c) => c.status === "sanction_active").length,
          closed: cases.filter((c) => c.status === "closed").length,
        };
      },
    }),
    {
      name: "nexhrms-disciplinary",
      storage: safePersistStorage,
    }
  )
);

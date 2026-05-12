"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type {
    DisciplinaryCase,
    DisciplinaryCaseStatus,
    NTERecord,
    NODRecord,
    NODDecision,
} from "@/types";
import { useAuditStore } from "./audit.store";

interface DisciplinaryState {
    cases: DisciplinaryCase[];
    ntes: NTERecord[];
    nods: NODRecord[];

    // Case lifecycle
    createCase: (data: Omit<DisciplinaryCase, "id" | "caseNumber" | "createdAt" | "updatedAt" | "status">) => DisciplinaryCase;
    closeCase: (caseId: string, by: string) => void;
    reopenCase: (caseId: string, by: string) => void;
    moveToReview: (caseId: string) => void;

    // NTE
    issueNTE: (caseId: string, data: { responseDeadline: string; issuedBy: string; documentId?: string }) => NTERecord | undefined;
    acknowledgeNTE: (nteId: string) => void;
    submitExplanation: (nteId: string, explanation: string) => void;
    markNoResponse: (nteId: string) => void;

    // NOD
    issueNOD: (
        caseId: string,
        data: {
            decision: NODDecision;
            decisionDetails: string;
            issuedBy: string;
            sanctionStartDate?: string;
            sanctionEndDate?: string;
            returnToWorkDate?: string;
            documentId?: string;
        }
    ) => NODRecord | undefined;
    acknowledgeNOD: (nodId: string) => void;

    // Selectors
    getCase: (caseId: string) => DisciplinaryCase | undefined;
    getNTEByCase: (caseId: string) => NTERecord | undefined;
    getNODByCase: (caseId: string) => NODRecord | undefined;
    getByEmployee: (employeeId: string) => DisciplinaryCase[];
    getOpenCases: () => DisciplinaryCase[];
    getDashboardStats: () => {
        open: number;
        awaitingExplanation: number;
        forReview: number;
        nodPending: number;
        suspensionsActive: number;
        closed: number;
        total: number;
    };

    resetToSeed: () => void;
}

function nowIso() { return new Date().toISOString(); }

function nextCaseNumber(existing: DisciplinaryCase[]): string {
    const year = new Date().getFullYear();
    const prefix = `CASE-${year}-`;
    const max = existing
        .filter((c) => c.caseNumber.startsWith(prefix))
        .map((c) => Number.parseInt(c.caseNumber.slice(prefix.length), 10) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
    return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function setCaseStatus(
    cases: DisciplinaryCase[],
    caseId: string,
    status: DisciplinaryCaseStatus
): DisciplinaryCase[] {
    return cases.map((c) => (c.id === caseId ? { ...c, status, updatedAt: nowIso() } : c));
}

export const useDisciplinaryStore = create<DisciplinaryState>()(
    persist(
        (set, get) => ({
            cases: [],
            ntes: [],
            nods: [],

            // ── Case lifecycle ─────────────────────────────────
            createCase: (data) => {
                const c: DisciplinaryCase = {
                    id: `CASE-${nanoid(8)}`,
                    caseNumber: nextCaseNumber(get().cases),
                    status: "open",
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                    ...data,
                    evidenceUrls: data.evidenceUrls ?? [],
                };
                set((s) => ({ cases: [c, ...s.cases] }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: c.id,
                    action: "case_created",
                    performedBy: data.createdBy,
                    afterSnapshot: { caseNumber: c.caseNumber, employeeId: c.employeeId, violationType: c.violationType },
                });
                return c;
            },

            closeCase: (caseId, by) => {
                set((s) => ({ cases: setCaseStatus(s.cases, caseId, "closed") }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case", entityId: caseId, action: "case_closed", performedBy: by,
                });
            },

            reopenCase: (caseId, by) => {
                set((s) => ({ cases: setCaseStatus(s.cases, caseId, "open") }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case", entityId: caseId, action: "case_created", performedBy: by, reason: "reopen",
                });
            },

            moveToReview: (caseId) => {
                set((s) => ({ cases: setCaseStatus(s.cases, caseId, "under_review") }));
            },

            // ── NTE ────────────────────────────────────────────
            issueNTE: (caseId, data) => {
                const c = get().cases.find((x) => x.id === caseId);
                if (!c) return undefined;
                if (get().ntes.some((n) => n.caseId === caseId)) return undefined;
                const nte: NTERecord = {
                    id: `NTE-${nanoid(8)}`,
                    caseId,
                    employeeId: c.employeeId,
                    responseDeadline: data.responseDeadline,
                    issuedBy: data.issuedBy,
                    issuedAt: nowIso(),
                    status: "issued",
                    documentId: data.documentId,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                };
                set((s) => ({
                    ntes: [nte, ...s.ntes],
                    cases: setCaseStatus(s.cases, caseId, "nte_issued"),
                }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "nte_issued",
                    performedBy: data.issuedBy,
                    afterSnapshot: { nteId: nte.id, deadline: nte.responseDeadline },
                });
                return nte;
            },

            acknowledgeNTE: (nteId) =>
                set((s) => {
                    const nte = s.ntes.find((n) => n.id === nteId);
                    if (!nte) return s;
                    const ack = nowIso();
                    useAuditStore.getState().log({
                        entityType: "disciplinary_case", entityId: nte.caseId, action: "nte_acknowledged", performedBy: nte.employeeId,
                    });
                    return {
                        ...s,
                        ntes: s.ntes.map((n) => (n.id === nteId ? { ...n, status: "acknowledged", acknowledgedAt: ack, updatedAt: ack } : n)),
                        cases: setCaseStatus(s.cases, nte.caseId, "nte_acknowledged"),
                    };
                }),

            submitExplanation: (nteId, explanation) =>
                set((s) => {
                    const nte = s.ntes.find((n) => n.id === nteId);
                    if (!nte) return s;
                    const ts = nowIso();
                    useAuditStore.getState().log({
                        entityType: "disciplinary_case", entityId: nte.caseId, action: "nte_explained", performedBy: nte.employeeId,
                        afterSnapshot: { length: explanation.length },
                    });
                    return {
                        ...s,
                        ntes: s.ntes.map((n) =>
                            n.id === nteId
                                ? { ...n, status: "explanation_submitted", employeeExplanation: explanation, explanationSubmittedAt: ts, acknowledgedAt: n.acknowledgedAt ?? ts, updatedAt: ts }
                                : n
                        ),
                        cases: setCaseStatus(s.cases, nte.caseId, "explanation_submitted"),
                    };
                }),

            markNoResponse: (nteId) =>
                set((s) => {
                    const nte = s.ntes.find((n) => n.id === nteId);
                    if (!nte) return s;
                    return {
                        ...s,
                        ntes: s.ntes.map((n) => (n.id === nteId ? { ...n, status: "no_response", updatedAt: nowIso() } : n)),
                        cases: setCaseStatus(s.cases, nte.caseId, "no_response"),
                    };
                }),

            // ── NOD ────────────────────────────────────────────
            issueNOD: (caseId, data) => {
                const c = get().cases.find((x) => x.id === caseId);
                if (!c) return undefined;
                if (get().nods.some((n) => n.caseId === caseId)) return undefined;
                const isSanction =
                    data.decision === "suspension" ||
                    data.decision === "salary_deduction" ||
                    data.decision === "training_required" ||
                    data.decision === "pip";
                const nod: NODRecord = {
                    id: `NOD-${nanoid(8)}`,
                    caseId,
                    employeeId: c.employeeId,
                    decision: data.decision,
                    decisionDetails: data.decisionDetails,
                    sanctionStartDate: data.sanctionStartDate,
                    sanctionEndDate: data.sanctionEndDate,
                    returnToWorkDate: data.returnToWorkDate,
                    documentId: data.documentId,
                    issuedBy: data.issuedBy,
                    issuedAt: nowIso(),
                    status: "issued",
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                };
                set((s) => {
                    // Mirror the NTE side too, if any
                    const ntes = s.ntes.map((n) => (n.caseId === caseId ? { ...n, status: "moved_to_nod" as const, updatedAt: nowIso() } : n));
                    const nextCaseStatus: DisciplinaryCaseStatus =
                        data.decision === "no_violation" ? "closed" : "nod_issued";
                    return {
                        ...s,
                        nods: [nod, ...s.nods],
                        ntes,
                        cases: setCaseStatus(s.cases, caseId, nextCaseStatus),
                    };
                });
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "nod_issued",
                    performedBy: data.issuedBy,
                    afterSnapshot: { decision: nod.decision, sanctionActive: isSanction },
                });
                if (data.decision === "no_violation") {
                    useAuditStore.getState().log({
                        entityType: "disciplinary_case", entityId: caseId, action: "case_closed", performedBy: data.issuedBy, reason: "no_violation",
                    });
                }
                return nod;
            },

            acknowledgeNOD: (nodId) =>
                set((s) => {
                    const nod = s.nods.find((n) => n.id === nodId);
                    if (!nod) return s;
                    const ack = nowIso();
                    const isSanction =
                        nod.decision === "suspension" ||
                        nod.decision === "salary_deduction" ||
                        nod.decision === "training_required" ||
                        nod.decision === "pip";
                    const nextCaseStatus: DisciplinaryCaseStatus = isSanction ? "sanction_active" : "nod_acknowledged";
                    useAuditStore.getState().log({
                        entityType: "disciplinary_case", entityId: nod.caseId, action: "nod_acknowledged", performedBy: nod.employeeId,
                    });
                    return {
                        ...s,
                        nods: s.nods.map((n) =>
                            n.id === nodId
                                ? { ...n, status: isSanction ? "sanction_active" : "acknowledged", acknowledgedAt: ack, updatedAt: ack }
                                : n
                        ),
                        cases: setCaseStatus(s.cases, nod.caseId, nextCaseStatus),
                    };
                }),

            // ── Selectors ──────────────────────────────────────
            getCase: (caseId) => get().cases.find((c) => c.id === caseId),
            getNTEByCase: (caseId) => get().ntes.find((n) => n.caseId === caseId),
            getNODByCase: (caseId) => get().nods.find((n) => n.caseId === caseId),
            getByEmployee: (employeeId) => get().cases.filter((c) => c.employeeId === employeeId),
            getOpenCases: () => get().cases.filter((c) => c.status !== "closed"),

            getDashboardStats: () => {
                const cases = get().cases;
                return {
                    open: cases.filter((c) => c.status !== "closed").length,
                    awaitingExplanation: cases.filter((c) => c.status === "nte_issued" || c.status === "nte_acknowledged").length,
                    forReview: cases.filter((c) => c.status === "explanation_submitted" || c.status === "no_response" || c.status === "under_review").length,
                    nodPending: cases.filter((c) => c.status === "nod_issued").length,
                    suspensionsActive: cases.filter((c) => c.status === "sanction_active").length,
                    closed: cases.filter((c) => c.status === "closed").length,
                    total: cases.length,
                };
            },

            resetToSeed: () => set({ cases: [], ntes: [], nods: [] }),
        }),
        { name: "soren-disciplinary", version: 1, storage: safePersistStorage }
    )
);

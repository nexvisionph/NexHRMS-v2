"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
    DisciplinaryCase,
    DisciplinaryCaseStatus,
    DisciplinaryNote,
    NTERecord,
    NODRecord,
    NODDecision,
    CaseResult,
} from "@/types";
import { useAuditStore } from "./audit.store";
import { useEmployeesStore } from "./employees.store";
import { notifyDisciplinaryExplanationSubmitted, dispatchNotification } from "@/lib/notifications";
import { disciplinaryDb } from "@/services/db.service";
import { toast } from "sonner";

interface DisciplinaryState {
    cases: DisciplinaryCase[];
    ntes: NTERecord[];
    nods: NODRecord[];
    notes: DisciplinaryNote[];

    // Case lifecycle
    createCase: (data: Omit<DisciplinaryCase, "id" | "caseNumber" | "createdAt" | "updatedAt" | "status">) => DisciplinaryCase;
    saveDraft: (data: Omit<DisciplinaryCase, "id" | "caseNumber" | "createdAt" | "updatedAt" | "status">) => DisciplinaryCase;
    submitCase: (caseId: string, by: string) => Promise<void>;
    updateCase: (caseId: string, data: Partial<Pick<DisciplinaryCase, "violationType" | "policyReference" | "incidentDate" | "incidentLocation" | "description" | "status" | "severityLevel" | "witnesses">>, by: string) => void;
    deleteCase: (caseId: string, by: string) => void;
    closeCase: (caseId: string, by: string, result?: CaseResult) => void;
    completeSanction: (caseId: string, result: CaseResult, by: string) => Promise<void>;
    reopenCase: (caseId: string, by: string) => void;
    moveToReview: (caseId: string) => void;

    // NTE
    issueNTE: (caseId: string, data: { responseDeadline: string; issuedBy: string; documentId?: string }) => NTERecord | undefined;
    acknowledgeNTE: (nteId: string) => void;
    submitExplanation: (nteId: string, explanation: string, submittedBy?: string) => void;
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

    // Notes
    addNote: (caseId: string, body: string, authorId: string) => DisciplinaryNote;

    // Selectors
    getCase: (caseId: string) => DisciplinaryCase | undefined;
    getNotesByCase: (caseId: string) => DisciplinaryNote[];
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

    // Hydration setters (called by sync.service.ts)
    setCases: (c: DisciplinaryCase[]) => void;
    setNTEs: (n: NTERecord[]) => void;
    setNODs: (n: NODRecord[]) => void;
    setNotes: (n: DisciplinaryNote[]) => void;
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
    (set, get) => ({
            cases: [],
            ntes: [],
            nods: [],
            notes: [],

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
                // Notify the employee about the new disciplinary case
                try {
                    const emp = useEmployeesStore.getState().employees.find((e) => e.id === data.employeeId);
                    if (emp) {
                        dispatchNotification("disciplinary_case_created", {
                            name: emp.name,
                            caseNumber: c.caseNumber,
                            violationType: c.violationType,
                        }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
                    }
                } catch { /* notification is best-effort */ }
                return c;
            },

            saveDraft: (data) => {
                const c: DisciplinaryCase = {
                    id: `CASE-${nanoid(8)}`,
                    caseNumber: nextCaseNumber(get().cases),
                    status: "draft",
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
                    afterSnapshot: { status: "draft", caseNumber: c.caseNumber, employeeId: c.employeeId, violationType: c.violationType },
                });
                // No dispatchNotification — drafts are internal only
                return c;
            },

            submitCase: async (caseId, by) => {
                const prev = get().cases.find((c) => c.id === caseId);
                if (!prev || prev.status !== "draft") return;

                const updated: DisciplinaryCase = { ...prev, status: "open" as const, updatedAt: nowIso() };

                // Optimistic update
                set((s) => ({ cases: s.cases.map((c) => (c.id === caseId ? updated : c)) }));

                // DB write
                try {
                    const ok = await disciplinaryDb.upsertCase(updated);
                    if (!ok) throw new Error("DB write failed");
                } catch {
                    // Rollback on failure
                    set((s) => ({ cases: s.cases.map((c) => (c.id === caseId ? prev : c)) }));
                    toast.error("Failed to submit case");
                    return;
                }

                // Notify the employee about the now-open case
                try {
                    const emp = useEmployeesStore.getState().employees.find((e) => e.id === updated.employeeId);
                    if (emp) {
                        dispatchNotification(
                            "disciplinary_case_created",
                            {
                                name: emp.name,
                                caseNumber: updated.caseNumber,
                                violationType: updated.violationType,
                            },
                            emp.id,
                            emp.email ?? undefined,
                            emp.phone,
                            undefined,
                            { suppressToast: true }
                        );
                    }
                } catch { /* notification is best-effort */ }

                // Audit log
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "case_created",
                    performedBy: by,
                    afterSnapshot: { status: "open", caseNumber: updated.caseNumber, employeeId: updated.employeeId, violationType: updated.violationType },
                });
            },

            updateCase: (caseId, data, by) => {
                set((s) => ({
                    cases: s.cases.map((c) =>
                        c.id === caseId ? { ...c, ...data, updatedAt: nowIso() } : c
                    ),
                }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "case_created",
                    performedBy: by,
                    afterSnapshot: data,
                });
            },

            deleteCase: (caseId, by) => {
                set((s) => ({
                    cases: s.cases.filter((c) => c.id !== caseId),
                    ntes: s.ntes.filter((n) => n.caseId !== caseId),
                    nods: s.nods.filter((n) => n.caseId !== caseId),
                }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "case_closed",
                    performedBy: by,
                    reason: "deleted",
                });
            },

            closeCase: (caseId, by, result) => {
                const ts = nowIso();
                set((s) => ({
                    cases: s.cases.map((c) =>
                        c.id === caseId ? { ...c, status: "closed", result, updatedAt: ts } : c
                    ),
                }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "case_closed",
                    performedBy: by,
                    afterSnapshot: result ? { result } : undefined,
                });
            },

            reopenCase: (caseId, by) => {
                set((s) => ({ cases: setCaseStatus(s.cases, caseId, "open") }));
                useAuditStore.getState().log({
                    entityType: "disciplinary_case", entityId: caseId, action: "case_created", performedBy: by, reason: "reopen",
                });
            },

            moveToReview: (caseId) => {
                const caseRec = get().cases.find((c) => c.id === caseId);
                if (!caseRec) return;
                // Optimistic update
                set((s) => ({ cases: setCaseStatus(s.cases, caseId, "under_review") }));
                // Persist to DB
                (async () => {
                    try {
                        const updated = { ...caseRec, status: "under_review" as const, updatedAt: nowIso() };
                        const ok = await disciplinaryDb.upsertCase(updated);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        // Rollback on failure
                        set((s) => ({ cases: setCaseStatus(s.cases, caseId, caseRec.status) }));
                        toast.error("Failed to move case to review");
                    }
                })();
                // Audit log
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "case_moved_to_review",
                    performedBy: "system",
                });
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
                // Optimistic update
                set((s) => ({
                    ntes: [nte, ...s.ntes],
                    cases: setCaseStatus(s.cases, caseId, "nte_issued"),
                }));
                // Persist case status to DB
                (async () => {
                    const caseRec = get().cases.find((c) => c.id === caseId);
                    if (!caseRec) return;
                    const updated = { ...caseRec, status: "nte_issued" as const, updatedAt: nowIso() };
                    try {
                        const ok = await disciplinaryDb.upsertCase(updated);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        // Rollback on failure
                        set((s) => ({
                            cases: setCaseStatus(s.cases, caseId, caseRec.status),
                            ntes: s.ntes.filter((n) => n.id !== nte.id),
                        }));
                        toast.error("Failed to issue NTE");
                    }
                })();
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "nte_issued",
                    performedBy: data.issuedBy,
                    afterSnapshot: { nteId: nte.id, deadline: data.responseDeadline },
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

            submitExplanation: (nteId, explanation, submittedBy) => {
                const nte = get().ntes.find((n) => n.id === nteId);
                if (!nte) return;
                const caseRecord = get().cases.find((c) => c.id === nte.caseId);
                const ts = nowIso();
                const shouldNotify = nte.status !== "explanation_submitted";
                // Optimistic update
                set((s) => ({
                    ntes: s.ntes.map((n) =>
                        n.id === nteId
                            ? { ...n, status: "explanation_submitted", employeeExplanation: explanation, explanationSubmittedAt: ts, acknowledgedAt: n.acknowledgedAt ?? ts, updatedAt: ts }
                            : n
                    ),
                    cases: caseRecord ? setCaseStatus(s.cases, nte.caseId, "explanation_submitted") : s.cases,
                }));
                // Persist case status to DB
                (async () => {
                    if (!caseRecord) return;
                    const updated = { ...caseRecord, status: "explanation_submitted" as const, updatedAt: ts };
                    try {
                        const ok = await disciplinaryDb.upsertCase(updated);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        // Rollback on failure
                        set((s) => ({
                            cases: setCaseStatus(s.cases, nte.caseId, caseRecord.status),
                        }));
                        toast.error("Failed to save explanation");
                    }
                })();
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: nte.caseId,
                    action: "nte_explained",
                    performedBy: nte.employeeId,
                    afterSnapshot: { length: explanation.length },
                });
                if (shouldNotify && caseRecord) {
                    const employeeName = useEmployeesStore.getState().employees.find((e) => e.id === nte.employeeId)?.name ?? nte.employeeId;
                    notifyDisciplinaryExplanationSubmitted({
                        caseId: caseRecord.id,
                        caseNumber: caseRecord.caseNumber,
                        employeeId: nte.employeeId,
                        employeeName,
                        violationType: caseRecord.violationType,
                        submittedByEmployeeId: submittedBy,
                    });
                }
            },

            markNoResponse: (nteId) => {
                const nte = get().ntes.find((n) => n.id === nteId);
                if (!nte) return;
                // Optimistic update
                set((s) => ({
                    ntes: s.ntes.map((n) => (n.id === nteId ? { ...n, status: "no_response", updatedAt: nowIso() } : n)),
                    cases: setCaseStatus(s.cases, nte.caseId, "no_response"),
                }));
                // Persist case status to DB
                (async () => {
                    const caseRec = get().cases.find((c) => c.id === nte.caseId);
                    if (!caseRec) return;
                    const updated = { ...caseRec, status: "no_response" as const, updatedAt: nowIso() };
                    try {
                        const ok = await disciplinaryDb.upsertCase(updated);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        // Rollback on failure
                        set((s) => ({
                            cases: setCaseStatus(s.cases, nte.caseId, caseRec.status),
                        }));
                        toast.error("Failed to mark no response");
                    }
                })();
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: nte.caseId,
                    action: "no_response_marked",
                    performedBy: "system",
                });
            },

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
                        cases: s.cases.map((cs) =>
                            cs.id === caseId
                                ? {
                                      ...cs,
                                      status: nextCaseStatus,
                                      result: data.decision === "no_violation" ? "DISMISSED" : cs.result,
                                      updatedAt: nowIso(),
                                  }
                                : cs
                        ),
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
                // Notify the employee about the NOD
                try {
                    const emp = useEmployeesStore.getState().employees.find((e) => e.id === c.employeeId);
                    if (emp) {
                        const decisionLabel = data.decision.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        dispatchNotification("nod_issued", {
                            name: emp.name,
                            caseNumber: c.caseNumber,
                            decision: decisionLabel,
                        }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
                    }
                } catch { /* notification is best-effort */ }
                return nod;
            },

            acknowledgeNOD: (nodId) => {
                const nod = get().nods.find((n) => n.id === nodId);
                if (!nod) return;
                const prevCase = get().cases.find((c) => c.id === nod.caseId);
                const ack = nowIso();
                const isSanction = ["suspension", "salary_deduction", "training_required", "pip"].includes(nod.decision);
                const nextStatus: DisciplinaryCaseStatus = isSanction ? "sanction_active" : "nod_acknowledged";
                const nextResult = (nod.decision === "verbal_warning" ? "VERBAL_WARNING" : nod.decision === "written_warning" ? "WRITTEN_WARNING" : nod.decision === "final_warning" ? "FINAL_WARNING" : nod.decision === "termination" ? "TERMINATION" : prevCase?.result) ?? prevCase?.result;

                set((s) => ({
                    nods: s.nods.map((n) => n.id === nodId ? { ...n, status: isSanction ? "sanction_active" : "acknowledged", acknowledgedAt: ack, updatedAt: ack } : n),
                    cases: s.cases.map((c) => c.id === nod.caseId ? { ...c, status: nextStatus, result: nextResult, updatedAt: ack } : c),
                }));

                (async () => {
                    const c = get().cases.find((c) => c.id === nod.caseId);
                    if (!c) return;
                    try {
                        const ok = await disciplinaryDb.upsertCase(c);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        set((s) => ({
                            nods: s.nods.map((n) => n.id === nodId ? nod : n),
                            cases: s.cases.map((cs) => cs.id === nod.caseId ? (prevCase ?? cs) : cs),
                        }));
                        toast.error("Failed to acknowledge NOD");
                    }
                })();

                useAuditStore.getState().log({
                    entityType: "disciplinary_case", entityId: nod.caseId, action: "nod_acknowledged", performedBy: nod.employeeId,
                });
            },

            // ── Notes & Sanction lifecycle ────────────────────
            addNote: (caseId, body, authorId) => {
                if (!body || !body.trim()) {
                    toast.error("Note cannot be empty");
                    throw new Error("Note cannot be empty");
                }
                const note: DisciplinaryNote = {
                    id: `NOTE-${nanoid(8)}`,
                    caseId,
                    authorId,
                    body: body.trim(),
                    createdAt: nowIso(),
                };

                // Optimistic update
                set((s) => ({ notes: [...s.notes, note] }));

                // Write through to DB
                (async () => {
                    try {
                        const ok = await disciplinaryDb.upsertNote(note);
                        if (!ok) throw new Error("DB write failed");
                    } catch {
                        // Rollback on DB failure
                        set((s) => ({ notes: s.notes.filter((n) => n.id !== note.id) }));
                        toast.error("Failed to save note");
                    }
                })();

                return note;
            },

            completeSanction: async (caseId, result, by) => {
                const prev = get().cases.find((c) => c.id === caseId);
                if (!prev) return;

                const updated: DisciplinaryCase = {
                    ...prev,
                    status: "closed",
                    result,
                    updatedAt: nowIso(),
                };

                // Optimistic update
                set((s) => ({
                    cases: s.cases.map((c) => (c.id === caseId ? updated : c)),
                }));

                // DB write
                try {
                    const ok = await disciplinaryDb.upsertCase(updated);
                    if (!ok) throw new Error("DB write failed");
                } catch {
                    // Rollback
                    set((s) => ({
                        cases: s.cases.map((c) => (c.id === caseId ? prev : c)),
                    }));
                    toast.error("Failed to close case — please try again");
                    return;
                }

                // Audit log
                useAuditStore.getState().log({
                    entityType: "disciplinary_case",
                    entityId: caseId,
                    action: "sanction_completed",
                    performedBy: by,
                    afterSnapshot: { status: "closed", result },
                });
            },

            // ── Selectors ──────────────────────────────────────
            getCase: (caseId) => get().cases.find((c) => c.id === caseId),
            getNotesByCase: (caseId) => get().notes.filter((n) => n.caseId === caseId),
            getNTEByCase: (caseId) => get().ntes.find((n) => n.caseId === caseId),
            getNODByCase: (caseId) => get().nods.find((n) => n.caseId === caseId),
            getByEmployee: (employeeId) => get().cases.filter((c) => c.employeeId === employeeId),
            getOpenCases: () => get().cases.filter((c) => c.status !== "closed"),

            getDashboardStats: () => {
                const cases = get().cases;
                return {
                    open: cases.filter((c) => c.status === "open").length,
                    awaitingExplanation: cases.filter((c) => c.status === "nte_issued" || c.status === "nte_acknowledged").length,
                    forReview: cases.filter((c) => c.status === "explanation_submitted" || c.status === "no_response" || c.status === "under_review").length,
                    nodPending: cases.filter((c) => c.status === "nod_issued").length,
                    suspensionsActive: cases.filter((c) => c.status === "sanction_active").length,
                    closed: cases.filter((c) => c.status === "closed" || c.status === "nod_acknowledged").length,
                    total: cases.length,
                };
            },

        resetToSeed: () => set({ cases: [], ntes: [], nods: [], notes: [] }),

        setCases: (c) => set({ cases: c }),
        setNTEs: (n) => set({ ntes: n }),
        setNODs: (n) => set({ nods: n }),
        setNotes: (n) => set({ notes: n }),
    }),
);
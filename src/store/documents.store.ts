"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type {
    Employee201Document,
    Employee201DocType,
    Document201Status,
    Document201Visibility,
} from "@/types";
import { useAuditStore } from "./audit.store";

/** Required document types every employee should have on file. */
export const REQUIRED_201_DOC_TYPES: Employee201DocType[] = [
    "employment_contract",
    "government_id",
    "resume",
    "application_form",
    "medical",
];

interface DocumentsState {
    documents: Employee201Document[];

    upload: (data: Omit<Employee201Document, "id" | "createdAt" | "updatedAt" | "status"> & { status?: Document201Status }) => Employee201Document;
    approve: (id: string, reviewerId: string, remarks?: string) => void;
    reject: (id: string, reviewerId: string, remarks: string) => void;
    archive: (id: string, by: string) => void;
    remove: (id: string) => void;
    setVisibility: (id: string, visibility: Document201Visibility) => void;
    setExpiry: (id: string, date: string) => void;
    attachToCase: (docId: string, caseId: string) => void;

    getById: (id: string) => Employee201Document | undefined;
    getByEmployee: (employeeId: string) => Employee201Document[];
    getByType: (type: Employee201DocType) => Employee201Document[];
    getMissingForEmployee: (employeeId: string) => Employee201DocType[];
    getCompletenessForEmployee: (employeeId: string) => number; // 0..1
    getExpiring: (daysAhead?: number) => Employee201Document[];
    getStats: () => {
        total: number;
        forReview: number;
        approved: number;
        rejected: number;
        expiring30: number;
    };

    resetToSeed: () => void;
}

function nowIso() {
    return new Date().toISOString();
}

export const useDocumentsStore = create<DocumentsState>()(
    persist(
        (set, get) => ({
            documents: [],

            upload: (data) => {
                const doc: Employee201Document = {
                    id: `DOC-${nanoid(8)}`,
                    status: data.status ?? "uploaded",
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                    ...data,
                };
                set((s) => ({ documents: [doc, ...s.documents] }));
                useAuditStore.getState().log({
                    entityType: "document",
                    entityId: doc.id,
                    action: "doc_uploaded",
                    performedBy: data.uploadedBy ?? "system",
                    afterSnapshot: { type: doc.documentType, title: doc.documentTitle, employeeId: doc.employeeId },
                });
                return doc;
            },

            approve: (id, reviewerId, remarks) =>
                set((s) => ({
                    documents: s.documents.map((d) => {
                        if (d.id !== id) return d;
                        useAuditStore.getState().log({
                            entityType: "document",
                            entityId: id,
                            action: "doc_approved",
                            performedBy: reviewerId,
                            beforeSnapshot: { status: d.status },
                            afterSnapshot: { status: "approved", remarks },
                        });
                        return { ...d, status: "approved", reviewedBy: reviewerId, reviewedAt: nowIso(), remarks: remarks ?? d.remarks, updatedAt: nowIso() };
                    }),
                })),

            reject: (id, reviewerId, remarks) =>
                set((s) => ({
                    documents: s.documents.map((d) => {
                        if (d.id !== id) return d;
                        useAuditStore.getState().log({
                            entityType: "document",
                            entityId: id,
                            action: "doc_rejected",
                            performedBy: reviewerId,
                            beforeSnapshot: { status: d.status },
                            afterSnapshot: { status: "rejected", remarks },
                        });
                        return { ...d, status: "rejected", reviewedBy: reviewerId, reviewedAt: nowIso(), remarks, updatedAt: nowIso() };
                    }),
                })),

            archive: (id, by) =>
                set((s) => ({
                    documents: s.documents.map((d) => {
                        if (d.id !== id) return d;
                        useAuditStore.getState().log({
                            entityType: "document", entityId: id, action: "doc_archived", performedBy: by,
                        });
                        return { ...d, status: "archived", updatedAt: nowIso() };
                    }),
                })),

            remove: (id) =>
                set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

            setVisibility: (id, visibility) =>
                set((s) => ({
                    documents: s.documents.map((d) =>
                        d.id === id ? { ...d, visibility, updatedAt: nowIso() } : d
                    ),
                })),

            setExpiry: (id, date) =>
                set((s) => ({
                    documents: s.documents.map((d) =>
                        d.id === id ? { ...d, expiryDate: date, updatedAt: nowIso() } : d
                    ),
                })),

            attachToCase: (docId, caseId) =>
                set((s) => ({
                    documents: s.documents.map((d) =>
                        d.id === docId ? { ...d, caseId, updatedAt: nowIso() } : d
                    ),
                })),

            getById: (id) => get().documents.find((d) => d.id === id),

            getByEmployee: (employeeId) =>
                get().documents.filter((d) => d.employeeId === employeeId && d.status !== "archived"),

            getByType: (type) =>
                get().documents.filter((d) => d.documentType === type && d.status !== "archived"),

            getMissingForEmployee: (employeeId) => {
                const present = new Set(
                    get()
                        .documents
                        .filter((d) => d.employeeId === employeeId && d.status === "approved")
                        .map((d) => d.documentType)
                );
                return REQUIRED_201_DOC_TYPES.filter((t) => !present.has(t));
            },

            getCompletenessForEmployee: (employeeId) => {
                const missing = get().getMissingForEmployee(employeeId).length;
                return 1 - missing / REQUIRED_201_DOC_TYPES.length;
            },

            getExpiring: (daysAhead = 30) => {
                const now = Date.now();
                const cutoff = now + daysAhead * 86_400_000;
                return get().documents.filter((d) => {
                    if (!d.expiryDate || d.status === "archived" || d.status === "expired") return false;
                    const t = Date.parse(d.expiryDate);
                    return Number.isFinite(t) && t >= now && t <= cutoff;
                });
            },

            getStats: () => {
                const docs = get().documents;
                const expiring30 = get().getExpiring(30).length;
                return {
                    total: docs.filter((d) => d.status !== "archived").length,
                    forReview: docs.filter((d) => d.status === "for_review").length,
                    approved: docs.filter((d) => d.status === "approved").length,
                    rejected: docs.filter((d) => d.status === "rejected").length,
                    expiring30,
                };
            },

            resetToSeed: () => set({ documents: [] }),
        }),
        { name: "soren-documents", version: 1, storage: safePersistStorage }
    )
);

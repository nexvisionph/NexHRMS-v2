"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";

// ─── Document Types ──────────────────────────────────────────

export type DocumentType =
  | "personal_info"
  | "employment_contract"
  | "government_id"
  | "resume"
  | "application_form"
  | "job_offer"
  | "medical"
  | "training_certificate"
  | "performance_evaluation"
  | "payslip"
  | "leave_record"
  | "warning"
  | "nte"
  | "nod"
  | "clearance"
  | "resignation_letter"
  | "coe"
  | "final_pay_document"
  | "other";

export type DocumentStatus =
  | "pending_upload"
  | "uploaded"
  | "for_review"
  | "approved"
  | "rejected"
  | "expired"
  | "archived";

export type DocumentVisibility =
  | "hr_only"
  | "manager"
  | "employee"
  | "payroll"
  | "admin_only";

export interface Employee201Document {
  id: string;
  employeeId: string;
  documentType: DocumentType;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  expiryDate?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  version: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Required documents for gap analysis
export const REQUIRED_DOCUMENTS: DocumentType[] = [
  "employment_contract",
  "government_id",
  "resume",
  "application_form",
  "medical",
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  personal_info: "Personal Information",
  employment_contract: "Employment Contract",
  government_id: "Government ID",
  resume: "Resume / CV",
  application_form: "Application Form",
  job_offer: "Job Offer Letter",
  medical: "Medical Certificate",
  training_certificate: "Training Certificate",
  performance_evaluation: "Performance Evaluation",
  payslip: "Payslip",
  leave_record: "Leave Record",
  warning: "Warning Letter",
  nte: "Notice to Explain (NTE)",
  nod: "Notice of Decision (NOD)",
  clearance: "Clearance Form",
  resignation_letter: "Resignation Letter",
  coe: "Certificate of Employment",
  final_pay_document: "Final Pay Document",
  other: "Other",
};

export interface DocumentGap {
  employeeId: string;
  employeeName: string;
  missingDocuments: DocumentType[];
  expiringDocuments: Employee201Document[];
}

interface DocumentsState {
  documents: Employee201Document[];

  // CRUD
  addDocument: (doc: Omit<Employee201Document, "id" | "createdAt" | "updatedAt" | "version">) => void;
  updateDocument: (id: string, patch: Partial<Employee201Document>) => void;
  deleteDocument: (id: string) => void;

  // Status transitions
  submitForReview: (id: string) => void;
  approveDocument: (id: string, reviewedBy: string) => void;
  rejectDocument: (id: string, reviewedBy: string, reason: string) => void;
  archiveDocument: (id: string) => void;
  markExpired: (id: string) => void;

  // Queries
  getByEmployee: (employeeId: string) => Employee201Document[];
  getByType: (employeeId: string, docType: DocumentType) => Employee201Document[];
  getMissingDocuments: (employeeId: string) => DocumentType[];
  getExpiringDocuments: (daysAhead?: number) => Employee201Document[];
  getGapAnalysis: (employees: { id: string; name: string }[]) => DocumentGap[];
}

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set, get) => ({
      documents: [],

      addDocument: (doc) =>
        set((s) => ({
          documents: [
            ...s.documents,
            {
              ...doc,
              id: nanoid(),
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),

      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
          ),
        })),

      deleteDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      submitForReview: (id) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, status: "for_review" as DocumentStatus, updatedAt: new Date().toISOString() } : d
          ),
        })),

      approveDocument: (id, reviewedBy) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id
              ? { ...d, status: "approved" as DocumentStatus, reviewedBy, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      rejectDocument: (id, reviewedBy, reason) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id
              ? { ...d, status: "rejected" as DocumentStatus, reviewedBy, reviewedAt: new Date().toISOString(), rejectionReason: reason, updatedAt: new Date().toISOString() }
              : d
          ),
        })),

      archiveDocument: (id) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, status: "archived" as DocumentStatus, updatedAt: new Date().toISOString() } : d
          ),
        })),

      markExpired: (id) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, status: "expired" as DocumentStatus, updatedAt: new Date().toISOString() } : d
          ),
        })),

      getByEmployee: (employeeId) =>
        get().documents.filter((d) => d.employeeId === employeeId),

      getByType: (employeeId, docType) =>
        get().documents.filter((d) => d.employeeId === employeeId && d.documentType === docType),

      getMissingDocuments: (employeeId) => {
        const docs = get().documents.filter((d) => d.employeeId === employeeId);
        return REQUIRED_DOCUMENTS.filter(
          (reqType) => !docs.some((d) => d.documentType === reqType && d.status !== "rejected" && d.status !== "expired")
        );
      },

      getExpiringDocuments: (daysAhead = 30) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);
        return get().documents.filter(
          (d) => d.expiryDate && new Date(d.expiryDate) <= cutoff && d.status === "approved"
        );
      },

      getGapAnalysis: (employees) =>
        employees.map((emp) => ({
          employeeId: emp.id,
          employeeName: emp.name,
          missingDocuments: get().getMissingDocuments(emp.id),
          expiringDocuments: get().getExpiringDocuments(30).filter((d) => d.employeeId === emp.id),
        })).filter((g) => g.missingDocuments.length > 0 || g.expiringDocuments.length > 0),
    }),
    {
      name: "nexhrms-documents",
      storage: safePersistStorage,
    }
  )
);

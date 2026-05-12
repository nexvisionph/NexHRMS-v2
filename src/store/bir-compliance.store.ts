"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";

// ─── BIR Types ───────────────────────────────────────────────

export type BIRFormType = "2316" | "1601C" | "1604CF" | "alphalist";
export type BIRFilingStatus = "draft" | "generated" | "filed" | "amended";
export type TaxCategory = "compensation" | "business" | "mixed" | "exempt";

export interface BIRTaxRule {
  id: string;
  name: string;
  effectiveYear: number;
  brackets: TaxBracket[];
  isActive: boolean;
  createdAt: string;
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  fixedAmount: number;
}

export interface BIRFiling {
  id: string;
  formType: BIRFormType;
  period: string; // "2026-Q1", "2026-12", "2026"
  status: BIRFilingStatus;
  generatedAt?: string;
  filedAt?: string;
  generatedBy?: string;
  employeeCount: number;
  totalCompensation: number;
  totalTaxWithheld: number;
  fileUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Form2316Data {
  id: string;
  employeeId: string;
  employeeName: string;
  tin: string;
  year: number;
  employer: {
    name: string;
    tin: string;
    address: string;
    zipCode: string;
  };
  compensation: {
    basicSalary: number;
    thirteenthMonth: number;
    otherBenefits: number;
    totalCompensation: number;
    nonTaxableIncome: number;
    taxableIncome: number;
  };
  deductions: {
    sss: number;
    philhealth: number;
    pagibig: number;
    totalDeductions: number;
  };
  tax: {
    taxDue: number;
    taxWithheld: number;
    overUnderWithholding: number;
  };
  status: BIRFilingStatus;
  generatedAt: string;
}

export interface AlphalistEntry {
  employeeId: string;
  employeeName: string;
  tin: string;
  registeredAddress?: string;
  zipCode?: string;
  birthday?: string;
  totalCompensation: number;
  nonTaxableIncome: number;
  taxableIncome: number;
  taxWithheld: number;
  taxCategory: TaxCategory;
}

export interface BIRAnomaly {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "missing_tin" | "tax_mismatch" | "under_withholding" | "over_withholding" | "missing_2316" | "compensation_mismatch";
  description: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

interface BIRComplianceState {
  taxRules: BIRTaxRule[];
  filings: BIRFiling[];
  form2316Records: Form2316Data[];
  anomalies: BIRAnomaly[];

  // Tax Rules
  addTaxRule: (rule: Omit<BIRTaxRule, "id" | "createdAt">) => void;
  updateTaxRule: (id: string, patch: Partial<BIRTaxRule>) => void;
  getActiveTaxRule: (year: number) => BIRTaxRule | undefined;

  // Filings
  createFiling: (data: Omit<BIRFiling, "id" | "createdAt" | "updatedAt">) => void;
  updateFiling: (id: string, patch: Partial<BIRFiling>) => void;
  markFiled: (id: string) => void;

  // Form 2316
  addForm2316: (data: Omit<Form2316Data, "id" | "generatedAt">) => void;
  getForm2316ByEmployee: (employeeId: string, year: number) => Form2316Data | undefined;

  // Anomalies
  addAnomaly: (data: Omit<BIRAnomaly, "id" | "createdAt" | "resolved">) => void;
  resolveAnomaly: (id: string, resolvedBy: string) => void;
  getUnresolvedAnomalies: () => BIRAnomaly[];

  // Queries
  getFilingsByYear: (year: number) => BIRFiling[];
  getFilingsByType: (formType: BIRFormType) => BIRFiling[];
}

// Default TRAIN Law brackets (2026)
const DEFAULT_TRAIN_BRACKETS: TaxBracket[] = [
  { min: 0, max: 250000, rate: 0, fixedAmount: 0 },
  { min: 250001, max: 400000, rate: 0.15, fixedAmount: 0 },
  { min: 400001, max: 800000, rate: 0.20, fixedAmount: 22500 },
  { min: 800001, max: 2000000, rate: 0.25, fixedAmount: 102500 },
  { min: 2000001, max: 8000000, rate: 0.30, fixedAmount: 402500 },
  { min: 8000001, max: Infinity, rate: 0.35, fixedAmount: 2202500 },
];

export const useBIRComplianceStore = create<BIRComplianceState>()(
  persist(
    (set, get) => ({
      taxRules: [
        {
          id: "train-2026",
          name: "TRAIN Law 2026",
          effectiveYear: 2026,
          brackets: DEFAULT_TRAIN_BRACKETS,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      filings: [],
      form2316Records: [],
      anomalies: [],

      addTaxRule: (rule) =>
        set((s) => ({
          taxRules: [...s.taxRules, { ...rule, id: nanoid(), createdAt: new Date().toISOString() }],
        })),

      updateTaxRule: (id, patch) =>
        set((s) => ({
          taxRules: s.taxRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      getActiveTaxRule: (year) =>
        get().taxRules.find((r) => r.effectiveYear === year && r.isActive),

      createFiling: (data) =>
        set((s) => ({
          filings: [...s.filings, { ...data, id: nanoid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        })),

      updateFiling: (id, patch) =>
        set((s) => ({
          filings: s.filings.map((f) =>
            f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f
          ),
        })),

      markFiled: (id) =>
        set((s) => ({
          filings: s.filings.map((f) =>
            f.id === id ? { ...f, status: "filed" as BIRFilingStatus, filedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : f
          ),
        })),

      addForm2316: (data) =>
        set((s) => ({
          form2316Records: [...s.form2316Records, { ...data, id: nanoid(), generatedAt: new Date().toISOString() }],
        })),

      getForm2316ByEmployee: (employeeId, year) =>
        get().form2316Records.find((f) => f.employeeId === employeeId && f.year === year),

      addAnomaly: (data) =>
        set((s) => ({
          anomalies: [...s.anomalies, { ...data, id: nanoid(), resolved: false, createdAt: new Date().toISOString() }],
        })),

      resolveAnomaly: (id, resolvedBy) =>
        set((s) => ({
          anomalies: s.anomalies.map((a) =>
            a.id === id ? { ...a, resolved: true, resolvedBy, resolvedAt: new Date().toISOString() } : a
          ),
        })),

      getUnresolvedAnomalies: () => get().anomalies.filter((a) => !a.resolved),

      getFilingsByYear: (year) =>
        get().filings.filter((f) => f.period.startsWith(String(year))),

      getFilingsByType: (formType) =>
        get().filings.filter((f) => f.formType === formType),
    }),
    {
      name: "nexhrms-bir-compliance",
      storage: safePersistStorage,
    }
  )
);

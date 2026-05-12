/**
 * BIR Compliance Store
 *
 * Manages tax profiles, annual tax summaries, previous-employer records,
 * Form 2316 records, and Alphalist exports for the BIR Compliance Engine
 * (per bir_alphalist.md plan + migration 056).
 *
 * Persisted via Zustand with the same `safePersistStorage` pattern used by
 * the rest of the app stores. Server is the source of truth — these are
 * cached for fast UI rendering.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import type {
    EmployeeTaxProfile,
    AnnualTaxSummary,
    PreviousEmployerRecord,
    Form2316Record,
    AlphalistExport,
    BIRValidationIssue,
    AnnualTaxStatus,
    Form2316Status,
} from "@/types";

interface BIRComplianceState {
    // ── Cached data (server is source of truth) ──────────────
    taxProfiles: EmployeeTaxProfile[];
    annualSummaries: AnnualTaxSummary[];
    previousEmployerRecords: PreviousEmployerRecord[];
    form2316Records: Form2316Record[];
    alphalistExports: AlphalistExport[];
    lastValidationIssues: BIRValidationIssue[];

    // ── Selectors ────────────────────────────────────────────
    getProfileFor: (employeeId: string) => EmployeeTaxProfile | undefined;
    getSummary: (employeeId: string, year: number) => AnnualTaxSummary | undefined;
    getSummariesForYear: (year: number) => AnnualTaxSummary[];
    getPrevEmployerRecords: (employeeId: string, year: number) => PreviousEmployerRecord[];
    getForm2316: (employeeId: string, year: number) => Form2316Record | undefined;
    getAlphalistExports: (year?: number) => AlphalistExport[];

    // ── Tax profile mutations ────────────────────────────────
    setTaxProfiles: (rows: EmployeeTaxProfile[]) => void;
    upsertTaxProfile: (profile: EmployeeTaxProfile) => void;
    removeTaxProfile: (id: string) => void;

    // ── Annual summary mutations ─────────────────────────────
    setAnnualSummaries: (rows: AnnualTaxSummary[]) => void;
    upsertAnnualSummary: (summary: AnnualTaxSummary) => void;
    setAnnualSummaryStatus: (id: string, status: AnnualTaxStatus, finalizedBy?: string) => void;

    // ── Previous-employer records ────────────────────────────
    setPreviousEmployerRecords: (rows: PreviousEmployerRecord[]) => void;
    addPreviousEmployerRecord: (record: PreviousEmployerRecord) => void;
    removePreviousEmployerRecord: (id: string) => void;

    // ── Form 2316 ────────────────────────────────────────────
    setForm2316Records: (rows: Form2316Record[]) => void;
    upsertForm2316: (record: Form2316Record) => void;
    setForm2316Status: (id: string, status: Form2316Status) => void;

    // ── Alphalist exports ────────────────────────────────────
    setAlphalistExports: (rows: AlphalistExport[]) => void;
    addAlphalistExport: (record: AlphalistExport) => void;

    // ── Validation cache ─────────────────────────────────────
    setValidationIssues: (issues: BIRValidationIssue[]) => void;

    // ── Reset ────────────────────────────────────────────────
    clearAll: () => void;
}

export const useBIRComplianceStore = create<BIRComplianceState>()(
    persist(
        (set, get) => ({
            taxProfiles: [],
            annualSummaries: [],
            previousEmployerRecords: [],
            form2316Records: [],
            alphalistExports: [],
            lastValidationIssues: [],

            // ── Selectors ────────────────────────────────────
            getProfileFor: (employeeId) =>
                get().taxProfiles.find((p) => p.employeeId === employeeId),

            getSummary: (employeeId, year) =>
                get().annualSummaries.find(
                    (s) => s.employeeId === employeeId && s.year === year,
                ),

            getSummariesForYear: (year) =>
                get().annualSummaries.filter((s) => s.year === year),

            getPrevEmployerRecords: (employeeId, year) =>
                get().previousEmployerRecords.filter(
                    (r) => r.employeeId === employeeId && r.year === year,
                ),

            getForm2316: (employeeId, year) =>
                get().form2316Records.find(
                    (r) => r.employeeId === employeeId && r.year === year,
                ),

            getAlphalistExports: (year) =>
                year === undefined
                    ? get().alphalistExports
                    : get().alphalistExports.filter((e) => e.year === year),

            // ── Tax profiles ─────────────────────────────────
            setTaxProfiles: (rows) => set({ taxProfiles: rows }),

            upsertTaxProfile: (profile) =>
                set((s) => {
                    const idx = s.taxProfiles.findIndex(
                        (p) => p.id === profile.id || p.employeeId === profile.employeeId,
                    );
                    if (idx === -1) return { taxProfiles: [...s.taxProfiles, profile] };
                    const next = [...s.taxProfiles];
                    next[idx] = profile;
                    return { taxProfiles: next };
                }),

            removeTaxProfile: (id) =>
                set((s) => ({ taxProfiles: s.taxProfiles.filter((p) => p.id !== id) })),

            // ── Annual summaries ─────────────────────────────
            setAnnualSummaries: (rows) => set({ annualSummaries: rows }),

            upsertAnnualSummary: (summary) =>
                set((s) => {
                    // Once finalized → immutable. Reject overwrite.
                    const existing = s.annualSummaries.find((x) => x.id === summary.id);
                    if (
                        existing &&
                        (existing.status === "finalized" || existing.status === "exported") &&
                        existing.id === summary.id
                    ) {
                        return s;
                    }
                    const idx = s.annualSummaries.findIndex(
                        (x) =>
                            x.id === summary.id ||
                            (x.employeeId === summary.employeeId && x.year === summary.year),
                    );
                    if (idx === -1)
                        return { annualSummaries: [...s.annualSummaries, summary] };
                    const next = [...s.annualSummaries];
                    next[idx] = summary;
                    return { annualSummaries: next };
                }),

            setAnnualSummaryStatus: (id, status, finalizedBy) =>
                set((s) => ({
                    annualSummaries: s.annualSummaries.map((x) =>
                        x.id === id
                            ? {
                                  ...x,
                                  status,
                                  finalizedAt:
                                      status === "finalized"
                                          ? new Date().toISOString()
                                          : x.finalizedAt,
                                  finalizedBy:
                                      status === "finalized" ? finalizedBy : x.finalizedBy,
                                  updatedAt: new Date().toISOString(),
                              }
                            : x,
                    ),
                })),

            // ── Prev employer ────────────────────────────────
            setPreviousEmployerRecords: (rows) =>
                set({ previousEmployerRecords: rows }),

            addPreviousEmployerRecord: (record) =>
                set((s) => ({
                    previousEmployerRecords: [
                        ...s.previousEmployerRecords.filter(
                            (r) =>
                                !(
                                    r.employeeId === record.employeeId &&
                                    r.year === record.year &&
                                    r.id === record.id
                                ),
                        ),
                        record,
                    ],
                })),

            removePreviousEmployerRecord: (id) =>
                set((s) => ({
                    previousEmployerRecords: s.previousEmployerRecords.filter(
                        (r) => r.id !== id,
                    ),
                })),

            // ── Form 2316 ────────────────────────────────────
            setForm2316Records: (rows) => set({ form2316Records: rows }),

            upsertForm2316: (record) =>
                set((s) => {
                    const idx = s.form2316Records.findIndex((r) => r.id === record.id);
                    if (idx === -1)
                        return { form2316Records: [...s.form2316Records, record] };
                    const next = [...s.form2316Records];
                    next[idx] = record;
                    return { form2316Records: next };
                }),

            setForm2316Status: (id, status) =>
                set((s) => ({
                    form2316Records: s.form2316Records.map((r) =>
                        r.id === id
                            ? {
                                  ...r,
                                  status,
                                  releasedAt:
                                      status === "released" && !r.releasedAt
                                          ? new Date().toISOString()
                                          : r.releasedAt,
                                  downloadedAt:
                                      status === "downloaded"
                                          ? new Date().toISOString()
                                          : r.downloadedAt,
                              }
                            : r,
                    ),
                })),

            // ── Alphalist ────────────────────────────────────
            setAlphalistExports: (rows) => set({ alphalistExports: rows }),

            addAlphalistExport: (record) =>
                set((s) => ({ alphalistExports: [record, ...s.alphalistExports] })),

            // ── Validation ───────────────────────────────────
            setValidationIssues: (issues) => set({ lastValidationIssues: issues }),

            // ── Reset ────────────────────────────────────────
            clearAll: () =>
                set({
                    taxProfiles: [],
                    annualSummaries: [],
                    previousEmployerRecords: [],
                    form2316Records: [],
                    alphalistExports: [],
                    lastValidationIssues: [],
                }),
        }),
        {
            name: "nexhrms-bir-compliance",
            version: 1,
            storage: safePersistStorage,
        },
    ),
);

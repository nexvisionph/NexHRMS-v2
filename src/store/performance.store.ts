"use client";

import { create } from "zustand";
import type {
  PerformanceCycle,
  PerformanceCriterion,
  PerformanceReview,
  PerformanceSalaryAdjustment,
  PerformanceAuditLog,
  PerformanceSalaryBand,
  PerformanceCycleStatus,
  ReviewStatus,
  SalaryAdjustmentStatus,
} from "@/types";

interface PerformanceState {
  // Data
  cycles: PerformanceCycle[];
  criteria: PerformanceCriterion[];
  salaryBands: PerformanceSalaryBand[];
  reviews: PerformanceReview[];
  adjustments: PerformanceSalaryAdjustment[];
  auditLogs: PerformanceAuditLog[];

  // Filters & UI state
  activeCycleId?: string;
  selectedReviewId?: string;
  filterStatus?: ReviewStatus | "all";
  isLoading: boolean;
  error?: string;

  // Actions - Cycles
  setCycles: (cycles: PerformanceCycle[]) => void;
  addCycle: (cycle: PerformanceCycle) => void;
  updateCycle: (cycleId: string, updates: Partial<PerformanceCycle>) => void;
  setCycleStatus: (cycleId: string, status: PerformanceCycleStatus) => void;
  setActiveCycle: (cycleId?: string) => void;

  // Actions - Criteria
  setCriteria: (criteria: PerformanceCriterion[]) => void;
  addCriterion: (criterion: PerformanceCriterion) => void;
  updateCriterion: (criterionId: string, updates: Partial<PerformanceCriterion>) => void;

  // Actions - Salary Bands
  setSalaryBands: (bands: PerformanceSalaryBand[]) => void;
  addSalaryBand: (band: PerformanceSalaryBand) => void;
  updateSalaryBand: (bandId: string, updates: Partial<PerformanceSalaryBand>) => void;

  // Actions - Reviews
  setReviews: (reviews: PerformanceReview[]) => void;
  addReview: (review: PerformanceReview) => void;
  updateReview: (reviewId: string, updates: Partial<PerformanceReview>) => void;
  updateReviewStatus: (reviewId: string, status: ReviewStatus) => void;
  setSelectedReview: (reviewId?: string) => void;

  // Actions - Adjustments
  setAdjustments: (adjustments: PerformanceSalaryAdjustment[]) => void;
  addAdjustment: (adjustment: PerformanceSalaryAdjustment) => void;
  updateAdjustment: (adjustmentId: string, updates: Partial<PerformanceSalaryAdjustment>) => void;
  updateAdjustmentStatus: (adjustmentId: string, status: SalaryAdjustmentStatus) => void;

  // Actions - Audit Logs
  setAuditLogs: (logs: PerformanceAuditLog[]) => void;
  addAuditLog: (log: PerformanceAuditLog) => void;

  // Actions - UI
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  setFilterStatus: (status?: ReviewStatus | "all") => void;
  reset: () => void;
}

const initialState = {
  cycles: [],
  criteria: [],
  salaryBands: [],
  reviews: [],
  adjustments: [],
  auditLogs: [],
  isLoading: false,
};

export const usePerformanceStore = create<PerformanceState>()(
    (set) => ({
      ...initialState,

      // Cycles
      setCycles: (cycles) => set({ cycles }),
      addCycle: (cycle) => set((state) => ({ cycles: [...state.cycles, cycle] })),
      updateCycle: (cycleId, updates) =>
        set((state) => ({
          cycles: state.cycles.map((c) => (c.id === cycleId ? { ...c, ...updates } : c)),
        })),
      setCycleStatus: (cycleId, status) =>
        set((state) => ({
          cycles: state.cycles.map((c) =>
            c.id === cycleId ? { ...c, status, updated_at: new Date().toISOString() } : c
          ),
        })),
      setActiveCycle: (cycleId) => set({ activeCycleId: cycleId }),

      // Criteria
      setCriteria: (criteria) => set({ criteria }),
      addCriterion: (criterion) => set((state) => ({ criteria: [...state.criteria, criterion] })),
      updateCriterion: (criterionId, updates) =>
        set((state) => ({
          criteria: state.criteria.map((c) => (c.id === criterionId ? { ...c, ...updates } : c)),
        })),

      // Salary Bands
      setSalaryBands: (bands) => set({ salaryBands: bands }),
      addSalaryBand: (band) => set((state) => ({ salaryBands: [...state.salaryBands, band] })),
      updateSalaryBand: (bandId, updates) =>
        set((state) => ({
          salaryBands: state.salaryBands.map((b) =>
            b.id === bandId ? { ...b, ...updates } : b
          ),
        })),

      // Reviews
      setReviews: (reviews) => set({ reviews }),
      addReview: (review) => set((state) => ({ reviews: [...state.reviews, review] })),
      updateReview: (reviewId, updates) =>
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === reviewId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
          ),
        })),
      updateReviewStatus: (reviewId, status) =>
        set((state) => ({
          reviews: state.reviews.map((r) =>
            r.id === reviewId ? { ...r, status, updated_at: new Date().toISOString() } : r
          ),
        })),
      setSelectedReview: (reviewId) => set({ selectedReviewId: reviewId }),

      // Adjustments
      setAdjustments: (adjustments) => set({ adjustments }),
      addAdjustment: (adjustment) => set((state) => ({ adjustments: [...state.adjustments, adjustment] })),
      updateAdjustment: (adjustmentId, updates) =>
        set((state) => ({
          adjustments: state.adjustments.map((a) =>
            a.id === adjustmentId ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
          ),
        })),
      updateAdjustmentStatus: (adjustmentId, status) =>
        set((state) => ({
          adjustments: state.adjustments.map((a) =>
            a.id === adjustmentId ? { ...a, status, updated_at: new Date().toISOString() } : a
          ),
        })),

      // Audit Logs
      setAuditLogs: (logs) => set({ auditLogs: logs }),
      addAuditLog: (log) => set((state) => ({ auditLogs: [...state.auditLogs, log] })),

      // UI
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setFilterStatus: (status) => set({ filterStatus: status }),

      // Reset
      reset: () => set(initialState),
    }),
);

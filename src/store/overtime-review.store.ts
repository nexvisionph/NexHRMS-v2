"use client";
import { create } from "zustand";
import type { OTRecord, OTRecordStatus, OTSettings, OTType } from "@/types";

const DEFAULT_OT_SETTINGS: OTSettings = {
  enableOtReview: true,
  minimumOtMinutes: 30,
  otGracePeriodMinutes: 0,
  requireSupervisorApproval: false,
  allowPartialApproval: true,
  allowPayrollOfficerOverride: true,
  includePendingInPayroll: false,
};

export interface OTReviewFilters {
  periodStart?: string;
  periodEnd?: string;
  department?: string;
  employeeId?: string;
  status?: OTRecordStatus | "all";
  otType?: OTType | "all";
}

interface OTReviewState {
  records: OTRecord[];
  settings: OTSettings;
  isLoading: boolean;
  isSettingsLoading: boolean;
  error: string | null;

  // ─── Actions ──────────────────────────────────────────────
  fetchRecords: (filters?: OTReviewFilters) => Promise<void>;
  computeForPeriod: (periodStart: string, periodEnd: string) => Promise<{ created: number; skipped: number }>;
  approveRecord: (id: string, approvedOtHours: number, remarks?: string, reviewedBy?: string) => Promise<void>;
  rejectRecord: (id: string, remarks?: string, reviewedBy?: string) => Promise<void>;
  batchApprove: (ids: string[], reviewedBy?: string) => Promise<void>;
  batchReject: (ids: string[], remarks?: string, reviewedBy?: string) => Promise<void>;
  lockRecord: (id: string) => Promise<void>;
  markIncludedInPayroll: (ids: string[]) => Promise<void>;

  fetchSettings: () => Promise<void>;
  saveSettings: (settings: OTSettings) => Promise<void>;

  /** Lightweight in-memory filter helper used by the UI */
  getFilteredRecords: (filters: OTReviewFilters) => OTRecord[];

  /** Count pending records for a payroll period — used by payroll guard */
  getPendingCountForPeriod: (periodStart: string, periodEnd: string) => number;
}

function buildPeriodId(start: string, end: string) {
  return `${start}/${end}`;
}

function snakeToCamel(row: Record<string, unknown>): OTRecord {
  return {
    id: row.id as string,
    employeeId: (row.employee_id ?? row.employeeId) as string,
    attendanceId: (row.attendance_id ?? row.attendanceId) as string | undefined,
    payrollPeriodId: (row.payroll_period_id ?? row.payrollPeriodId) as string | undefined,
    otDate: (row.ot_date ?? row.otDate) as string,
    scheduledTimeOut: (row.scheduled_time_out ?? row.scheduledTimeOut) as string | undefined,
    actualTimeOut: (row.actual_time_out ?? row.actualTimeOut) as string | undefined,
    computedOtHours: Number(row.computed_ot_hours ?? row.computedOtHours ?? 0),
    approvedOtHours: row.approved_ot_hours != null
      ? Number(row.approved_ot_hours)
      : row.approvedOtHours != null ? Number(row.approvedOtHours) : undefined,
    otType: (row.ot_type ?? row.otType) as OTType,
    computedAmount: Number(row.computed_amount ?? row.computedAmount ?? 0),
    approvedAmount: row.approved_amount != null
      ? Number(row.approved_amount)
      : row.approvedAmount != null ? Number(row.approvedAmount) : undefined,
    status: (row.status as OTRecordStatus) ?? "pending",
    reviewedBy: (row.reviewed_by ?? row.reviewedBy) as string | undefined,
    reviewedAt: (row.reviewed_at ?? row.reviewedAt) as string | undefined,
    remarks: row.remarks as string | undefined,
    companyId: (row.company_id ?? row.companyId) as string | undefined,
    createdAt: (row.created_at ?? row.createdAt) as string,
    updatedAt: (row.updated_at ?? row.updatedAt) as string,
  };
}

function settingsSnakeToCamel(row: Record<string, unknown>): OTSettings {
  return {
    enableOtReview: Boolean(row.enable_ot_review ?? row.enableOtReview ?? true),
    minimumOtMinutes: Number(row.minimum_ot_minutes ?? row.minimumOtMinutes ?? 30),
    otGracePeriodMinutes: Number(row.ot_grace_period_minutes ?? row.otGracePeriodMinutes ?? 0),
    requireSupervisorApproval: Boolean(row.require_supervisor_approval ?? row.requireSupervisorApproval ?? false),
    allowPartialApproval: Boolean(row.allow_partial_approval ?? row.allowPartialApproval ?? true),
    allowPayrollOfficerOverride: Boolean(row.allow_payroll_officer_override ?? row.allowPayrollOfficerOverride ?? true),
    includePendingInPayroll: Boolean(row.include_pending_in_payroll ?? row.includePendingInPayroll ?? false),
  };
}

export const useOTReviewStore = create<OTReviewState>()((set, get) => ({
  records: [],
  settings: DEFAULT_OT_SETTINGS,
  isLoading: false,
  isSettingsLoading: false,
  error: null,

  fetchRecords: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.periodStart) params.set("periodStart", filters.periodStart);
      if (filters?.periodEnd) params.set("periodEnd", filters.periodEnd);
      if (filters?.department) params.set("department", filters.department);
      if (filters?.employeeId) params.set("employeeId", filters.employeeId);
      if (filters?.status && filters.status !== "all") params.set("status", filters.status);
      if (filters?.otType && filters.otType !== "all") params.set("otType", filters.otType);

      const res = await fetch(`/api/overtime-review?${params.toString()}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const records: OTRecord[] = (data.records ?? []).map((r: Record<string, unknown>) => snakeToCamel(r));
      set({ records, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to fetch OT records" });
    }
  },

  computeForPeriod: async (periodStart, periodEnd) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/overtime-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      if (!res.ok) throw new Error(`Compute failed: ${res.status}`);
      const data = await res.json();
      // Refresh records after compute
      await get().fetchRecords({ periodStart, periodEnd });
      set({ isLoading: false });
      return { created: data.created ?? 0, skipped: data.skipped ?? 0 };
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to compute OT" });
      return { created: 0, skipped: 0 };
    }
  },

  approveRecord: async (id, approvedOtHours, remarks, reviewedBy) => {
    // Optimistic update
    const now = new Date().toISOString();
    set((s) => ({
      records: s.records.map((r) => {
        if (r.id !== id) return r;
        const status = approvedOtHours >= r.computedOtHours - 0.01
          ? "approved"
          : approvedOtHours > 0 ? "partially_approved" : "rejected";
        return { ...r, approvedOtHours, status, remarks: remarks ?? r.remarks, reviewedBy, reviewedAt: now, updatedAt: now };
      }),
    }));
    try {
      const res = await fetch(`/api/overtime-review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", approvedOtHours, remarks, reviewedBy }),
      });
      if (!res.ok) {
        // Revert
        await get().fetchRecords();
        throw new Error("Approval failed");
      }
    } catch (err) {
      console.error("[OTReview] approveRecord error:", err);
    }
  },

  rejectRecord: async (id, remarks, reviewedBy) => {
    const now = new Date().toISOString();
    set((s) => ({
      records: s.records.map((r) =>
        r.id === id
          ? { ...r, status: "rejected", approvedOtHours: 0, approvedAmount: 0, remarks: remarks ?? r.remarks, reviewedBy, reviewedAt: now, updatedAt: now }
          : r
      ),
    }));
    try {
      const res = await fetch(`/api/overtime-review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", remarks, reviewedBy }),
      });
      if (!res.ok) {
        await get().fetchRecords();
        throw new Error("Rejection failed");
      }
    } catch (err) {
      console.error("[OTReview] rejectRecord error:", err);
    }
  },

  batchApprove: async (ids, reviewedBy) => {
    const now = new Date().toISOString();
    set((s) => ({
      records: s.records.map((r) =>
        ids.includes(r.id)
          ? { ...r, status: "approved", approvedOtHours: r.computedOtHours, approvedAmount: r.computedAmount, reviewedBy, reviewedAt: now, updatedAt: now }
          : r
      ),
    }));
    try {
      await fetch("/api/overtime-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_approve", ids, reviewedBy }),
      });
    } catch (err) {
      console.error("[OTReview] batchApprove error:", err);
      await get().fetchRecords();
    }
  },

  batchReject: async (ids, remarks, reviewedBy) => {
    const now = new Date().toISOString();
    set((s) => ({
      records: s.records.map((r) =>
        ids.includes(r.id)
          ? { ...r, status: "rejected", approvedOtHours: 0, approvedAmount: 0, remarks: remarks ?? r.remarks, reviewedBy, reviewedAt: now, updatedAt: now }
          : r
      ),
    }));
    try {
      await fetch("/api/overtime-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_reject", ids, remarks, reviewedBy }),
      });
    } catch (err) {
      console.error("[OTReview] batchReject error:", err);
      await get().fetchRecords();
    }
  },

  lockRecord: async (id) => {
    set((s) => ({
      records: s.records.map((r) =>
        r.id === id ? { ...r, status: "locked", updatedAt: new Date().toISOString() } : r
      ),
    }));
    await fetch(`/api/overtime-review/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    }).catch((err) => console.error("[OTReview] lockRecord error:", err));
  },

  markIncludedInPayroll: async (ids) => {
    set((s) => ({
      records: s.records.map((r) =>
        ids.includes(r.id) ? { ...r, status: "included_in_payroll", updatedAt: new Date().toISOString() } : r
      ),
    }));
    await fetch("/api/overtime-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_included_in_payroll", ids }),
    }).catch((err) => console.error("[OTReview] markIncluded error:", err));
  },

  fetchSettings: async () => {
    set({ isSettingsLoading: true });
    try {
      const res = await fetch("/api/ot-settings");
      if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
      const data = await res.json();
      const settings = settingsSnakeToCamel(data.settings ?? {});
      set({ settings, isSettingsLoading: false });
    } catch (err) {
      console.warn("[OTReview] fetchSettings failed, using defaults:", err);
      set({ isSettingsLoading: false });
    }
  },

  saveSettings: async (settings) => {
    set({ settings }); // optimistic
    try {
      await fetch("/api/ot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch (err) {
      console.error("[OTReview] saveSettings error:", err);
    }
  },

  getFilteredRecords: (filters) => {
    let result = get().records;
    if (filters.periodStart && filters.periodEnd) {
      const pid = buildPeriodId(filters.periodStart, filters.periodEnd);
      result = result.filter((r) => r.payrollPeriodId === pid);
    }
    if (filters.employeeId) result = result.filter((r) => r.employeeId === filters.employeeId);
    if (filters.status && filters.status !== "all") result = result.filter((r) => r.status === filters.status);
    if (filters.otType && filters.otType !== "all") result = result.filter((r) => r.otType === filters.otType);
    return result;
  },

  getPendingCountForPeriod: (periodStart, periodEnd) => {
    const pid = buildPeriodId(periodStart, periodEnd);
    return get().records.filter(
      (r) => r.payrollPeriodId === pid && r.status === "pending"
    ).length;
  },
}));

"use client";
import { create } from "zustand";
import type { PayrollRules, PayrollComplianceMode, DOLE_PH_DEFAULTS } from "@/types";

// ─── snake_case → camelCase mapper ───────────────────────────

function mapRules(row: Record<string, unknown>): PayrollRules {
  return {
    id: row.id as string,
    companyId: (row.company_id ?? row.companyId) as string | undefined,
    complianceMode: (row.compliance_mode ?? row.complianceMode ?? "ph_dole") as PayrollComplianceMode,

    regularOtMultiplier:       Number(row.regular_ot_multiplier       ?? row.regularOtMultiplier       ?? 1.25),
    restdayOtMultiplier:       Number(row.restday_ot_multiplier        ?? row.restdayOtMultiplier        ?? 1.30),
    specialHolidayMultiplier:  Number(row.special_holiday_multiplier   ?? row.specialHolidayMultiplier   ?? 1.30),
    regularHolidayMultiplier:  Number(row.regular_holiday_multiplier   ?? row.regularHolidayMultiplier   ?? 2.00),
    restdayHolidayMultiplier:  Number(row.restday_holiday_multiplier   ?? row.restdayHolidayMultiplier   ?? 1.50),

    nightDiffMultiplier:       Number(row.night_diff_multiplier        ?? row.nightDiffMultiplier        ?? 1.10),
    enableNightDiff:           Boolean(row.enable_night_diff           ?? row.enableNightDiff            ?? true),
    nightDiffStart:            (row.night_diff_start  ?? row.nightDiffStart  ?? "22:00") as string,
    nightDiffEnd:              (row.night_diff_end    ?? row.nightDiffEnd    ?? "06:00") as string,

    minimumOtMinutes:          Number(row.minimum_ot_minutes           ?? row.minimumOtMinutes           ?? 30),
    gracePeriodMinutes:        Number(row.grace_period_minutes         ?? row.gracePeriodMinutes         ?? 0),
    roundingRule:              (row.rounding_rule                      ?? row.roundingRule               ?? "none") as PayrollRules["roundingRule"],

    requireOtReview:           Boolean(row.require_ot_review           ?? row.requireOtReview            ?? true),
    requireSupervisorReview:   Boolean(row.require_supervisor_review   ?? row.requireSupervisorReview    ?? false),
    allowPartialOt:            Boolean(row.allow_partial_ot            ?? row.allowPartialOt             ?? true),
    includePendingInPayroll:   Boolean(row.include_pending_in_payroll  ?? row.includePendingInPayroll    ?? false),

    workDaysDivisor:           Number(row.work_days_divisor            ?? row.workDaysDivisor            ?? 22),
    hoursPerDay:               Number(row.hours_per_day                ?? row.hoursPerDay                ?? 8),

    complianceModeConfirmedBy: (row.compliance_mode_confirmed_by ?? row.complianceModeConfirmedBy) as string | undefined,
    complianceModeConfirmedAt: (row.compliance_mode_confirmed_at ?? row.complianceModeConfirmedAt) as string | undefined,

    createdBy:  (row.created_by  ?? row.createdBy)  as string | undefined,
    updatedBy:  (row.updated_by  ?? row.updatedBy)  as string | undefined,
    createdAt:  (row.created_at  ?? row.createdAt)  as string | undefined,
    updatedAt:  (row.updated_at  ?? row.updatedAt)  as string | undefined,
  };
}

// ─── DOLE PH defaults (local fallback) ───────────────────────

const PH_DOLE_DEFAULTS: PayrollRules = {
  id: "default",
  complianceMode: "ph_dole",
  regularOtMultiplier: 1.25,
  restdayOtMultiplier: 1.30,
  specialHolidayMultiplier: 1.30,
  regularHolidayMultiplier: 2.00,
  restdayHolidayMultiplier: 1.50,
  nightDiffMultiplier: 1.10,
  enableNightDiff: true,
  nightDiffStart: "22:00",
  nightDiffEnd: "06:00",
  minimumOtMinutes: 30,
  gracePeriodMinutes: 0,
  roundingRule: "none",
  requireOtReview: true,
  requireSupervisorReview: false,
  allowPartialOt: true,
  includePendingInPayroll: false,
  workDaysDivisor: 22,
  hoursPerDay: 8,
};

// ─── Store Interface ──────────────────────────────────────────

interface PayrollRulesState {
  rules: PayrollRules;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchRules: () => Promise<void>;
  /**
   * Update payroll rules.
   * If switching compliance_mode to 'custom', pass confirmed=true (user clicked Proceed).
   * Returns { requiresConfirmation: true } if confirmation needed.
   */
  updateRules: (
    updates: Partial<Omit<PayrollRules, "id" | "createdAt" | "updatedAt">>,
    opts?: { reason?: string; confirmed?: boolean }
  ) => Promise<{ ok: boolean; requiresConfirmation?: boolean; message?: string }>;
}

export const usePayrollRulesStore = create<PayrollRulesState>()((set, get) => ({
  rules: PH_DOLE_DEFAULTS,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchRules: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/payroll-rules");
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      if (data.rules) {
        set({ rules: mapRules(data.rules as Record<string, unknown>), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn("[PayrollRules] fetchRules failed, using DOLE defaults:", err);
      set({ isLoading: false, error: err instanceof Error ? err.message : "Failed to load payroll rules" });
    }
  },

  updateRules: async (updates, opts = {}) => {
    set({ isSaving: true, error: null });
    try {
      const res = await fetch("/api/payroll-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updates,
          reason: opts.reason,
          confirmed: opts.confirmed ?? false,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.requiresConfirmation) {
        set({ isSaving: false });
        return { ok: false, requiresConfirmation: true };
      }

      if (!res.ok || !data.ok) {
        set({ isSaving: false, error: data.message ?? "Update failed" });
        return { ok: false, message: data.message };
      }

      // Merge optimistic update with returned rules
      if (data.rules) {
        set({ rules: mapRules(data.rules as Record<string, unknown>), isSaving: false });
      } else {
        // Fallback: merge locally
        set((s) => ({
          rules: { ...s.rules, ...updates } as PayrollRules,
          isSaving: false,
        }));
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      set({ isSaving: false, error: message });
      return { ok: false, message };
    }
  },
}));

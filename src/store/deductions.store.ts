"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import type { DeductionTemplate, EmployeeDeductionAssignment, DeductionTemplateType, DeductionCalculationMode, DeductionCondition } from "@/types";

/* ═══════════════════════════════════════════════════════════════
   DEDUCTIONS STORE — Custom Deduction Templates & Assignments
   CRUD for deduction/allowance templates and per-employee assignments.
   ═══════════════════════════════════════════════════════════════ */

interface DeductionsState {
    templates: DeductionTemplate[];
    assignments: EmployeeDeductionAssignment[];
    isLoading: boolean;
    error: string | null;

    // ─── Template CRUD ────────────────────────────────────────
    fetchTemplates: () => Promise<void>;
    addTemplate: (data: Omit<DeductionTemplate, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }) => Promise<void>;
    updateTemplate: (id: string, data: Partial<DeductionTemplate>) => Promise<void>;
    deleteTemplate: (id: string) => Promise<void>;

    // ─── Assignment CRUD ──────────────────────────────────────
    fetchAssignments: (employeeId?: string) => Promise<void>;
    assignToEmployee: (data: { employeeId: string; templateId: string; overrideValue?: number; effectiveFrom?: string; effectiveUntil?: string }) => Promise<void>;
    unassignFromEmployee: (assignmentId: string) => Promise<void>;
    updateAssignment: (id: string, data: Partial<EmployeeDeductionAssignment>) => Promise<void>;

    // ─── Computation helpers ──────────────────────────────────
    getActiveAssignmentsForEmployee: (employeeId: string, date?: string) => EmployeeDeductionAssignment[];
    computeDeductionsForEmployee: (employeeId: string, monthlySalary: number, workDays?: number) => { label: string; amount: number; templateId: string }[];

    // ─── Bulk assign ──────────────────────────────────────────
    bulkAssignToEmployees: (data: { employeeIds: string[]; templateId: string; overrideValue?: number; effectiveFrom?: string }) => Promise<{ assigned: number; skipped: number }>;
}

export const useDeductionsStore = create<DeductionsState>()(
    persist(
        (set, get) => ({
            templates: [],
            assignments: [],
            isLoading: false,
            error: null,

            // ─── Template CRUD ────────────────────────────────────
            fetchTemplates: async () => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates");
                    const json = await res.json();
                    if (json.ok && json.data) {
                        // Map snake_case from API to camelCase
                        const templates: DeductionTemplate[] = json.data.map((t: Record<string, unknown>) => ({
                            id: t.id,
                            name: t.name,
                            type: t.type as DeductionTemplateType,
                            calculationMode: (t.calculation_mode || t.calculationMode) as DeductionCalculationMode,
                            value: Number(t.value),
                            conditions: t.conditions as DeductionCondition | undefined,
                            appliesToAll: t.applies_to_all ?? t.appliesToAll ?? false,
                            isActive: t.is_active ?? t.isActive ?? true,
                            createdBy: t.created_by as string | undefined,
                            createdAt: t.created_at as string | undefined,
                            updatedAt: t.updated_at as string | undefined,
                        }));
                        set({ templates, isLoading: false });
                    } else {
                        set({ error: json.message || "Failed to fetch templates", isLoading: false });
                    }
                } catch (err) {
                    set({ error: "Failed to fetch templates", isLoading: false });
                }
            },

            addTemplate: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    });
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const t = json.data;
                        const template: DeductionTemplate = {
                            id: t.id,
                            name: t.name,
                            type: t.type,
                            calculationMode: t.calculation_mode || t.calculationMode,
                            value: Number(t.value),
                            conditions: t.conditions,
                            appliesToAll: t.applies_to_all ?? t.appliesToAll ?? false,
                            isActive: t.is_active ?? t.isActive ?? true,
                            createdBy: t.created_by,
                            createdAt: t.created_at,
                            updatedAt: t.updated_at,
                        };
                        set((s) => ({ templates: [template, ...s.templates], isLoading: false }));
                    } else {
                        set({ error: json.message || "Failed to create template", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to create template", isLoading: false });
                }
            },

            updateTemplate: async (id, data) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, ...data }),
                    });
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const t = json.data;
                        set((s) => ({
                            templates: s.templates.map((tmpl) =>
                                tmpl.id === id ? {
                                    ...tmpl,
                                    name: t.name ?? tmpl.name,
                                    type: t.type ?? tmpl.type,
                                    calculationMode: t.calculation_mode ?? tmpl.calculationMode,
                                    value: t.value !== undefined ? Number(t.value) : tmpl.value,
                                    conditions: t.conditions ?? tmpl.conditions,
                                    appliesToAll: t.applies_to_all ?? tmpl.appliesToAll,
                                    isActive: t.is_active ?? tmpl.isActive,
                                    updatedAt: t.updated_at,
                                } : tmpl
                            ),
                            isLoading: false,
                        }));
                    } else {
                        set({ error: json.message || "Failed to update template", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to update template", isLoading: false });
                }
            },

            deleteTemplate: async (id) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id }),
                    });
                    const json = await res.json();
                    if (json.ok) {
                        if (json.softDeleted) {
                            // Marked inactive instead of deleted
                            set((s) => ({
                                templates: s.templates.map((t) => t.id === id ? { ...t, isActive: false } : t),
                                isLoading: false,
                            }));
                        } else {
                            set((s) => ({
                                templates: s.templates.filter((t) => t.id !== id),
                                isLoading: false,
                            }));
                        }
                    } else {
                        set({ error: json.message || "Failed to delete template", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to delete template", isLoading: false });
                }
            },

            // ─── Assignment CRUD ──────────────────────────────────
            fetchAssignments: async (employeeId) => {
                set({ isLoading: true, error: null });
                try {
                    const url = employeeId
                        ? `/api/payroll/templates/assignments?employeeId=${employeeId}`
                        : "/api/payroll/templates/assignments";
                    const res = await fetch(url);
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const assignments: EmployeeDeductionAssignment[] = json.data.map((a: Record<string, unknown>) => ({
                            id: a.id,
                            employeeId: a.employee_id ?? a.employeeId,
                            templateId: a.template_id ?? a.templateId,
                            overrideValue: a.override_value !== null ? Number(a.override_value) : undefined,
                            effectiveFrom: a.effective_from ?? a.effectiveFrom,
                            effectiveUntil: a.effective_until ?? a.effectiveUntil ?? undefined,
                            isActive: a.is_active ?? a.isActive ?? true,
                            assignedBy: a.assigned_by ?? a.assignedBy,
                            createdAt: a.created_at ?? a.createdAt,
                            template: a.template as DeductionTemplate | undefined,
                        }));
                        set({ assignments, isLoading: false });
                    } else {
                        set({ error: json.message || "Failed to fetch assignments", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to fetch assignments", isLoading: false });
                }
            },

            assignToEmployee: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates/assignments", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    });
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const a = json.data;
                        const assignment: EmployeeDeductionAssignment = {
                            id: a.id,
                            employeeId: a.employee_id ?? data.employeeId,
                            templateId: a.template_id ?? data.templateId,
                            overrideValue: a.override_value !== null ? Number(a.override_value) : undefined,
                            effectiveFrom: a.effective_from ?? data.effectiveFrom ?? new Date().toISOString().split("T")[0],
                            effectiveUntil: a.effective_until ?? data.effectiveUntil,
                            isActive: true,
                            assignedBy: a.assigned_by,
                            createdAt: a.created_at,
                            template: a.template,
                        };
                        set((s) => ({ assignments: [assignment, ...s.assignments], isLoading: false }));
                    } else {
                        set({ error: json.message || "Failed to assign template", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to assign template", isLoading: false });
                }
            },

            unassignFromEmployee: async (assignmentId) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates/assignments", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: assignmentId }),
                    });
                    const json = await res.json();
                    if (json.ok) {
                        set((s) => ({
                            assignments: s.assignments.filter((a) => a.id !== assignmentId),
                            isLoading: false,
                        }));
                    } else {
                        set({ error: json.message || "Failed to remove assignment", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to remove assignment", isLoading: false });
                }
            },

            updateAssignment: async (id, data) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates/assignments", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id, ...data }),
                    });
                    const json = await res.json();
                    if (json.ok) {
                        set((s) => ({
                            assignments: s.assignments.map((a) => a.id === id ? { ...a, ...data } : a),
                            isLoading: false,
                        }));
                    } else {
                        set({ error: json.message || "Failed to update assignment", isLoading: false });
                    }
                } catch {
                    set({ error: "Failed to update assignment", isLoading: false });
                }
            },

            // ─── Bulk assign ──────────────────────────────────────
            bulkAssignToEmployees: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await fetch("/api/payroll/templates/assignments/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(data),
                    });
                    const json = await res.json();
                    if (json.ok) {
                        // Refresh full assignments list to reflect newly created ones
                        await get().fetchAssignments();
                        set({ isLoading: false });
                        return { assigned: json.assigned ?? 0, skipped: json.skipped ?? 0 };
                    } else {
                        set({ error: json.message || "Bulk assign failed", isLoading: false });
                        return { assigned: 0, skipped: 0 };
                    }
                } catch {
                    set({ error: "Bulk assign failed", isLoading: false });
                    return { assigned: 0, skipped: 0 };
                }
            },

            // ─── Computation helpers ──────────────────────────────
            getActiveAssignmentsForEmployee: (employeeId, date) => {
                const checkDate = date || new Date().toISOString().split("T")[0];
                return get().assignments.filter((a) =>
                    a.employeeId === employeeId &&
                    a.isActive &&
                    a.effectiveFrom <= checkDate &&
                    (!a.effectiveUntil || a.effectiveUntil >= checkDate)
                );
            },

            computeDeductionsForEmployee: (employeeId, monthlySalary, workDays = 22) => {
                const { templates } = get();
                const activeAssignments = get().getActiveAssignmentsForEmployee(employeeId);
                const results: { label: string; amount: number; templateId: string }[] = [];

                for (const assignment of activeAssignments) {
                    const template = templates.find((t) => t.id === assignment.templateId);
                    if (!template || !template.isActive) continue;

                    const baseValue = assignment.overrideValue ?? template.value;
                    let amount = 0;

                    switch (template.calculationMode) {
                        case "fixed":
                            amount = baseValue;
                            break;
                        case "percentage":
                            amount = Math.round((monthlySalary * baseValue) / 100);
                            break;
                        case "daily":
                            amount = Math.round(baseValue * workDays);
                            break;
                        case "hourly":
                            amount = Math.round(baseValue * workDays * 8);
                            break;
                    }

                    // Deductions are positive amounts subtracted, allowances are positive amounts added
                    if (template.type === "deduction") {
                        amount = Math.abs(amount);
                    }

                    results.push({
                        label: template.name,
                        amount,
                        templateId: template.id,
                    });
                }

                return results;
            },
        }),
        {
            name: "nexhrms-deductions",
            version: 1,
            storage: safePersistStorage,
        }
    )
);

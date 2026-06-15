"use client";

/**
 * TanStack Query replacement for useDeductionsStore.
 * Drop-in compatible API — same state shape and actions.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { DeductionTemplate, EmployeeDeductionAssignment, DeductionTemplateType, DeductionCalculationMode, DeductionCondition } from "@/types";

// ─── Query keys ──────────────────────────────────────────────

export const DEDUCTION_TEMPLATES_KEY = ["deduction-templates"] as const;
export const DEDUCTION_ASSIGNMENTS_KEY = ["deduction-assignments"] as const;

// ─── Mappers ─────────────────────────────────────────────────

function mapTemplate(t: Record<string, unknown>): DeductionTemplate {
    return {
        id: t.id as string,
        name: t.name as string,
        type: (t.type as DeductionTemplateType),
        calculationMode: (t.calculation_mode || t.calculationMode) as DeductionCalculationMode,
        value: Number(t.value),
        conditions: t.conditions as DeductionCondition | undefined,
        appliesToAll: (t.applies_to_all ?? t.appliesToAll ?? false) as boolean,
        isActive: (t.is_active ?? t.isActive ?? true) as boolean,
        createdBy: t.created_by as string | undefined,
        createdAt: (t.created_at ?? t.createdAt) as string | undefined,
        updatedAt: (t.updated_at ?? t.updatedAt) as string | undefined,
    };
}

function mapAssignment(a: Record<string, unknown>): EmployeeDeductionAssignment {
    return {
        id: a.id as string,
        employeeId: (a.employee_id ?? a.employeeId) as string,
        templateId: (a.template_id ?? a.templateId) as string,
        overrideValue: a.override_value !== null && a.override_value !== undefined ? Number(a.override_value) : (a.overrideValue !== null && a.overrideValue !== undefined ? Number(a.overrideValue) : undefined),
        effectiveFrom: (a.effective_from ?? a.effectiveFrom) as string,
        effectiveUntil: (a.effective_until ?? a.effectiveUntil ?? undefined) as string | undefined,
        isActive: (a.is_active ?? a.isActive ?? true) as boolean,
        assignedBy: (a.assigned_by ?? a.assignedBy) as string | undefined,
        createdAt: (a.created_at ?? a.createdAt) as string | undefined,
        template: a.template as DeductionTemplate | undefined,
    };
}

// ─── Fetch functions ─────────────────────────────────────────

async function fetchTemplates(): Promise<DeductionTemplate[]> {
    const res = await fetch("/api/payroll/templates");
    const json = await res.json();
    if (json.ok && json.data) {
        return json.data.map(mapTemplate);
    }
    return [];
}

async function fetchAssignments(): Promise<EmployeeDeductionAssignment[]> {
    const res = await fetch("/api/payroll/templates/assignments");
    const json = await res.json();
    if (json.ok && json.data) {
        const assignments = json.data.map(mapAssignment);
        // Deduplicate by id
        const seen = new Set<string>();
        return assignments.filter((a: EmployeeDeductionAssignment) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }
    return [];
}

// ─── Drop-in replacement for useDeductionsStore ──────────────

export function useDeductionsStore() {
    const queryClient = useQueryClient();

    const { data: templates = [], isLoading: templatesLoading } = useQuery({
        queryKey: DEDUCTION_TEMPLATES_KEY,
        queryFn: fetchTemplates,
        staleTime: 2 * 60 * 1000,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: DEDUCTION_ASSIGNMENTS_KEY,
        queryFn: fetchAssignments,
        staleTime: 2 * 60 * 1000,
    });

    const isLoading = templatesLoading || assignmentsLoading;

    // ─── Mutations ───────────────────────────────────────────

    const addTemplateMutation = useMutation({
        mutationFn: async (data: Omit<DeductionTemplate, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }) => {
            const res = await fetch("/api/payroll/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.ok && json.data) return mapTemplate(json.data);
            throw new Error(json.message || "Failed to create template");
        },
        onSuccess: (template) => {
            queryClient.setQueryData<DeductionTemplate[]>(DEDUCTION_TEMPLATES_KEY, (prev) =>
                [template, ...(prev ?? [])]
            );
        },
    });

    const updateTemplateMutation = useMutation({
        mutationFn: async ({ id, ...data }: Partial<DeductionTemplate> & { id: string }) => {
            const res = await fetch("/api/payroll/templates", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });
            const json = await res.json();
            if (json.ok && json.data) return mapTemplate(json.data);
            throw new Error(json.message || "Failed to update template");
        },
        onSuccess: (updated) => {
            queryClient.setQueryData<DeductionTemplate[]>(DEDUCTION_TEMPLATES_KEY, (prev) =>
                (prev ?? []).map((t) => t.id === updated.id ? updated : t)
            );
        },
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/payroll/templates", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Failed to delete template");
            return { id, softDeleted: json.softDeleted as boolean };
        },
        onSuccess: ({ id, softDeleted }) => {
            if (softDeleted) {
                queryClient.setQueryData<DeductionTemplate[]>(DEDUCTION_TEMPLATES_KEY, (prev) =>
                    (prev ?? []).map((t) => t.id === id ? { ...t, isActive: false } : t)
                );
            } else {
                queryClient.setQueryData<DeductionTemplate[]>(DEDUCTION_TEMPLATES_KEY, (prev) =>
                    (prev ?? []).filter((t) => t.id !== id)
                );
            }
        },
    });

    const assignMutation = useMutation({
        mutationFn: async (data: { employeeId: string; templateId: string; overrideValue?: number; effectiveFrom?: string; effectiveUntil?: string }) => {
            const res = await fetch("/api/payroll/templates/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.ok && json.data) return mapAssignment(json.data);
            throw new Error(json.message || "Failed to assign template");
        },
        onSuccess: (assignment) => {
            queryClient.setQueryData<EmployeeDeductionAssignment[]>(DEDUCTION_ASSIGNMENTS_KEY, (prev) => {
                const filtered = (prev ?? []).filter(
                    (existing) => !(existing.employeeId === assignment.employeeId && existing.templateId === assignment.templateId)
                );
                return [assignment, ...filtered];
            });
        },
    });

    const unassignMutation = useMutation({
        mutationFn: async (assignmentId: string) => {
            const res = await fetch("/api/payroll/templates/assignments", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: assignmentId }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Failed to remove assignment");
            return assignmentId;
        },
        onSuccess: (removedId) => {
            queryClient.setQueryData<EmployeeDeductionAssignment[]>(DEDUCTION_ASSIGNMENTS_KEY, (prev) =>
                (prev ?? []).filter((a) => a.id !== removedId)
            );
        },
    });

    const updateAssignmentMutation = useMutation({
        mutationFn: async ({ id, ...data }: Partial<EmployeeDeductionAssignment> & { id: string }) => {
            const res = await fetch("/api/payroll/templates/assignments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Failed to update assignment");
            return { id, ...data };
        },
        onSuccess: ({ id, ...data }) => {
            queryClient.setQueryData<EmployeeDeductionAssignment[]>(DEDUCTION_ASSIGNMENTS_KEY, (prev) =>
                (prev ?? []).map((a) => a.id === id ? { ...a, ...data } : a)
            );
        },
    });

    const bulkAssignMutation = useMutation({
        mutationFn: async (data: { employeeIds: string[]; templateId: string; overrideValue?: number; effectiveFrom?: string }) => {
            const res = await fetch("/api/payroll/templates/assignments/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || "Bulk assign failed");
            return { assigned: json.assigned ?? 0, skipped: json.skipped ?? 0 };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEDUCTION_ASSIGNMENTS_KEY });
        },
    });

    // ─── Wrapped action functions (same signature as old store) ─

    const fetchTemplatesFn = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: DEDUCTION_TEMPLATES_KEY });
    }, [queryClient]);

    const fetchAssignmentsFn = useCallback(async (_employeeId?: string) => {
        await queryClient.invalidateQueries({ queryKey: DEDUCTION_ASSIGNMENTS_KEY });
    }, [queryClient]);

    const addTemplate = useCallback(async (data: Omit<DeductionTemplate, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }) => {
        await addTemplateMutation.mutateAsync(data);
    }, [addTemplateMutation]);

    const updateTemplate = useCallback(async (id: string, data: Partial<DeductionTemplate>) => {
        await updateTemplateMutation.mutateAsync({ id, ...data });
    }, [updateTemplateMutation]);

    const deleteTemplate = useCallback(async (id: string) => {
        await deleteTemplateMutation.mutateAsync(id);
    }, [deleteTemplateMutation]);

    const assignToEmployee = useCallback(async (data: { employeeId: string; templateId: string; overrideValue?: number; effectiveFrom?: string; effectiveUntil?: string }) => {
        await assignMutation.mutateAsync(data);
    }, [assignMutation]);

    const unassignFromEmployee = useCallback(async (assignmentId: string) => {
        await unassignMutation.mutateAsync(assignmentId);
    }, [unassignMutation]);

    const updateAssignment = useCallback(async (id: string, data: Partial<EmployeeDeductionAssignment>) => {
        await updateAssignmentMutation.mutateAsync({ id, ...data });
    }, [updateAssignmentMutation]);

    const bulkAssignToEmployees = useCallback(async (data: { employeeIds: string[]; templateId: string; overrideValue?: number; effectiveFrom?: string }) => {
        return await bulkAssignMutation.mutateAsync(data);
    }, [bulkAssignMutation]);

    // ─── Computation helpers (unchanged logic) ───────────────

    const getActiveAssignmentsForEmployee = useCallback((employeeId: string, date?: string) => {
        const checkDate = date || new Date().toISOString().split("T")[0];
        return assignments.filter((a) =>
            a.employeeId === employeeId &&
            a.isActive &&
            a.effectiveFrom <= checkDate &&
            (!a.effectiveUntil || a.effectiveUntil >= checkDate)
        );
    }, [assignments]);

    const computeDeductionsForEmployee = useCallback((employeeId: string, monthlySalary: number, workDays = 22) => {
        const activeAssignments = assignments.filter((a) => {
            const checkDate = new Date().toISOString().split("T")[0];
            return a.employeeId === employeeId && a.isActive && a.effectiveFrom <= checkDate && (!a.effectiveUntil || a.effectiveUntil >= checkDate);
        });
        const results: { label: string; amount: number; templateId: string }[] = [];

        for (const assignment of activeAssignments) {
            const template = templates.find((t) => t.id === assignment.templateId);
            if (!template || !template.isActive) continue;

            const baseValue = assignment.overrideValue ?? template.value;
            let amount = 0;

            switch (template.calculationMode) {
                case "fixed": amount = baseValue; break;
                case "percentage": amount = Math.round((monthlySalary * baseValue) / 100); break;
                case "daily": amount = Math.round(baseValue * workDays); break;
                case "hourly": amount = Math.round(baseValue * workDays * 8); break;
            }

            if (template.type === "deduction") { amount = Math.abs(amount); }
            results.push({ label: template.name, amount, templateId: template.id });
        }
        return results;
    }, [assignments, templates]);

    return useMemo(() => ({
        templates,
        assignments,
        isLoading,
        error: (addTemplateMutation.error?.message || updateTemplateMutation.error?.message || deleteTemplateMutation.error?.message || null) as string | null,
        fetchTemplates: fetchTemplatesFn,
        fetchAssignments: fetchAssignmentsFn,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        assignToEmployee,
        unassignFromEmployee,
        updateAssignment,
        bulkAssignToEmployees,
        getActiveAssignmentsForEmployee,
        computeDeductionsForEmployee,
    }), [templates, assignments, isLoading, addTemplateMutation.error, updateTemplateMutation.error, deleteTemplateMutation.error, fetchTemplatesFn, fetchAssignmentsFn, addTemplate, updateTemplate, deleteTemplate, assignToEmployee, unassignFromEmployee, updateAssignment, bulkAssignToEmployees, getActiveAssignmentsForEmployee, computeDeductionsForEmployee]);
}

"use client";

/**
 * TanStack Query hook for Employee data.
 *
 * Replaces the data-fetching and mutation responsibilities of useEmployeesStore.
 * Filter state is managed separately in employee-filters.store.ts.
 *
 * Query keys:
 *   - EMPLOYEES_QUERY_KEY: main employees list
 *   - SALARY_REQUESTS_QUERY_KEY: salary change requests
 *   - SALARY_HISTORY_QUERY_KEY: salary history entries
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import type { Employee, EmployeeStatus, WorkType, SalaryChangeRequest, SalaryHistoryEntry, EmployeeDocument } from "@/types";
import { employeesDb, salaryDb } from "@/services/db.service";
import { useEmployeeFiltersStore } from "@/store/employee-filters.store";

// ─── Query Keys ──────────────────────────────────────────────

export const EMPLOYEES_QUERY_KEY = ["employees"] as const;
export const SALARY_REQUESTS_QUERY_KEY = ["salary-requests"] as const;
export const SALARY_HISTORY_QUERY_KEY = ["salary-history"] as const;

// ─── Deduplication helpers (same logic as original store) ─────

function dedupeById(employees: Employee[]): Employee[] {
    const seen = new Set<string>();
    return employees.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });
}

function dedupeByEmail(employees: Employee[]): Employee[] {
    const emailMap = new Map<string, Employee>();
    for (const e of employees) {
        const key = e.email.toLowerCase();
        const existing = emailMap.get(key);
        if (!existing) {
            emailMap.set(key, e);
        } else if (!existing.profileId && e.profileId) {
            const merged = {
                ...e,
                salary: e.salary || existing.salary,
                department: e.department || existing.department,
                jobTitle: e.jobTitle || existing.jobTitle,
            };
            emailMap.set(key, merged);
        }
    }
    return Array.from(emailMap.values());
}

function dedupeAll(employees: Employee[]): Employee[] {
    return dedupeByEmail(dedupeById(employees));
}

// ─── Fetch functions ─────────────────────────────────────────

async function fetchEmployees(): Promise<Employee[]> {
    return employeesDb.fetchAll();
}

async function fetchSalaryRequests(): Promise<SalaryChangeRequest[]> {
    return salaryDb.fetchRequests();
}

async function fetchSalaryHistory(): Promise<SalaryHistoryEntry[]> {
    return salaryDb.fetchHistory();
}

// ─── Main Hook ───────────────────────────────────────────────

export function useEmployeesQuery() {
    return useQuery({
        queryKey: EMPLOYEES_QUERY_KEY,
        queryFn: fetchEmployees,
        staleTime: 2 * 60 * 1000,
    });
}

export function useSalaryRequestsQuery() {
    return useQuery({
        queryKey: SALARY_REQUESTS_QUERY_KEY,
        queryFn: fetchSalaryRequests,
        staleTime: 2 * 60 * 1000,
    });
}

export function useSalaryHistoryQuery() {
    return useQuery({
        queryKey: SALARY_HISTORY_QUERY_KEY,
        queryFn: fetchSalaryHistory,
        staleTime: 2 * 60 * 1000,
    });
}

// ─── Mutations ───────────────────────────────────────────────

export function useAddEmployeeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (emp: Employee) => {
            const ok = await employeesDb.upsert(emp);
            if (!ok) throw new Error("Failed to add employee");
            return emp;
        },
        onSuccess: (emp) => {
            queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, (prev) =>
                [...(prev ?? []), emp]
            );
        },
    });
}

export function useUpdateEmployeeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
            const ok = await employeesDb.update(id, data);
            if (!ok) throw new Error("Failed to update employee");
            return { id, data };
        },
        onSuccess: ({ id, data }) => {
            queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, (prev) =>
                (prev ?? []).map((e) => e.id === id ? { ...e, ...data } : e)
            );
        },
    });
}

export function useRemoveEmployeeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const ok = await employeesDb.remove(id);
            if (!ok) throw new Error("Failed to remove employee");
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, (prev) =>
                (prev ?? []).filter((e) => e.id !== id)
            );
        },
    });
}

// ─── Composite Hook (drop-in compatible API) ─────────────────
// This matches the shape of the original useEmployeesStore for consumers
// that destructure the full state.

export interface EmployeesHookState {
    employees: Employee[];
    deletedEmployeeIds: string[];
    salaryRequests: SalaryChangeRequest[];
    salaryHistory: SalaryHistoryEntry[];
    documents: Record<string, EmployeeDocument[]>;
    // Filter state (delegates to employee-filters store)
    searchQuery: string;
    statusFilter: EmployeeStatus | "all";
    workTypeFilter: WorkType | "all";
    roleFilter: string;
    departmentFilter: string;
    setSearchQuery: (q: string) => void;
    setStatusFilter: (s: EmployeeStatus | "all") => void;
    setWorkTypeFilter: (w: WorkType | "all") => void;
    setRoleFilter: (r: string) => void;
    setDepartmentFilter: (d: string) => void;
    // Actions
    addEmployee: (emp: Employee) => { ok: boolean; error?: string };
    updateEmployee: (id: string, data: Partial<Employee>) => void;
    removeEmployee: (id: string) => void;
    toggleStatus: (id: string) => void;
    resignEmployee: (id: string) => void;
    getEmployee: (id: string) => Employee | undefined;
    getFiltered: () => Employee[];
    deduplicateEmployees: () => number;
    // Salary governance
    proposeSalaryChange: (data: { employeeId: string; proposedSalary: number; effectiveDate: string; reason: string; proposedBy: string }) => void;
    approveSalaryChange: (requestId: string, reviewerId: string) => void;
    rejectSalaryChange: (requestId: string, reviewerId: string) => void;
    getSalaryHistory: (employeeId: string) => SalaryHistoryEntry[];
    // Documents
    addDocument: (employeeId: string, name: string, fileUrl?: string, fileType?: string) => void;
    removeDocument: (employeeId: string, docId: string) => void;
    getDocuments: (employeeId: string) => EmployeeDocument[];
    resetToSeed: () => void;
}

export function useEmployeesHook(): EmployeesHookState {
    const queryClient = useQueryClient();
    const { data: employees = [], } = useEmployeesQuery();
    const { data: salaryRequests = [] } = useSalaryRequestsQuery();
    const { data: salaryHistory = [] } = useSalaryHistoryQuery();

    // Filter state from dedicated Zustand store
    const filters = useEmployeeFiltersStore();

    // ─── Cache setters ───────────────────────────────────────

    const setEmployeesCache = useCallback((updater: (prev: Employee[]) => Employee[]) => {
        queryClient.setQueryData<Employee[]>(EMPLOYEES_QUERY_KEY, (prev) => updater(prev ?? []));
    }, [queryClient]);

    const setSalaryRequestsCache = useCallback((updater: (prev: SalaryChangeRequest[]) => SalaryChangeRequest[]) => {
        queryClient.setQueryData<SalaryChangeRequest[]>(SALARY_REQUESTS_QUERY_KEY, (prev) => updater(prev ?? []));
    }, [queryClient]);

    const setSalaryHistoryCache = useCallback((updater: (prev: SalaryHistoryEntry[]) => SalaryHistoryEntry[]) => {
        queryClient.setQueryData<SalaryHistoryEntry[]>(SALARY_HISTORY_QUERY_KEY, (prev) => updater(prev ?? []));
    }, [queryClient]);

    // ─── Actions (same logic as original store) ──────────────

    const addEmployee = useCallback((emp: Employee): { ok: boolean; error?: string } => {
        if (employees.some((e) => e.id === emp.id)) {
            return { ok: false, error: `Employee ID "${emp.id}" already exists.` };
        }
        if (employees.some((e) => e.email.toLowerCase() === emp.email.toLowerCase())) {
            return { ok: false, error: `An employee with email "${emp.email}" already exists.` };
        }
        if (emp.biometricId && employees.some((e) => e.biometricId === emp.biometricId)) {
            return { ok: false, error: `Biometric ID "${emp.biometricId}" is already assigned.` };
        }
        setEmployeesCache((prev) => [...prev, emp]);
        // Fire-and-forget DB write
        employeesDb.upsert(emp).catch(() => {});
        return { ok: true };
    }, [employees, setEmployeesCache]);

    const updateEmployee = useCallback((id: string, data: Partial<Employee>) => {
        setEmployeesCache((prev) => prev.map((e) => e.id === id ? { ...e, ...data } : e));
        employeesDb.update(id, data).catch(() => {});
    }, [setEmployeesCache]);

    const removeEmployee = useCallback((id: string) => {
        setEmployeesCache((prev) => prev.filter((e) => e.id !== id));
        employeesDb.remove(id).catch(() => {});
    }, [setEmployeesCache]);

    const toggleStatus = useCallback((id: string) => {
        setEmployeesCache((prev) => prev.map((e) =>
            e.id === id ? { ...e, status: (e.status === "active" ? "inactive" : "active") as EmployeeStatus } : e
        ));
        const emp = employees.find((e) => e.id === id);
        if (emp) {
            const newStatus = emp.status === "active" ? "inactive" : "active";
            employeesDb.update(id, { status: newStatus } as Partial<Employee>).catch(() => {});
        }
    }, [employees, setEmployeesCache]);

    const resignEmployee = useCallback((id: string) => {
        const resignedAt = new Date().toISOString();
        setEmployeesCache((prev) => prev.map((e) =>
            e.id === id ? { ...e, status: "resigned" as const, resignedAt } : e
        ));
        employeesDb.update(id, { status: "resigned", resignedAt } as Partial<Employee>).catch(() => {});
    }, [setEmployeesCache]);

    const getEmployee = useCallback((id: string) => employees.find((e) => e.id === id), [employees]);

    const getFiltered = useCallback(() => {
        const ADMIN_ACCESSED_ROLES = ["admin", "hr", "payroll_admin", "finance"];
        return employees.filter((e) => {
            if (ADMIN_ACCESSED_ROLES.includes(e.role)) return false;
            const matchesSearch =
                !filters.searchQuery ||
                e.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                e.email.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                e.id.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                e.biometricId?.toLowerCase().includes(filters.searchQuery.toLowerCase());
            const matchesStatus = filters.statusFilter === "all" || e.status === filters.statusFilter;
            const matchesWorkType = filters.workTypeFilter === "all" || e.workType === filters.workTypeFilter;
            const matchesRole = filters.roleFilter === "all" || e.role === filters.roleFilter;
            const matchesDept = filters.departmentFilter === "all" || e.department === filters.departmentFilter;
            return matchesSearch && matchesStatus && matchesWorkType && matchesRole && matchesDept;
        });
    }, [employees, filters]);

    const deduplicateEmployees = useCallback((): number => {
        const before = employees.length;
        const deduped = dedupeAll(employees);
        if (deduped.length < before) {
            queryClient.setQueryData(EMPLOYEES_QUERY_KEY, deduped);
        }
        return before - deduped.length;
    }, [employees, queryClient]);

    // ─── Salary governance ───────────────────────────────────

    const proposeSalaryChange = useCallback((data: { employeeId: string; proposedSalary: number; effectiveDate: string; reason: string; proposedBy: string }) => {
        const emp = employees.find((e) => e.id === data.employeeId);
        if (!emp) return;
        const newReq: SalaryChangeRequest = {
            id: `SCR-${nanoid(8)}`,
            employeeId: data.employeeId,
            oldSalary: emp.salary,
            proposedSalary: data.proposedSalary,
            effectiveDate: data.effectiveDate,
            reason: data.reason,
            proposedBy: data.proposedBy,
            proposedAt: new Date().toISOString(),
            status: "pending",
        };
        setSalaryRequestsCache((prev) => [...prev, newReq]);
        salaryDb.upsertRequest(newReq).catch(() => {});
    }, [employees, setSalaryRequestsCache]);

    const approveSalaryChange = useCallback((requestId: string, reviewerId: string) => {
        const req = salaryRequests.find((r) => r.id === requestId);
        if (!req || req.status !== "pending") return;
        const emp = employees.find((e) => e.id === req.employeeId);
        if (!emp) return;
        const today = new Date().toISOString().split("T")[0];
        if (req.effectiveDate < today) return;

        // Update request status
        const updatedReq = { ...req, status: "approved" as const, reviewedBy: reviewerId, reviewedAt: new Date().toISOString() };
        setSalaryRequestsCache((prev) => prev.map((r) => r.id === requestId ? updatedReq : r));
        salaryDb.upsertRequest(updatedReq).catch(() => {});

        // Update employee salary
        setEmployeesCache((prev) => prev.map((e) => e.id === req.employeeId ? { ...e, salary: req.proposedSalary } : e));
        employeesDb.update(req.employeeId, { salary: req.proposedSalary } as Partial<Employee>).catch(() => {});

        // Add salary history entry
        const historyEntry: SalaryHistoryEntry = {
            id: `SH-${nanoid(8)}`,
            employeeId: req.employeeId,
            monthlySalary: req.proposedSalary,
            effectiveFrom: req.effectiveDate,
            approvedBy: reviewerId,
            reason: req.reason,
        };
        setSalaryHistoryCache((prev) => [...prev, historyEntry]);
        salaryDb.insertHistory(historyEntry).catch(() => {});
    }, [salaryRequests, employees, setSalaryRequestsCache, setEmployeesCache, setSalaryHistoryCache]);

    const rejectSalaryChange = useCallback((requestId: string, reviewerId: string) => {
        setSalaryRequestsCache((prev) => prev.map((r) =>
            r.id === requestId
                ? { ...r, status: "rejected" as const, reviewedBy: reviewerId, reviewedAt: new Date().toISOString() }
                : r
        ));
        const req = salaryRequests.find((r) => r.id === requestId);
        if (req) {
            salaryDb.upsertRequest({ ...req, status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date().toISOString() }).catch(() => {});
        }
    }, [salaryRequests, setSalaryRequestsCache]);

    const getSalaryHistory = useCallback((employeeId: string) =>
        salaryHistory.filter((h) => h.employeeId === employeeId), [salaryHistory]);

    // ─── Documents (local-only, same as original store) ──────

    // Documents are stored in the 201 documents store (useDocumentsStore), not here.
    // These are legacy compat stubs that maintain the same interface.
    const addDocument = useCallback((_employeeId: string, _name: string, _fileUrl?: string, _fileType?: string) => {
        // No-op: documents are managed by useDocumentsStore
    }, []);

    const removeDocument = useCallback((_employeeId: string, _docId: string) => {
        // No-op: documents are managed by useDocumentsStore
    }, []);

    const getDocuments = useCallback((_employeeId: string): EmployeeDocument[] => {
        return [];
    }, []);

    const resetToSeed = useCallback(() => {
        queryClient.setQueryData(EMPLOYEES_QUERY_KEY, []);
        queryClient.setQueryData(SALARY_REQUESTS_QUERY_KEY, []);
        queryClient.setQueryData(SALARY_HISTORY_QUERY_KEY, []);
        filters.resetFilters();
    }, [queryClient, filters]);

    return useMemo(() => ({
        employees,
        deletedEmployeeIds: [] as string[],
        salaryRequests,
        salaryHistory,
        documents: {} as Record<string, EmployeeDocument[]>,
        // Filter state
        searchQuery: filters.searchQuery,
        statusFilter: filters.statusFilter,
        workTypeFilter: filters.workTypeFilter,
        roleFilter: filters.roleFilter,
        departmentFilter: filters.departmentFilter,
        setSearchQuery: filters.setSearchQuery,
        setStatusFilter: filters.setStatusFilter,
        setWorkTypeFilter: filters.setWorkTypeFilter,
        setRoleFilter: filters.setRoleFilter,
        setDepartmentFilter: filters.setDepartmentFilter,
        // Actions
        addEmployee,
        updateEmployee,
        removeEmployee,
        toggleStatus,
        resignEmployee,
        getEmployee,
        getFiltered,
        deduplicateEmployees,
        proposeSalaryChange,
        approveSalaryChange,
        rejectSalaryChange,
        getSalaryHistory,
        addDocument,
        removeDocument,
        getDocuments,
        resetToSeed,
    }), [
        employees, salaryRequests, salaryHistory, filters,
        addEmployee, updateEmployee, removeEmployee, toggleStatus, resignEmployee,
        getEmployee, getFiltered, deduplicateEmployees,
        proposeSalaryChange, approveSalaryChange, rejectSalaryChange, getSalaryHistory,
        addDocument, removeDocument, getDocuments, resetToSeed,
    ]);
}

"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Employee, EmployeeStatus, WorkType, SalaryChangeRequest, SalaryHistoryEntry } from "@/types";
import { SEED_EMPLOYEES } from "@/data/seed";

interface EmployeeDocument {
    id: string;
    name: string;
    uploadedAt: string;
}

interface EmployeesState {
    employees: Employee[];
    salaryRequests: SalaryChangeRequest[];
    salaryHistory: SalaryHistoryEntry[];
    documents: Record<string, EmployeeDocument[]>;
    searchQuery: string;
    statusFilter: EmployeeStatus | "all";
    workTypeFilter: WorkType | "all";
    departmentFilter: string;
    setSearchQuery: (q: string) => void;
    setStatusFilter: (s: EmployeeStatus | "all") => void;
    setWorkTypeFilter: (w: WorkType | "all") => void;
    setDepartmentFilter: (d: string) => void;
    addEmployee: (emp: Employee) => void;
    updateEmployee: (id: string, data: Partial<Employee>) => void;
    removeEmployee: (id: string) => void;
    toggleStatus: (id: string) => void;
    resignEmployee: (id: string) => void;
    getEmployee: (id: string) => Employee | undefined;
    getFiltered: () => Employee[];
    // Salary change governance
    proposeSalaryChange: (data: { employeeId: string; proposedSalary: number; effectiveDate: string; reason: string; proposedBy: string }) => void;
    approveSalaryChange: (requestId: string, reviewerId: string) => void;
    rejectSalaryChange: (requestId: string, reviewerId: string) => void;
    getSalaryHistory: (employeeId: string) => SalaryHistoryEntry[];
    addDocument: (employeeId: string, name: string) => void;
    removeDocument: (employeeId: string, docId: string) => void;
    getDocuments: (employeeId: string) => EmployeeDocument[];
    resetToSeed: () => void;
}

export const useEmployeesStore = create<EmployeesState>()(
    persist(
        (set, get) => ({
            employees: SEED_EMPLOYEES,
            salaryRequests: [],
            salaryHistory: [],
            documents: {},
            searchQuery: "",
            statusFilter: "all",
            workTypeFilter: "all",
            departmentFilter: "all",
            setSearchQuery: (q) => set({ searchQuery: q }),
            setStatusFilter: (s) => set({ statusFilter: s }),
            setWorkTypeFilter: (w) => set({ workTypeFilter: w }),
            setDepartmentFilter: (d) => set({ departmentFilter: d }),
            addEmployee: (emp) => set((s) => ({ employees: [...s.employees, emp] })),
            updateEmployee: (id, data) =>
                set((s) => {
                    // Salary changes are passed through here for admin/finance direct edits.
                    // For the governed salary-change workflow (propose → approve), use proposeSalaryChange / approveSalaryChange.
                    const { salary: _salary, ...safeData } = data;
                    const updateData = _salary !== undefined ? data : safeData;
                    return {
                        employees: s.employees.map((e) => (e.id === id ? { ...e, ...updateData } : e)),
                    };
                }),
            removeEmployee: (id) =>
                set((s) => ({
                    employees: s.employees.filter((e) => e.id !== id),
                })),
            toggleStatus: (id) =>
                set((s) => ({
                    employees: s.employees.map((e) =>
                        e.id === id
                            ? { ...e, status: e.status === "active" ? "inactive" : "active" }
                            : e
                    ),
                })),
            resignEmployee: (id) =>
                set((s) => ({
                    employees: s.employees.map((e) =>
                        e.id === id
                            ? { ...e, status: "resigned" as const, resignedAt: new Date().toISOString() }
                            : e
                    ),
                })),
            getEmployee: (id) => get().employees.find((e) => e.id === id),
            getFiltered: () => {
                const { employees, searchQuery, statusFilter, workTypeFilter, departmentFilter } = get();
                return employees.filter((e) => {
                    const matchesSearch =
                        !searchQuery ||
                        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.id.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
                    const matchesWorkType = workTypeFilter === "all" || e.workType === workTypeFilter;
                    const matchesDept = departmentFilter === "all" || e.department === departmentFilter;
                    return matchesSearch && matchesStatus && matchesWorkType && matchesDept;
                });
            },
            // ─── Salary Change Governance ─────────────────────────────
            proposeSalaryChange: (data) =>
                set((s) => {
                    const emp = s.employees.find((e) => e.id === data.employeeId);
                    if (!emp) return {};
                    return {
                        salaryRequests: [
                            ...s.salaryRequests,
                            {
                                id: `SCR-${nanoid(8)}`,
                                employeeId: data.employeeId,
                                oldSalary: emp.salary,
                                proposedSalary: data.proposedSalary,
                                effectiveDate: data.effectiveDate,
                                reason: data.reason,
                                proposedBy: data.proposedBy,
                                proposedAt: new Date().toISOString(),
                                status: "pending" as const,
                            },
                        ],
                    };
                }),
            approveSalaryChange: (requestId, reviewerId) =>
                set((s) => {
                    const req = s.salaryRequests.find((r) => r.id === requestId);
                    if (!req || req.status !== "pending") return {};
                    const emp = s.employees.find((e) => e.id === req.employeeId);
                    if (!emp) return {};
                    // Close any open salary history entry
                    const updatedHistory = s.salaryHistory.map((h) =>
                        h.employeeId === req.employeeId && !h.effectiveTo
                            ? { ...h, effectiveTo: req.effectiveDate }
                            : h
                    );
                    return {
                        salaryRequests: s.salaryRequests.map((r) =>
                            r.id === requestId
                                ? { ...r, status: "approved" as const, reviewedBy: reviewerId, reviewedAt: new Date().toISOString() }
                                : r
                        ),
                        employees: s.employees.map((e) =>
                            e.id === req.employeeId ? { ...e, salary: req.proposedSalary } : e
                        ),
                        salaryHistory: [
                            ...updatedHistory,
                            {
                                id: `SH-${nanoid(8)}`,
                                employeeId: req.employeeId,
                                monthlySalary: req.proposedSalary,
                                effectiveFrom: req.effectiveDate,
                                approvedBy: reviewerId,
                                reason: req.reason,
                            },
                        ],
                    };
                }),
            rejectSalaryChange: (requestId, reviewerId) =>
                set((s) => ({
                    salaryRequests: s.salaryRequests.map((r) =>
                        r.id === requestId
                            ? { ...r, status: "rejected" as const, reviewedBy: reviewerId, reviewedAt: new Date().toISOString() }
                            : r
                    ),
                })),
            getSalaryHistory: (employeeId) =>
                get().salaryHistory.filter((h) => h.employeeId === employeeId),
            addDocument: (employeeId, name) => set((s) => {
                const existing = s.documents[employeeId] || [];
                return { documents: { ...s.documents, [employeeId]: [...existing, { id: `DOC-${nanoid(6)}`, name, uploadedAt: new Date().toISOString() }] } };
            }),
            removeDocument: (employeeId, docId) => set((s) => {
                const existing = s.documents[employeeId] || [];
                return { documents: { ...s.documents, [employeeId]: existing.filter((d) => d.id !== docId) } };
            }),
            getDocuments: (employeeId) => get().documents[employeeId] || [],
            resetToSeed: () =>
                set({
                    employees: SEED_EMPLOYEES,
                    salaryRequests: [],
                    salaryHistory: [],
                    documents: {},
                    searchQuery: "",
                    statusFilter: "all",
                    workTypeFilter: "all",
                    departmentFilter: "all",
                }),
        }),
        {
            name: "nexhrms-employees",
            version: 5,
            migrate: () => ({
                employees: SEED_EMPLOYEES,
                salaryRequests: [],
                salaryHistory: [],
                documents: {},
                searchQuery: "",
                statusFilter: "all" as const,
                workTypeFilter: "all" as const,
                departmentFilter: "all",
            }),
        }
    )
);

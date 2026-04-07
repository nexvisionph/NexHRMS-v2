"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Employee, EmployeeStatus, WorkType, SalaryChangeRequest, SalaryHistoryEntry, EmployeeDocument } from "@/types";
import { SEED_EMPLOYEES } from "@/data/seed";

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
    addEmployee: (emp: Employee) => { ok: boolean; error?: string };
    updateEmployee: (id: string, data: Partial<Employee>) => void;
    removeEmployee: (id: string) => void;
    toggleStatus: (id: string) => void;
    resignEmployee: (id: string) => void;
    getEmployee: (id: string) => Employee | undefined;
    getFiltered: () => Employee[];
    deduplicateEmployees: () => number;
    // Salary change governance
    proposeSalaryChange: (data: { employeeId: string; proposedSalary: number; effectiveDate: string; reason: string; proposedBy: string }) => void;
    approveSalaryChange: (requestId: string, reviewerId: string) => void;
    rejectSalaryChange: (requestId: string, reviewerId: string) => void;
    getSalaryHistory: (employeeId: string) => SalaryHistoryEntry[];
    addDocument: (employeeId: string, name: string, fileUrl?: string, fileType?: string) => void;
    removeDocument: (employeeId: string, docId: string) => void;
    getDocuments: (employeeId: string) => EmployeeDocument[];
    resetToSeed: () => void;
}

// Helper to deduplicate employees array by ID (keeps first occurrence)
function dedupeById(employees: Employee[]): Employee[] {
    const seen = new Set<string>();
    return employees.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });
}

// Helper to deduplicate employees by email — for each duplicate email group,
// prefer the record that has a profileId (linked auth account), else keep first.
function dedupeByEmail(employees: Employee[]): Employee[] {
    const emailMap = new Map<string, Employee>();
    for (const e of employees) {
        const key = e.email.toLowerCase();
        const existing = emailMap.get(key);
        if (!existing) {
            emailMap.set(key, e);
        } else if (!existing.profileId && e.profileId) {
            // Prefer the record that is linked to a real auth account
            emailMap.set(key, e);
        }
    }
    return Array.from(emailMap.values());
}

function dedupeAll(employees: Employee[]): Employee[] {
    return dedupeByEmail(dedupeById(employees));
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
            addEmployee: (emp) => {
                const { employees } = get();
                // Check for duplicate ID
                if (employees.some((e) => e.id === emp.id)) {
                    return { ok: false, error: `Employee ID "${emp.id}" already exists.` };
                }
                // Check for duplicate email
                if (employees.some((e) => e.email.toLowerCase() === emp.email.toLowerCase())) {
                    return { ok: false, error: `An employee with email "${emp.email}" already exists.` };
                }
                set({ employees: [...employees, emp] });
                return { ok: true };
            },
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
            deduplicateEmployees: () => {
                const { employees } = get();
                const before = employees.length;
                const deduped = dedupeAll(employees);
                if (deduped.length < before) {
                    set({ employees: deduped });
                }
                return before - deduped.length;
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
            addDocument: (employeeId, name, fileUrl, fileType) => set((s) => {
                const existing = s.documents[employeeId] || [];
                return { documents: { ...s.documents, [employeeId]: [...existing, { id: `DOC-${nanoid(6)}`, name, uploadedAt: new Date().toISOString(), fileUrl, fileType }] } };
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
            name: "soren-employees",
            version: 10,
            migrate: (persisted, fromVersion) => {
                const state = persisted as Partial<EmployeesState> & { employees?: Employee[] };
                if (fromVersion < 7) {
                    return { employees: SEED_EMPLOYEES, salaryRequests: [], salaryHistory: [], documents: {}, searchQuery: "", statusFilter: "all" as const, workTypeFilter: "all" as const, departmentFilter: "all" };
                }
                const SYSTEM_ROLES = new Set(["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"]);
                const seedIds = new Set(SEED_EMPLOYEES.map((e) => e.id));
                // v7→v8: reset productivity to 0 for non-seed employees with hardcoded 80
                // v8→v9: deduplicate by email (keeps profileId-linked record)
                // v9→v10: if role is a job title (not a system role), move to jobTitle and default role to "employee"
                const employees = dedupeAll(
                    (state.employees ?? SEED_EMPLOYEES).map((e) => {
                        let updated = e;
                        if (!seedIds.has(e.id) && e.productivity === 80) updated = { ...updated, productivity: 0 };
                        if (!SYSTEM_ROLES.has(e.role)) {
                            updated = { ...updated, jobTitle: updated.jobTitle ?? e.role, role: "employee" };
                        }
                        return updated;
                    })
                );
                return { ...state, employees };
            },
            // Auto-deduplicate by both ID and email on every rehydration
            merge: (persisted, current) => {
                const persistedState = persisted as Partial<EmployeesState> | undefined;
                const currentState = current as EmployeesState;
                if (!persistedState) return currentState;
                return {
                    ...currentState,
                    ...persistedState,
                    employees: dedupeAll(persistedState.employees ?? currentState.employees),
                };
            },
        }
    )
);

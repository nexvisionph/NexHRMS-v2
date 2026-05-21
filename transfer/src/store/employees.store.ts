"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Employee, EmployeeStatus, WorkType, SalaryChangeRequest, SalaryHistoryEntry, EmployeeDocument } from "@/types";
import { SEED_EMPLOYEES } from "@/data/seed";

interface EmployeesState {
    employees: Employee[];
    deletedEmployeeIds: string[];
    salaryRequests: SalaryChangeRequest[];
    salaryHistory: SalaryHistoryEntry[];
    documents: Record<string, EmployeeDocument[]>;
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
// Note: The discarded record's references (attendance, salary history) remain intact
// since they reference by employee ID which is preserved in the kept record.
function dedupeByEmail(employees: Employee[]): Employee[] {
    const emailMap = new Map<string, Employee>();
    for (const e of employees) {
        const key = e.email.toLowerCase();
        const existing = emailMap.get(key);
        if (!existing) {
            emailMap.set(key, e);
        } else if (!existing.profileId && e.profileId) {
            // Prefer the record that is linked to a real auth account
            // Merge any additional data from the discarded record
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

export const useEmployeesStore = create<EmployeesState>()(
    (set, get) => ({
            employees: SEED_EMPLOYEES,
            deletedEmployeeIds: [],
            salaryRequests: [],
            salaryHistory: [],
            documents: {},
            searchQuery: "",
            statusFilter: "all",
            workTypeFilter: "all",
            roleFilter: "all",
            departmentFilter: "all",
            setSearchQuery: (q) => set({ searchQuery: q }),
            setStatusFilter: (s) => set({ statusFilter: s }),
            setWorkTypeFilter: (w) => set({ workTypeFilter: w }),
            setRoleFilter: (r) => set({ roleFilter: r }),
            setDepartmentFilter: (d) => set({ departmentFilter: d }),
            addEmployee: (emp) => {
                const { employees, deletedEmployeeIds } = get();
                // Check for duplicate ID
                if (employees.some((e) => e.id === emp.id)) {
                    return { ok: false, error: `Employee ID "${emp.id}" already exists.` };
                }
                // Check for duplicate email
                if (employees.some((e) => e.email.toLowerCase() === emp.email.toLowerCase())) {
                    return { ok: false, error: `An employee with email "${emp.email}" already exists.` };
                }
                if (emp.biometricId && employees.some((e) => e.biometricId === emp.biometricId)) {
                    return { ok: false, error: `Biometric ID "${emp.biometricId}" is already assigned.` };
                }
                set({
                    employees: [...employees, emp],
                    deletedEmployeeIds: deletedEmployeeIds.filter((id) => id !== emp.id),
                });
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
                    deletedEmployeeIds: [...new Set([...s.deletedEmployeeIds, id])],
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
                const { employees, searchQuery, statusFilter, workTypeFilter, roleFilter, departmentFilter } = get();
                return employees.filter((e) => {
                    const matchesSearch =
                        !searchQuery ||
                        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.biometricId?.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
                    const matchesWorkType = workTypeFilter === "all" || e.workType === workTypeFilter;
                    const matchesRole = roleFilter === "all" || e.role === roleFilter;
                    const matchesDept = departmentFilter === "all" || e.department === departmentFilter;
                    return matchesSearch && matchesStatus && matchesWorkType && matchesRole && matchesDept;
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
                    // Validate effective date is not in the past (allow today)
                    const today = new Date().toISOString().split("T")[0];
                    if (req.effectiveDate < today) return {};
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
                    deletedEmployeeIds: [],
                    salaryRequests: [],
                    salaryHistory: [],
                    documents: {},
                    searchQuery: "",
                    statusFilter: "all",
                    workTypeFilter: "all",
                    roleFilter: "all",
                    departmentFilter: "all",
                }),
        })
);

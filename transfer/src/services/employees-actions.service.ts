"use client";
/**
 * Employees Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 13 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { employeesDb, salaryDb } from "./db.service";
import { useEmployeesStore } from "@/store/employees.store";
import type { Employee, SalaryChangeRequest, SalaryHistoryEntry } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add an employee — DB-first.
 */
export async function addEmployee(emp: Employee): Promise<{ ok: boolean; error?: string }> {
    // Validate locally first
    const store = useEmployeesStore.getState();
    if (store.employees.some((e) => e.id === emp.id)) {
        return { ok: false, error: `Employee ID "${emp.id}" already exists.` };
    }
    if (store.employees.some((e) => e.email.toLowerCase() === emp.email.toLowerCase())) {
        return { ok: false, error: `An employee with email "${emp.email}" already exists.` };
    }

    // 1. Write to DB first
    const ok = await employeesDb.upsert(emp);
    if (!ok) return { ok: false, error: "Failed to save employee to database" };

    // 2. Update local cache
    useEmployeesStore.setState((s) => ({
        employees: [...s.employees, emp],
        deletedEmployeeIds: s.deletedEmployeeIds.filter((id) => id !== emp.id),
    }));
    return { ok: true };
}

/**
 * Update an employee — DB-first.
 */
export async function updateEmployee(id: string, patch: Partial<Employee>): Promise<boolean> {
    const ok = await employeesDb.update(id, patch);
    if (!ok) return false;

    useEmployeesStore.setState((s) => ({
        employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    return true;
}

/**
 * Remove an employee — DB-first.
 */
export async function removeEmployee(id: string): Promise<boolean> {
    const ok = await employeesDb.remove(id);
    if (!ok) return false;

    useEmployeesStore.setState((s) => ({
        employees: s.employees.filter((e) => e.id !== id),
        deletedEmployeeIds: [...new Set([...s.deletedEmployeeIds, id])],
    }));
    return true;
}

/**
 * Toggle employee status — DB-first.
 */
export async function toggleStatus(id: string): Promise<boolean> {
    const store = useEmployeesStore.getState();
    const emp = store.employees.find((e) => e.id === id);
    if (!emp) return false;

    const newStatus = emp.status === "active" ? "inactive" : "active";
    const ok = await employeesDb.update(id, { status: newStatus });
    if (!ok) return false;

    useEmployeesStore.setState((s) => ({
        employees: s.employees.map((e) =>
            e.id === id ? { ...e, status: newStatus as "active" | "inactive" } : e
        ),
    }));
    return true;
}

/**
 * Resign an employee — DB-first.
 */
export async function resignEmployee(id: string): Promise<boolean> {
    const ok = await employeesDb.update(id, {
        status: "resigned",
        resignedAt: new Date().toISOString(),
    });
    if (!ok) return false;

    useEmployeesStore.setState((s) => ({
        employees: s.employees.map((e) =>
            e.id === id ? { ...e, status: "resigned" as const, resignedAt: new Date().toISOString() } : e
        ),
    }));
    return true;
}

/**
 * Propose a salary change — DB-first.
 */
export async function proposeSalaryChange(data: {
    employeeId: string;
    proposedSalary: number;
    effectiveDate: string;
    reason: string;
    proposedBy: string;
}): Promise<{ ok: boolean; id?: string }> {
    const store = useEmployeesStore.getState();
    const emp = store.employees.find((e) => e.id === data.employeeId);
    if (!emp) return { ok: false };

    const req: SalaryChangeRequest = {
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

    const ok = await salaryDb.upsertRequest(req);
    if (!ok) return { ok: false };

    useEmployeesStore.setState((s) => ({
        salaryRequests: [...s.salaryRequests, req],
    }));
    return { ok: true, id: req.id };
}

/**
 * Approve a salary change — DB-first.
 */
export async function approveSalaryChange(requestId: string, reviewerId: string): Promise<boolean> {
    const store = useEmployeesStore.getState();
    const req = store.salaryRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return false;

    const updatedReq: SalaryChangeRequest = {
        ...req,
        status: "approved",
        reviewedBy: reviewerId,
        reviewedAt: new Date().toISOString(),
    };

    const historyEntry: SalaryHistoryEntry = {
        id: `SH-${nanoid(8)}`,
        employeeId: req.employeeId,
        monthlySalary: req.proposedSalary,
        effectiveFrom: req.effectiveDate,
        approvedBy: reviewerId,
        reason: req.reason,
    };

    // Write all to DB
    const [reqOk, histOk, empOk] = await Promise.all([
        salaryDb.upsertRequest(updatedReq),
        salaryDb.insertHistory(historyEntry),
        employeesDb.update(req.employeeId, { salary: req.proposedSalary }),
    ]);

    if (!reqOk) return false;

    // Update local state
    useEmployeesStore.getState().approveSalaryChange(requestId, reviewerId);
    return true;
}

/**
 * Reject a salary change — DB-first.
 */
export async function rejectSalaryChange(requestId: string, reviewerId: string): Promise<boolean> {
    const store = useEmployeesStore.getState();
    const req = store.salaryRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return false;

    const updatedReq: SalaryChangeRequest = {
        ...req,
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date().toISOString(),
    };

    const ok = await salaryDb.upsertRequest(updatedReq);
    if (!ok) return false;

    useEmployeesStore.setState((s) => ({
        salaryRequests: s.salaryRequests.map((r) =>
            r.id === requestId ? updatedReq : r
        ),
    }));
    return true;
}
